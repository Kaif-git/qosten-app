import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { questionApi } from '../services/questionApi';

// Initial state
const initialState = {
  questions: [],
  hierarchy: [], // Stores subject/chapter structure and counts
  currentFilters: {
    searchText: '',
    subject: '',
    chapter: '',
    lesson: '',
    type: '',
    board: '',
    language: '',
    flaggedStatus: '', // 'all', 'flagged', 'unflagged'
    verifiedStatus: 'all' // 'all', 'verified', 'unverified'
  },
  editingQuestion: null,
  isAuthenticated: false,
  stats: {
    total: 0,
    subjects: 0,
    chapters: 0
  }
};

// Action types
const ACTIONS = {
  SET_QUESTIONS: 'SET_QUESTIONS',
  SET_HIERARCHY: 'SET_HIERARCHY',
  ADD_QUESTION: 'ADD_QUESTION',
  UPDATE_QUESTION: 'UPDATE_QUESTION',
  DELETE_QUESTION: 'DELETE_QUESTION',
  SET_FILTERS: 'SET_FILTERS',
  SET_EDITING_QUESTION: 'SET_EDITING_QUESTION',
  SET_AUTHENTICATED: 'SET_AUTHENTICATED',
  UPDATE_STATS: 'UPDATE_STATS'
};

// Reducer function
function questionReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_QUESTIONS: {
      const newQuestions = typeof action.payload === 'function' 
        ? action.payload(state.questions) 
        : action.payload;
      return { ...state, questions: newQuestions };
    }
    case ACTIONS.SET_HIERARCHY:
      return { ...state, hierarchy: action.payload };
    case ACTIONS.ADD_QUESTION:
      return { ...state, questions: [action.payload, ...state.questions] };
    case ACTIONS.UPDATE_QUESTION:
      return {
        ...state,
        questions: state.questions.map(q => 
          q.id === action.payload.id ? action.payload : q
        )
      };
    case ACTIONS.DELETE_QUESTION:
      return {
        ...state,
        questions: state.questions.filter(q => q.id !== action.payload)
      };
    case ACTIONS.SET_FILTERS:
      return { ...state, currentFilters: { ...state.currentFilters, ...action.payload } };
    case ACTIONS.SET_EDITING_QUESTION:
      return { ...state, editingQuestion: action.payload };
    case ACTIONS.SET_AUTHENTICATED:
      return { ...state, isAuthenticated: action.payload };
    case ACTIONS.UPDATE_STATS: {
      const newStats = typeof action.payload === 'function'
        ? action.payload(state.stats)
        : action.payload;
      return { ...state, stats: newStats };
    }
    default:
      return state;
  }
}

// Create context
const QuestionContext = createContext();

// Global memory cache to persist across component remounts during the session
let memoryCache = {
  questions: null,
  timestamp: null,
  expiresAt: null
};

const CACHE_KEY = 'qosten_questions_cache';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// Helper to strip serialization prefixes for clean indexing/storage
export const cleanText = (text) => {
  if (!text) return '';
  // If it's already a composite string, extract the text part
  if (typeof text === 'string' && (text.startsWith('MCQ:') || text.startsWith('CQ:') || text.startsWith('SQ:') || text.startsWith('Question:'))) {
      return text
        .replace(/^(MCQ|CQ|SQ|Question):\s*/i, '')
        .split('|')[0] // Only take the text part
        .trim();
  }
  return typeof text === 'string' ? text.trim() : '';
};

// Helper to convert base64 to Blob
const base64ToBlob = async (base64Data) => {
  const res = await fetch(base64Data);
  return await res.blob();
};

// Context provider component
export function QuestionProvider({ children }) {
  const [state, dispatch] = useReducer(questionReducer, initialState);
  const isFetchingRef = useRef(false);

  // Helper to save to both memory and persistent cache
  const saveToCache = (questions) => {
    const timestamp = Date.now();
    const cacheData = {
      questions,
      timestamp,
      count: questions.length
    };
    
    // Update Memory Cache
    memoryCache = {
      questions,
      timestamp,
      expiresAt: timestamp + CACHE_TTL
    };
    
    // Update Persistent Cache
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn('Failed to save to localStorage cache:', e);
    }
  };

  const uploadImageToSupabase = async (fileOrBase64) => {
    if (!supabase || !fileOrBase64) return null;
    
    // If it's already a URL, return it
    if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('http')) {
        return fileOrBase64;
    }

    try {
        let fileToUpload = fileOrBase64;
        let mimeType = 'image/jpeg'; // Default
        
        if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) {
            // Extract mime type
            const matches = fileOrBase64.match(/^data:(.+);base64,/);
            if (matches && matches[1]) {
                mimeType = matches[1];
            }
            fileToUpload = await base64ToBlob(fileOrBase64);
        }
        
        const ext = mimeType.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `${fileName}`; 

        const { data, error } = await supabase
            .storage
            .from('question-images')
            .upload(filePath, fileToUpload);

        if (error) {
            console.error('Error uploading image to Supabase:', error);
            throw error;
        }

        const { data: { publicUrl } } = supabase
            .storage
            .from('question-images')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Image upload failed:', error);
        // Fallback: return original if upload fails, or throw? 
        // For now, let's allow it to proceed potentially broken or retry logic should be higher up.
        // But better to throw so user knows.
        throw error;
    }
  };

  const processQuestionImages = async (question) => {
      const q = { ...question };
      
      if (q.image) q.image = await uploadImageToSupabase(q.image);
      if (q.answerimage1) q.answerimage1 = await uploadImageToSupabase(q.answerimage1);
      if (q.answerimage2) q.answerimage2 = await uploadImageToSupabase(q.answerimage2);
      
      if (q.parts && Array.isArray(q.parts)) {
          q.parts = await Promise.all(q.parts.map(async p => {
              if (p.answerImage) {
                  return { ...p, answerImage: await uploadImageToSupabase(p.answerImage) };
              }
              return p;
          }));
      }
      
      return q;
  };

  // Actions
  const setQuestions = (questions) => {
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: questions });
    if (typeof questions !== 'function') {
      updateStats(questions);
    }
  };

  const clearCache = () => {
    memoryCache = { questions: null, timestamp: null, expiresAt: null };
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Cache cleared');
  };

  const refreshHierarchy = async () => {
    try {
      console.log('📡 Refreshing question hierarchy...');
      const hierarchyData = await questionApi.fetchHierarchy();
      dispatch({ type: ACTIONS.SET_HIERARCHY, payload: hierarchyData });
      console.log(`✅ Hierarchy refreshed for ${hierarchyData.length} subjects`);
    } catch (hErr) {
      console.error('Failed to refresh hierarchy:', hErr);
    }
  };

  const addQuestion = async (question) => {
    try {
      // 1. Process Images (Upload to Supabase Bucket)
      const questionWithImages = await processQuestionImages(question);
      
      const dbQuestion = mapAppToDatabase({ ...questionWithImages, id: Date.now() + Math.floor(Math.random() * 10000) });
      
      // 3. Call API
      const responseData = await questionApi.createQuestion(dbQuestion);
      
      // 4. Update State
      const newQuestion = mapDatabaseToApp(responseData.data || responseData);
      
      // Update State & Cache together
      dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          const updated = [newQuestion, ...prevQuestions];
          saveToCache(updated);
          return updated;
      }});
      
      // Refresh hierarchy in background
      refreshHierarchy();
      
      return newQuestion;
    } catch (error) {
      console.error('Error in addQuestion:', error);
      throw error;
    }
  };

  const bulkAddQuestions = async (questions, onProgress) => {
    try {
      console.log(`🚀 Starting bulk add of ${questions.length} questions...`);
      
      const results = {
        successCount: 0,
        failedCount: 0,
        errors: []
      };

      const CHUNK_SIZE = 100;
      const total = questions.length;

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = questions.slice(i, i + CHUNK_SIZE);
        
        const processedChunk = await Promise.all(chunk.map(async q => {
          try {
            const withImages = await processQuestionImages(q);
            return mapAppToDatabase(withImages);
          } catch (e) {
            console.error(`Error processing images for question ${q.id}:`, e);
            return mapAppToDatabase(q);
          }
        }));

        const batchResults = await questionApi.bulkCreateQuestions(processedChunk);
        
        results.successCount += batchResults.successCount;
        results.failedCount += batchResults.failedCount;
        results.errors.push(...batchResults.errors);

        if (onProgress) {
          onProgress(Math.min(i + CHUNK_SIZE, total), total);
        }
      }

      // Refresh everything to ensure UI is in sync
      await refreshQuestions();
      refreshHierarchy();
      
      return results;
    } catch (error) {
      console.error('Error in bulkAddQuestions:', error);
      throw error;
    }
  };

  const batchAddQuestions = async (questions, onProgress) => {
    try {
      console.log(`🚀 Starting batch add of ${questions.length} questions...`);
      
      const dbQuestions = questions.map(q => mapAppToDatabase(q));
      
      const result = await questionApi.batchCreateQuestions(dbQuestions, onProgress);
      
      // Refresh everything
      await refreshQuestions();
      refreshHierarchy();
      
      return result;
    } catch (error) {
      console.error('Error in batchAddQuestions:', error);
      throw error;
    }
  };


  const updateQuestion = async (question) => {
    try {
      // 1. Process Images
      const questionWithImages = await processQuestionImages(question);
      
      // 2. Map to API/DB format
      const dbQuestion = mapAppToDatabase(questionWithImages);
      const questionId = parseInt(question.id);

      // 3. Call API
      await questionApi.updateQuestion(questionId, dbQuestion);

      // 4. Update State & Cache
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: questionWithImages });
      
      // Sync cache
      dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          const updated = prevQuestions.map(q => q.id === question.id ? questionWithImages : q);
          saveToCache(updated);
          return updated;
      }});

      console.log('Question updated via API:', question.id);
    } catch (error) {
      console.error('Error in updateQuestion:', error);
      throw error;
    }
  };

  const bulkUpdateQuestions = async (questions) => {
    try {
      console.log(`🔄 Starting bulk update of ${questions.length} questions...`);
      
      const dbQuestions = questions.map(q => mapAppToDatabase(q));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(dbQuestions);
      
      // Map to track updates
      const updateMap = new Map(questions.map(q => [q.id.toString(), q]));

      // Update State & Cache
      dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          const updated = prevQuestions.map(q => {
              const improved = updateMap.get(q.id.toString());
              return improved ? { ...q, ...improved } : q;
          });
          saveToCache(updated);
          return updated;
      }});
      
      console.log(`✅ Bulk update complete: ${successCount} succeeded, ${failedCount} failed`);
      return { successCount, failedCount };
    } catch (error) {
      console.error('Error in bulkUpdateQuestions:', error);
      throw error;
    }
  };

  const deleteQuestion = async (id) => {
    try {
      const questionId = parseInt(id);
      await questionApi.deleteQuestion(questionId);

      // 1. Update State
      dispatch({ type: ACTIONS.DELETE_QUESTION, payload: id });
      
      // 2. Update Cache
      dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          const updated = prevQuestions.filter(q => q.id.toString() !== id.toString());
          saveToCache(updated);
          return updated;
      }});

      console.log('Question deleted via API:', id);
    } catch (error) {
      console.error('Error in deleteQuestion:', error);
      throw error;
    }
  };

  const setFilters = (filters) => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
  };

  const setEditingQuestion = (question) => {
    dispatch({ type: ACTIONS.SET_EDITING_QUESTION, payload: question });
  };

  const setAuthenticated = (isAuth) => {
    dispatch({ type: ACTIONS.SET_AUTHENTICATED, payload: isAuth });
  };

  const updateStats = (questions) => {
    if (typeof questions === 'function') {
        // If it's a function, we can't easily calculate stats here without the current state
        // The reducer now handles UPDATE_STATS if we want to dispatch a function there
        dispatch({ type: ACTIONS.UPDATE_STATS, payload: (prevStats) => {
            // This is complex because we need the questions.
            // For now, let's just ignore functional updates for stats or handle them in reducer.
            return prevStats;
        }});
        return;
    }

    const subjects = new Set(questions.map(q => q.subject).filter(Boolean));
    const chapters = new Set(questions.map(q => q.chapter).filter(Boolean));
    
    dispatch({ type: ACTIONS.UPDATE_STATS, payload: {
      total: questions.length,
      subjects: subjects.size,
      chapters: chapters.size
    }});
  };


  // Helper function to map database question to app format
  const mapDatabaseToApp = (dbQuestion) => {
    // Helper to parse JSON safely
    const safeParse = (val, fallback = []) => {
        if (typeof val === 'string') {
            try {
                return JSON.parse(val);
            } catch (e) {
                console.warn('Failed to parse JSON field:', e);
                return fallback;
            }
        }
        return val || fallback;
    };

    return {
      id: dbQuestion.id?.toString() || Date.now().toString(),
      type: dbQuestion.type,
      subject: dbQuestion.subject,
      chapter: dbQuestion.chapter,
      lesson: dbQuestion.lesson,
      board: dbQuestion.board,
      language: dbQuestion.language || 'en',
      question: dbQuestion.question,
      questionText: dbQuestion.question_text, // Removed fallback to dbQuestion.question
      options: safeParse(dbQuestion.options),
      correctAnswer: dbQuestion.correct_answer,
      answer: dbQuestion.answer,
      parts: safeParse(dbQuestion.parts),
      image: dbQuestion.image,
      answerimage1: dbQuestion.answerimage1,
      answerimage2: dbQuestion.answerimage2,
      explanation: dbQuestion.explanation,
      tags: safeParse(dbQuestion.tags),
      isQuizzable: dbQuestion.is_quizzable !== undefined ? dbQuestion.is_quizzable : true,
      isFlagged: dbQuestion.is_flagged || false,
      isVerified: dbQuestion.is_verified || false,
      inReviewQueue: dbQuestion.in_review_queue || false,
      createdAt: dbQuestion.created_at
    };
  };

  // Helper function to map app question to database format
  const mapAppToDatabase = (appQuestion) => {
    const type = appQuestion.type || 'mcq';
    
    // Ensure we have clean text for question_text column
    // Priority: appQuestion.questionText > appQuestion.question (cleaned)
    let qText = appQuestion.questionText ? appQuestion.questionText.trim() : '';
    if (!qText && appQuestion.question) {
        qText = cleanText(appQuestion.question);
    }
    
    let questionField = (appQuestion.question || '').trim();
    
    if (type === 'cq') {
      questionField = qText;
    } else if (type === 'mcq') {
      questionField = qText;
    } else if (type === 'sq') {
      questionField = qText;
    }
    
    if (!questionField || questionField === 'MCQ:' || questionField === 'CQ:' || questionField === 'SQ:') {
      if (type !== 'cq') {
        questionField = `ID_${appQuestion.id || Date.now()}`;
      } else {
        questionField = (questionField === 'CQ:') ? '' : questionField;
      }
    }
    
    const dbQuestion = {
      type: appQuestion.type,
      subject: appQuestion.subject,
      chapter: appQuestion.chapter,
      lesson: appQuestion.lesson || 'N/A',
      board: appQuestion.board || 'N/A',
      language: appQuestion.language || 'en',
      question: questionField,
      question_text: qText,
      // Stringify complex objects for D1/SQLite compatibility
      options: appQuestion.options ? JSON.stringify(appQuestion.options) : null,
      correct_answer: appQuestion.correctAnswer,
      answer: appQuestion.answer,
      parts: appQuestion.parts ? JSON.stringify(appQuestion.parts) : null,
      image: appQuestion.image,
      answerimage1: appQuestion.answerimage1,
      answerimage2: appQuestion.answerimage2,
      explanation: appQuestion.explanation,
      tags: appQuestion.tags ? JSON.stringify(appQuestion.tags) : JSON.stringify([]),
      is_flagged: appQuestion.isFlagged || false,
      is_verified: appQuestion.isVerified || false,
      in_review_queue: appQuestion.inReviewQueue || false,
      synced: false
    };
    
    // Only include id if it exists (for updates), exclude it for inserts
    if (appQuestion.id) {
      dbQuestion.id = parseInt(appQuestion.id);
    }
    
    return dbQuestion;
  };


  // Load questions from API on mount
  useEffect(() => {
    const loadQuestionsFromDatabase = async () => {
      if (isFetchingRef.current) return;
      
      let initialCount = 0;
      let startPage = 0;

      // 1. Try Memory Cache first (Instant)
      if (memoryCache.questions) {
        const age = Math.round((Date.now() - memoryCache.timestamp) / 1000);
        console.log(`⚡ Memory cache HIT! ${memoryCache.questions.length} questions (age: ${age}s)`);
        setQuestions(memoryCache.questions);
        initialCount = memoryCache.questions.length;
      } else {
        // 2. Try Persistent Cache (localStorage)
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          try {
            const { questions, timestamp } = JSON.parse(cached);
            const age = Math.round((Date.now() - timestamp) / 1000);
            
            if (Date.now() - timestamp < CACHE_TTL) {
              console.log(`💾 Persistent cache HIT! ${questions.length} questions (age: ${age}s)`);
              // Update memory cache for next time
              memoryCache = { questions, timestamp, expiresAt: timestamp + CACHE_TTL };
              setQuestions(questions);
              initialCount = questions.length;
            } else {
              console.log('⏳ Persistent cache EXPIRED, fetching fresh data...');
            }
          } catch (e) {
            console.error('Error parsing cache:', e);
          }
        }
      }

      // 3. Fetch Hierarchy & Initial Questions
      try {
        isFetchingRef.current = true;
        
        // Fetch Hierarchy First (Fast)
        console.log('📡 Fetching question hierarchy...');
        try {
            const hierarchyData = await questionApi.fetchHierarchy();
            dispatch({ type: ACTIONS.SET_HIERARCHY, payload: hierarchyData });
            console.log(`✅ Loaded hierarchy for ${hierarchyData.length} subjects`);
        } catch (hErr) {
            console.error('Failed to load hierarchy:', hErr);
        }

        // If we have no questions from cache, fetch the first page so the UI isn't empty
        if (initialCount === 0) {
            console.log('📡 Fetching initial page of questions...');
            const BATCH_SIZE = 500;
            const batchSizeReceived = await fetchMoreQuestions(0);
            console.log(`✅ Initial load complete. Received ${batchSizeReceived} questions.`);
        } else {
             console.log(`✅ Skipping initial fetch, using ${initialCount} cached questions.`);
        }
        
      } catch (error) {
        console.error('Error loading questions from API:', error);
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadQuestionsFromDatabase();
  }, []);

  // Function to manually refresh questions from API
  const refreshQuestions = async () => {
    try {
      console.log('🔄 Manually refreshing questions (API)...');
      
      // Refresh Hierarchy too
      refreshHierarchy();

      const allQuestions = await questionApi.fetchAllQuestions();

      if (allQuestions.length > 0) {
        const mappedQuestions = allQuestions.map(mapDatabaseToApp);
        setQuestions(mappedQuestions);
        saveToCache(mappedQuestions); // Update cache with fresh data
        console.log(`✅ Successfully refreshed ${mappedQuestions.length} questions`);
      }
    } catch (error) {
      console.error('Error refreshing questions:', error);
    }
  };

  const fetchMoreQuestions = async (forcedPage = null) => {
    if (isFetchingRef.current && forcedPage === null) return;
    
    try {
      if (forcedPage === null) isFetchingRef.current = true;
      
      const BATCH_SIZE = 500;
      // Use forcedPage if provided (for Fetch All loop), otherwise calculate from current state
      const nextPage = forcedPage !== null ? forcedPage : Math.floor(state.questions.length / BATCH_SIZE);
      
      console.log(`📡 Fetching Page ${nextPage}...`);
      
      const response = await questionApi.fetchQuestions({
        limit: BATCH_SIZE,
        page: nextPage
      });
      
      const batch = Array.isArray(response) ? response : (response.data || []);
      
      if (batch.length > 0) {
        const mappedBatch = batch.map(mapDatabaseToApp);
        
        // Use functional update to ensure we always have the latest questions
        let addedCount = 0;
        dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          const existingIds = new Set(prevQuestions.map(q => q.id.toString()));
          const uniqueNewBatch = mappedBatch.filter(q => !existingIds.has(q.id.toString()));
          addedCount = uniqueNewBatch.length;
          
          if (addedCount > 0) {
            const updated = [...prevQuestions, ...uniqueNewBatch];
            // Update cache with the new full list
            saveToCache(updated);
            return updated;
          }
          return prevQuestions;
        }});

        // Since dispatch is async in terms of state availability, 
        // we'll return the length of the batch we tried to add
        return batch.length; 
      }
      return 0;
    } catch (error) {
      console.error('Error fetching more questions:', error);
      throw error;
    } finally {
      if (forcedPage === null) isFetchingRef.current = false;
    }
  };

  const fetchAllRemaining = async (onProgress) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    let totalAdded = 0;
    let hasMore = true;
    const BATCH_SIZE = 500;
    // Start from the next page based on current count
    let currentPage = Math.floor(state.questions.length / BATCH_SIZE);
    
    console.log(`🚀 Starting "Fetch All" from Page ${currentPage}...`);
    
    try {
      while (hasMore) {
        const batchSizeReceived = await fetchMoreQuestions(currentPage);
        
        if (batchSizeReceived > 0) {
          totalAdded += batchSizeReceived;
          if (onProgress) onProgress(totalAdded);
          
          currentPage++;
          
          // Stop if we received a partial batch (reached end of DB)
          if (batchSizeReceived < BATCH_SIZE) {
            hasMore = false;
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }
      }
      
      // Update cache one final time with the full set
      // We'll get questions from the value object which should be updated by now
      // Or just refresh questions manually to sync everything
    } catch (error) {
      console.error('Error during Fetch All:', error);
    } finally {
      isFetchingRef.current = false;
      console.log(`🏁 "Fetch All" complete. Total records processed: ${totalAdded}`);
    }
    return totalAdded;
  };

  const toggleQuestionFlag = async (questionId) => {
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const newFlaggedStatus = !question.isFlagged;

    // 1. Optimistic UI Update
    const updatedQuestion = { ...question, isFlagged: newFlaggedStatus };
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: updatedQuestion });

    try {
      await questionApi.updateQuestion(parseInt(questionId), { is_flagged: newFlaggedStatus });
      
      // Update cache
      if (memoryCache.questions) {
             memoryCache.questions = memoryCache.questions.map(q => 
                 q.id === questionId ? updatedQuestion : q
             );
      }
    } catch (err) {
      console.error('Exception toggling flag:', err);
      // Revert on error
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  };

  const toggleQuestionVerification = async (questionId) => {
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const newVerifiedStatus = !question.isVerified;

    // 1. Optimistic UI Update
    const updatedQuestion = { ...question, isVerified: newVerifiedStatus };
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: updatedQuestion });

    try {
      await questionApi.updateQuestion(parseInt(questionId), { is_verified: newVerifiedStatus });
      
      if (memoryCache.questions) {
             memoryCache.questions = memoryCache.questions.map(q => 
                 q.id === questionId ? updatedQuestion : q
             );
      }
    } catch (err) {
      console.error('Exception toggling verification:', err);
      // Revert on error
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  };

  const toggleReviewQueue = async (questionId) => {
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const newQueueStatus = !question.inReviewQueue;

    // 1. Optimistic UI Update
    const updatedQuestion = { ...question, inReviewQueue: newQueueStatus };
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: updatedQuestion });

    try {
      await questionApi.updateQuestion(parseInt(questionId), { in_review_queue: newQueueStatus });
      
      if (memoryCache.questions) {
             memoryCache.questions = memoryCache.questions.map(q => 
                 q.id === questionId ? updatedQuestion : q
             );
      }
    } catch (err) {
      console.error('Exception toggling review queue:', err);
      // Revert on error
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  };

  const bulkReviewQueue = async (questionIds, inQueue) => {
    // 1. Update Local State & Cache
    const idSet = new Set(questionIds.map(String));
    
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
        const updated = prevQuestions.map(q => 
            idSet.has(String(q.id)) ? { ...q, inReviewQueue: inQueue } : q
        );
        saveToCache(updated);
        return updated;
    }});

    try {
      console.log(`📋 Bulk setting review queue to ${inQueue} for ${questionIds.length} questions...`);
      const numericIds = questionIds.map(id => parseInt(id));
      const updates = numericIds.map(id => ({ id, in_review_queue: inQueue }));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(updates);
      
      return { successCount, failedCount };
    } catch (err) {
      console.error('Exception in bulkReviewQueue:', err);
      return { successCount: 0, failedCount: questionIds.length };
    }
  };

  const bulkFlagQuestions = async (questionIds, flagged) => {
    // 1. Update Local State & Cache
    const idSet = new Set(questionIds.map(String));
    
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
        const updated = prevQuestions.map(q => 
            idSet.has(String(q.id)) ? { ...q, isFlagged: flagged } : q
        );
        saveToCache(updated);
        return updated;
    }});

    try {
      console.log(`🚩 Bulk flagging ${questionIds.length} questions to ${flagged}...`);
      const numericIds = questionIds.map(id => parseInt(id));
      const updates = numericIds.map(id => ({ id, is_flagged: flagged }));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(updates);
      
      return { successCount, failedCount };
    } catch (err) {
      console.error('Exception in bulkFlagQuestions:', err);
      return { successCount: 0, failedCount: questionIds.length };
    }
  };

  const bulkVerifyQuestions = async (questionIds, verified) => {
    // 1. Update Local State & Cache
    const idSet = new Set(questionIds.map(String));
    
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
        const updated = prevQuestions.map(q => 
            idSet.has(String(q.id)) ? { ...q, isVerified: verified } : q
        );
        saveToCache(updated);
        return updated;
    }});

    try {
      console.log(`✅ Bulk verifying ${questionIds.length} questions to ${verified}...`);
      const numericIds = questionIds.map(id => parseInt(id));
      const updates = numericIds.map(id => ({ id, is_verified: verified }));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(updates);
      
      return { successCount, failedCount };
    } catch (err) {
      console.error('Exception in bulkVerifyQuestions:', err);
      return { successCount: 0, failedCount: questionIds.length };
    }
  };

  const fetchQuestionsByIds = async (ids) => {
    if (ids.length === 0) return [];

    try {
      const data = await questionApi.fetchQuestionsByIds(ids);
      return data.map(mapDatabaseToApp);
    } catch (error) {
      console.error('Error in fetchQuestionsByIds:', error);
      return [];
    }
  };

  const value = {
    ...state,
    supabaseClient: supabase, // Exposed for direct storage access if needed elsewhere
    hierarchy: state.hierarchy,
    setQuestions,
    clearCache,
    addQuestion,
    bulkAddQuestions,
    batchAddQuestions,
    updateQuestion,
    bulkUpdateQuestions,
    deleteQuestion,
    fetchQuestionsByIds,
    setFilters,
    setEditingQuestion,
    setAuthenticated,
    updateStats,
    refreshQuestions,
    refreshHierarchy,
    fetchMoreQuestions,
    fetchAllRemaining,
    toggleQuestionFlag,
    bulkFlagQuestions,
    toggleQuestionVerification,
    bulkVerifyQuestions,
    toggleReviewQueue,
    bulkReviewQueue
  };

  return (
    <QuestionContext.Provider value={value}>
      {children}
    </QuestionContext.Provider>
  );
}

// Custom hook to use the context
export function useQuestions() {
  const context = useContext(QuestionContext);
  if (!context) {
    throw new Error('useQuestions must be used within a QuestionProvider');
  }
  return context;
}

export default QuestionContext;
