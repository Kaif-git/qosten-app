import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { questionApi } from '../services/questionApi';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabaseClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initial state
const initialState = {
  questions: [],
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
    case ACTIONS.SET_QUESTIONS:
      return { ...state, questions: action.payload };
    case ACTIONS.ADD_QUESTION:
      return { ...state, questions: [...state.questions, action.payload] };
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
    case ACTIONS.UPDATE_STATS:
      return { ...state, stats: action.payload };
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
    if (!supabaseClient || !fileOrBase64) return null;
    
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

        const { data, error } = await supabaseClient
            .storage
            .from('question-images')
            .upload(filePath, fileToUpload);

        if (error) {
            console.error('Error uploading image to Supabase:', error);
            throw error;
        }

        const { data: { publicUrl } } = supabaseClient
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
    updateStats(questions);
  };

  const addQuestion = async (question) => {
    try {
      // 1. Process Images (Upload to Supabase Bucket)
      const questionWithImages = await processQuestionImages(question);
      
      // 2. Map to API/DB format
      // Note: We assume the API expects the same structure as the DB, or flexible JSON.
      // We'll use mapAppToDatabase to keep consistent field names (snake_case) expected by the legacy DB structure
      // that the API likely interfaces with.
      const dbQuestion = mapAppToDatabase({ ...questionWithImages, id: Date.now() + Math.floor(Math.random() * 10000) });
      
      // 3. Call API
      const responseData = await questionApi.createQuestion(dbQuestion);
      
      // 4. Update State
      // The API should return the created question.
      const newQuestion = mapDatabaseToApp(responseData.data || responseData); // Handle {data: ...} or direct object
      dispatch({ type: ACTIONS.ADD_QUESTION, payload: newQuestion });
      console.log('Question added via API:', newQuestion.id);
      
      // Invalidate memory cache
      memoryCache.questions = null; 
      
      return newQuestion;
    } catch (error) {
      console.error('Error in addQuestion:', error);
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

      // 4. Update State
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: questionWithImages });
      console.log('Question updated via API:', question.id);
      
      // Invalidate memory cache
      memoryCache.questions = null;
    } catch (error) {
      console.error('Error in updateQuestion:', error);
      throw error;
    }
  };

  const bulkUpdateQuestions = async (questions) => {
    try {
      console.log(`🔄 Starting bulk update of ${questions.length} questions...`);
      
      // Note: Bulk update logic in API service might fallback to parallel requests.
      // We assume bulk updates don't introduce *new* images usually (just metadata changes),
      // but if they do, we should process them. For performance, we skip image processing check 
      // unless we know images are involved. For now, assuming metadata updates.
      
      // Map all to DB format
      const dbQuestions = questions.map(q => mapAppToDatabase(q));
      
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(dbQuestions);
      
      // Optimistically update local state for all (or rely on API result to determine)
      // Since we don't get individual results easily from the simple parallel implementation without more logic,
      // we'll update all in state.
      questions.forEach(question => {
        dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
      });
      
      console.log(`✅ Bulk update complete: ${successCount} succeeded, ${failedCount} failed`);
      
      // Invalidate memory cache
      memoryCache.questions = null;
      
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

      dispatch({ type: ACTIONS.DELETE_QUESTION, payload: id });
      console.log('Question deleted via API:', id);
      
      // Invalidate memory cache
      memoryCache.questions = null;
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
      // 1. Try Memory Cache first (Instant)
      if (memoryCache.questions) {
        const age = Math.round((Date.now() - memoryCache.timestamp) / 1000);
        console.log(`⚡ Memory cache HIT! ${memoryCache.questions.length} questions (age: ${age}s)`);
        setQuestions(memoryCache.questions);
        return;
      }

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
            return;
          } else {
            console.log('⏳ Persistent cache EXPIRED, fetching fresh data...');
          }
        } catch (e) {
          console.error('Error parsing cache:', e);
        }
      }

      try {
        console.log('📡 Fetching questions from API...');
        // We fetch all questions via the API now
        const allQuestions = await questionApi.fetchAllQuestions();

        if (allQuestions.length > 0) {
          const mappedQuestions = allQuestions.map(mapDatabaseToApp);
          setQuestions(mappedQuestions);
          saveToCache(mappedQuestions); // Save to cache
          console.log(`✅ Successfully loaded ${mappedQuestions.length} questions from API`);
        }
      } catch (error) {
        console.error('Error loading questions from API:', error);
      }
    };

    loadQuestionsFromDatabase();
  }, []);

  // Function to manually refresh questions from API
  const refreshQuestions = async () => {
    try {
      console.log('🔄 Manually refreshing questions (API)...');
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
    // 1. Optimistic Local Update
    const numericIds = questionIds.map(id => parseInt(id));
    const idSet = new Set(questionIds.map(String));
    
    const updatedQuestionsForState = state.questions.map(q => 
        idSet.has(String(q.id)) ? { ...q, inReviewQueue: inQueue } : q
    );
    
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: updatedQuestionsForState });

    try {
      console.log(`📋 Bulk setting review queue to ${inQueue} for ${questionIds.length} questions...`);
      
      // Update in API using bulk update logic (fallback to loop in service)
      const updates = numericIds.map(id => ({ id, in_review_queue: inQueue }));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(updates);
      
      if (memoryCache.questions) {
          memoryCache.questions = memoryCache.questions.map(q => 
              idSet.has(String(q.id)) ? { ...q, inReviewQueue: inQueue } : q
          );
      }

      return { successCount, failedCount };
    } catch (err) {
      console.error('Exception in bulkReviewQueue:', err);
      return { successCount: 0, failedCount: questionIds.length };
    }
  };

  const bulkFlagQuestions = async (questionIds, flagged) => {
    // 1. Optimistic Local Update
    const numericIds = questionIds.map(id => parseInt(id));
    const idSet = new Set(questionIds.map(String));
    
    const updatedQuestionsForState = state.questions.map(q => 
        idSet.has(String(q.id)) ? { ...q, isFlagged: flagged } : q
    );
    
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: updatedQuestionsForState });

    try {
      console.log(`🚩 Bulk flagging ${questionIds.length} questions to ${flagged}...`);
      
      const updates = numericIds.map(id => ({ id, is_flagged: flagged }));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(updates);
      
      if (memoryCache.questions) {
          memoryCache.questions = memoryCache.questions.map(q => 
              idSet.has(String(q.id)) ? { ...q, isFlagged: flagged } : q
          );
      }

      return { successCount, failedCount };
    } catch (err) {
      console.error('Exception in bulkFlagQuestions:', err);
      return { successCount: 0, failedCount: questionIds.length };
    }
  };

  const bulkVerifyQuestions = async (questionIds, verified) => {
    // 1. Optimistic Local Update
    const numericIds = questionIds.map(id => parseInt(id));
    const idSet = new Set(questionIds.map(String));
    
    const updatedQuestionsForState = state.questions.map(q => 
        idSet.has(String(q.id)) ? { ...q, isVerified: verified } : q
    );
    
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: updatedQuestionsForState });

    try {
      console.log(`✅ Bulk verifying ${questionIds.length} questions to ${verified}...`);
      
      const updates = numericIds.map(id => ({ id, is_verified: verified }));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(updates);
      
      if (memoryCache.questions) {
          memoryCache.questions = memoryCache.questions.map(q => 
              idSet.has(String(q.id)) ? { ...q, isVerified: verified } : q
          );
      }

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
    supabaseClient, // Exposed for direct storage access if needed elsewhere
    setQuestions,
    addQuestion,
    updateQuestion,
    bulkUpdateQuestions,
    deleteQuestion,
    fetchQuestionsByIds,
    setFilters,
    setEditingQuestion,
    setAuthenticated,
    updateStats,
    refreshQuestions,
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
