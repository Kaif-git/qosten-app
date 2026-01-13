import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
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
          q.id == action.payload.id ? action.payload : q
        )
      };
    case ACTIONS.DELETE_QUESTION:
      return {
        ...state,
        questions: state.questions.filter(q => q.id != action.payload)
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

/**
 * Maps database question format to App format
 */
export const mapDatabaseToApp = (q) => {
  if (!q) return null;
  
  const questionText = q.question_text || q.questionText || q.text || q.question || '';
  const imageUrl = q.image_url || q.imageUrl || q.image || null;

  // Basic question structure
  const question = {
    id: q.id,
    type: q.type || 'mcq',
    text: questionText,
    questionText: questionText,
    subject: q.subject || 'N/A',
    chapter: q.chapter || 'N/A',
    lesson: q.lesson || 'N/A',
    board: q.board || 'N/A',
    language: q.language || 'english',
    imageUrl: imageUrl, // Canonical URL from DB
    image: imageUrl,    // Local working copy/display
    isFlagged: !!(q.is_flagged || q.isFlagged),
    isVerified: !!(q.is_verified || q.isVerified),
    inReviewQueue: !!(q.in_review_queue || q.inReviewQueue),
    createdAt: q.created_at || q.createdAt
  };

  // Add MCQ specific fields
  if (q.type === 'mcq') {
    let opts = q.options;
    if (typeof opts === 'string') {
        try { opts = JSON.parse(opts); } catch (e) { opts = []; }
    }
    question.options = Array.isArray(opts) 
      ? opts.map(opt => ({
          label: opt.label || '',
          text: opt.text || '',
          image: opt.image || opt.image_url || null,
          isCorrect: !!(opt.is_correct || opt.isCorrect)
        }))
      : [];
    question.explanation = q.explanation || '';
    question.correctAnswer = q.correct_answer || q.correctAnswer || '';
  }

  // Add CQ specific fields
  if (q.type === 'cq') {
    question.stem = q.stem || questionText;
    
    // Robust parsing for parts
    let rawParts = q.parts;
    if (typeof rawParts === 'string') {
        try { 
            rawParts = JSON.parse(rawParts); 
        } catch (e) { 
            console.error(`Error parsing parts for Q#${q.id}:`, e);
            rawParts = []; 
        }
    }
    
    const mappedParts = Array.isArray(rawParts)
      ? rawParts.map(part => ({
          letter: part.letter || part.label || '',
          label: part.label || part.letter || '',
          text: part.text || '',
          marks: part.marks || 0,
          answer: part.answer || '',
          image: part.image || part.answerImage || part.image_url || null,
          answerImage: part.answerImage || part.image || part.image_url || null
        }))
      : [];

    // Safe hoisting: If column is empty, use the image from parts for display,
    // but don't overwrite the part image itself if the column is null.
    const getImg = (col, letter) => {
        if (col) return col;
        const p = mappedParts.find(part => part.letter?.toLowerCase() === letter);
        return p?.image || p?.answerImage || null;
    };

    // Maintain raw DB values for normalization tool
    question._rawAnswerimage1 = q.answerimage1 !== undefined ? q.answerimage1 : (q.answerImage1 !== undefined ? q.answerImage1 : (q.answer_image_1 !== undefined ? q.answer_image_1 : (q.answer_image1 !== undefined ? q.answer_image1 : null)));
    question._rawAnswerimage2 = q.answerimage2 !== undefined ? q.answerimage2 : (q.answerImage2 !== undefined ? q.answerImage2 : (q.answer_image_2 !== undefined ? q.answer_image_2 : (q.answer_image2 !== undefined ? q.answer_image2 : null)));
    question._rawAnswerimage3 = q.answerimage3 !== undefined ? q.answerimage3 : (q.answerImage3 !== undefined ? q.answerImage3 : (q.answer_image_3 !== undefined ? q.answer_image_3 : (q.answer_image3 !== undefined ? q.answer_image3 : null)));
    question._rawAnswerimage4 = q.answerimage4 !== undefined ? q.answerimage4 : (q.answerImage4 !== undefined ? q.answerImage4 : (q.answer_image_4 !== undefined ? q.answer_image_4 : (q.answer_image4 !== undefined ? q.answer_image4 : null)));

    question.answerimage1 = getImg(question._rawAnswerimage1, 'c');
    question.answerimage2 = getImg(question._rawAnswerimage2, 'd');
    question.answerimage3 = getImg(question._rawAnswerimage3, 'a');
    question.answerimage4 = getImg(question._rawAnswerimage4, 'b');

    // Final parts assignment: Keep existing images but ensure they are available
    question.parts = mappedParts.map(p => {
        const l = p.letter?.toLowerCase();
        let syncedImg = p.image;
        if (l === 'c' && question.answerimage1) syncedImg = question.answerimage1;
        else if (l === 'd' && question.answerimage2) syncedImg = question.answerimage2;
        else if (l === 'a' && question.answerimage3) syncedImg = question.answerimage3;
        else if (l === 'b' && question.answerimage4) syncedImg = question.answerimage4;
        
        return { ...p, image: syncedImg, answerImage: syncedImg };
    });
  }

  // Add SQ specific fields
  if (q.type === 'sq') {
    question.question = questionText;
    question.answer = q.answer || '';
  }

  return question;
};

/**
 * Maps App question format to Database format
 */
const mapAppToDatabase = (q) => {
  if (!q) return null;

  console.log(`📡 mapAppToDatabase: Mapping question ${q.id || 'new'} of type ${q.type}`);
  if (q.type === 'cq') {
      console.log('   CQ Image Columns in App state before mapping:', {
          a1: q.answerimage1,
          a2: q.answerimage2,
          a3: q.answerimage3,
          a4: q.answerimage4
      });
  }

  // Priority to 'image' as it contains the newly uploaded Supabase URL
  const finalImageUrl = q.image || q.imageUrl;
  
  if (finalImageUrl && finalImageUrl.startsWith('http')) {
      console.log(`📡 mapAppToDatabase: Including Supabase URL for main image: ${finalImageUrl.substring(0, 60)}...`);
  }

  const dbQ = {
    id: q.id,
    type: q.type,
    question_text: q.questionText || q.text || q.question || '',
    subject: q.subject,
    chapter: q.chapter,
    lesson: q.lesson,
    board: q.board,
    language: q.language,
    // Redundant image fields for backend compatibility
    image_url: finalImageUrl,
    image: finalImageUrl,
    questionimage: finalImageUrl, 
    is_flagged: !!q.isFlagged,
    is_verified: !!q.isVerified,
    in_review_queue: !!q.inReviewQueue,
    // Hoist answer image columns to top level for robust persistence
    answerimage1: q.answerimage1,
    answer_image_1: q.answerimage1,
    answerImage1: q.answerimage1,
    answer_image1: q.answerimage1,
    AnswerImage1: q.answerimage1,
    answerimage2: q.answerimage2,
    answer_image_2: q.answerimage2,
    answerImage2: q.answerimage2,
    answer_image2: q.answerimage2,
    AnswerImage2: q.answerimage2,
    answerimage3: q.answerimage3,
    answer_image_3: q.answerimage3,
    answerImage3: q.answerimage3,
    answer_image3: q.answerimage3,
    AnswerImage3: q.answerimage3,
    answerimage4: q.answerimage4,
    answer_image_4: q.answerimage4,
    answerImage4: q.answerimage4,
    answer_image4: q.answerimage4,
    AnswerImage4: q.answerimage4
  };

  if (q.type === 'mcq') {
    dbQ.options = (q.options || []).map((opt, idx) => {
      const optImg = opt.image || opt.imageUrl;
      if (optImg && optImg.startsWith('http')) {
          console.log(`📡 mapAppToDatabase: Including Supabase URL for MCQ option ${opt.label}: ${optImg.substring(0, 60)}...`);
      }
      return {
        label: opt.label,
        text: opt.text,
        image: optImg,
        image_url: optImg,
        is_correct: opt.isCorrect || opt.label === q.correctAnswer
      };
    });
    dbQ.explanation = q.explanation;
    dbQ.correct_answer = q.correctAnswer;
  }

  if (q.type === 'cq') {
    dbQ.stem = q.stem || q.questionText || q.text || '';
    
    dbQ.parts = (q.parts || []).map((part, idx) => {
      const partImage = part.image || part.answerImage;
      if (partImage && partImage.startsWith('http')) {
          console.log(`📡 mapAppToDatabase: Including Supabase URL for CQ part ${part.letter}: ${partImage.substring(0, 60)}...`);
      }
      return {
        label: part.label || part.letter,
        letter: part.letter || part.label,
        text: part.text,
        marks: part.marks,
        answer: part.answer,
        image: partImage,
        image_url: partImage
      };
    });
  }

  if (q.type === 'sq') {
    dbQ.answer = q.answer;
  }

  return dbQ;
};

// Context provider component
export function QuestionProvider({ children }) {
  const [state, dispatch] = useReducer(questionReducer, initialState);
  const isFetchingRef = useRef(false);

  // --- 1. Helpers ---

  // Helper to update statistics based on current questions
  const updateStats = useCallback((questions) => {
    if (!questions || !Array.isArray(questions)) return;
    
    const subjects = new Set(questions.map(q => q.subject).filter(Boolean));
    const chapters = new Set(questions.map(q => q.chapter).filter(Boolean));
    
    dispatch({ type: ACTIONS.UPDATE_STATS, payload: {
      total: questions.length,
      subjects: subjects.size,
      chapters: chapters.size
    }});
  }, []);

  // Helper to save to memory cache
  const saveToCache = (questions) => {
    if (!questions) return;
    
    // Update Memory Cache
    memoryCache = {
      questions,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_TTL
    };
    
    // localStorage is disabled for the full questions array to avoid QuotaExceeded errors
    // and the high CPU cost of stringifying large datasets (17k+ questions).
  };

  const refreshHierarchy = useCallback(async () => {
    if (isFetchingRef.current) return;
    try {
      console.log('📡 Refreshing question hierarchy...');
      const hierarchyData = await questionApi.fetchHierarchy();
      dispatch({ type: ACTIONS.SET_HIERARCHY, payload: hierarchyData });
      console.log(`✅ Hierarchy refreshed for ${hierarchyData.length} subjects`);
      return hierarchyData;
    } catch (hErr) {
      console.error('Failed to refresh hierarchy:', hErr);
      return null;
    }
  }, []);

  const uploadImageToSupabase = async (fileOrBase64) => {
    if (!supabase || !fileOrBase64) return null;
    
    // If it's already a public URL, skip upload
    if (typeof fileOrBase64 === 'string' && (fileOrBase64.startsWith('http') && !fileOrBase64.includes('blob:'))) {
        return fileOrBase64;
    }

    console.log('🚀 uploadImageToSupabase: Preparing upload for', typeof fileOrBase64 === 'string' ? fileOrBase64.substring(0, 30) + '...' : 'File object');

    try {
        let fileToUpload = fileOrBase64;
        let mimeType = 'image/jpeg'; 
        
        if (typeof fileOrBase64 === 'string' && (fileOrBase64.startsWith('data:') || fileOrBase64.startsWith('blob:'))) {
            if (fileOrBase64.startsWith('data:')) {
                const matches = fileOrBase64.match(/^data:(.+);base64,/);
                if (matches && matches[1]) {
                    mimeType = matches[1];
                }
            }
            fileToUpload = await base64ToBlob(fileOrBase64);
            console.log('  ✅ Converted string/URL to Blob. Type:', fileToUpload.type, 'Size:', fileToUpload.size);
        }
        
        const ext = mimeType.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const filePath = `${fileName}`; 

        console.log('  📤 Uploading to Supabase bucket "question-images" as', filePath);
        const { error } = await supabase
            .storage
            .from('question-images')
            .upload(filePath, fileToUpload, {
                contentType: mimeType,
                upsert: false
            });

        if (error) {
            console.error('  ❌ Supabase upload error:', error);
            throw error;
        }

        const { data } = supabase
            .storage
            .from('question-images')
            .getPublicUrl(filePath);

        if (!data || !data.publicUrl) {
            throw new Error('Failed to generate public URL after upload');
        }

        console.log('  ✅ Upload successful! URL:', data.publicUrl);
        return data.publicUrl;
    } catch (error) {
        console.error('  ❌ Image upload failed:', error);
        throw error;
    }
  };

  const processQuestionImages = useCallback(async (question) => {
      console.log('🖼️ [QuestionContext] processQuestionImages: Starting for question:', question.id || 'new');
      const q = { ...question };
      
      // 1. Pre-sync: Ensure images are in BOTH parts and legacy columns before processing.
      // This prevents one from wiping the other if only one was set (e.g. in QuestionForm).
      if (q.parts && Array.isArray(q.parts)) {
          console.log('  - Pre-syncing image columns and parts...');
          q.parts = q.parts.map(p => {
              const l = p.letter?.toLowerCase();
              let colImg = null;
              if (l === 'c') colImg = q.answerimage1;
              else if (l === 'd') colImg = q.answerimage2;
              else if (l === 'a') colImg = q.answerimage3;
              else if (l === 'b') colImg = q.answerimage4;
              
              const partImg = p.answerImage || p.image;
              
              // If column has image but part doesn't, sync to part
              if (colImg && !partImg) {
                  console.log(`    -> Part ${l}: Column has image but part doesn't. Syncing to part.`);
                  return { ...p, answerImage: colImg, image: colImg };
              }
              // If part has image but column doesn't, sync to column (handled in Step 2 post-sync)
              return p;
          });
      }

      // 2. Process Main Image
      if (q.image && (q.image.startsWith('data:') || q.image.startsWith('blob:'))) {
          console.log('  - Uploading main image...');
          q.image = await uploadImageToSupabase(q.image);
      }
      
      // 3. Process CQ Parts (uploads any new images)
      if (q.parts && Array.isArray(q.parts)) {
          console.log(`  - Processing ${q.parts.length} CQ parts...`);
          q.parts = await Promise.all(q.parts.map(async (p, idx) => {
              const updatedPart = { ...p };
              const imageToUpload = p.answerImage || p.image;
              if (imageToUpload && (imageToUpload.startsWith('data:') || imageToUpload.startsWith('blob:'))) {
                  console.log(`    - Part ${idx} (${p.letter}): Uploading image...`);
                  const url = await uploadImageToSupabase(imageToUpload);
                  updatedPart.image = url;
                  updatedPart.answerImage = url;
              }
              return updatedPart;
          }));

          // Post-sync: Sync URLs from parts to legacy columns to ensure consistency
          console.log('  - Post-syncing processed URLs from parts to legacy columns...');
          q.parts.forEach(p => {
              const l = p.letter?.toLowerCase();
              if (l === 'c') { q.answerimage1 = p.answerImage; console.log('    -> answerimage1 set'); }
              else if (l === 'd') { q.answerimage2 = p.answerImage; console.log('    -> answerimage2 set'); }
              else if (l === 'a') { q.answerimage3 = p.answerImage; console.log('    -> answerimage3 set'); }
              else if (l === 'b') { q.answerimage4 = p.answerImage; console.log('    -> answerimage4 set'); }
          });
      }
      
      // 4. Process Legacy Answer Images (double check)
      const legacyFields = ['answerimage1', 'answerimage2', 'answerimage3', 'answerimage4'];
      for (const field of legacyFields) {
          if (q[field] && (q[field].startsWith('data:') || q[field].startsWith('blob:'))) {
              console.log(`  - Uploading legacy ${field}...`);
              q[field] = await uploadImageToSupabase(q[field]);
          }
      }

      // 5. Process MCQ Options
      if (q.options && Array.isArray(q.options)) {
          console.log(`  - Processing ${q.options.length} MCQ options...`);
          q.options = await Promise.all(q.options.map(async (opt, idx) => {
              const updatedOpt = { ...opt };
              if (opt.image && (opt.image.startsWith('data:') || opt.image.startsWith('blob:'))) {
                  console.log(`    - Option ${idx} (${opt.label}): Uploading image...`);
                  updatedOpt.image = await uploadImageToSupabase(opt.image);
              }
              return updatedOpt;
          }));
      }
      
      console.log('🖼️ [QuestionContext] processQuestionImages: Finished.');
      return q;
  }, [uploadImageToSupabase]);

  // --- 2. Effects ---

  const lastQuestionsLengthRef = useRef(0);

  // Sync state.questions to cache and update stats whenever questions change
  useEffect(() => {
    if (state.questions && state.questions.length > 0) {
      if (state.questions !== memoryCache.questions) {
        saveToCache(state.questions);
        
        const subjects = new Set(state.questions.map(q => q.subject).filter(Boolean));
        const chapters = new Set(state.questions.map(q => q.chapter).filter(Boolean));
        
        dispatch({ type: ACTIONS.UPDATE_STATS, payload: {
          total: state.questions.length,
          subjects: subjects.size,
          chapters: chapters.size
        }});

        if (state.questions.length !== lastQuestionsLengthRef.current) {
            refreshHierarchy();
            lastQuestionsLengthRef.current = state.questions.length;
        }
      }
    }
  }, [state.questions, refreshHierarchy]);

  // Handle fetching flagged questions when filter is set to 'flagged'
  useEffect(() => {
    if (state.currentFilters.flaggedStatus === 'flagged') {
      const fetchFlagged = async () => {
        try {
          console.log('🚩 Fetching flagged questions from API...');
          const data = await questionApi.fetchFlaggedQuestions();
          const batch = Array.isArray(data) ? data : (data.data || []);
          const mapped = batch.map(mapDatabaseToApp);
          
          dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prev) => {
            const existingIds = new Set(prev.filter(q => q && q.id).map(q => q.id.toString()));
            const newQuestions = mapped.filter(q => q && q.id && !existingIds.has(q.id.toString()));
            
            if (newQuestions.length === 0) {
              console.log('ℹ️ No new flagged questions to add to state.');
              return prev;
            }
            
            console.log(`✅ Adding ${newQuestions.length} new flagged questions to state.`);
            return [...newQuestions, ...prev];
          }});
        } catch (error) {
          console.error('❌ Failed to fetch flagged questions:', error);
        }
      };
      fetchFlagged();
    }
  }, [state.currentFilters.flaggedStatus]);

  // --- 3. Actions ---

  const setQuestions = useCallback((questions) => {
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: questions });
    if (typeof questions !== 'function') {
      updateStats(questions);
      saveToCache(questions);
    }
  }, [updateStats]);

  const clearCache = useCallback(() => {
    memoryCache = { questions: null, timestamp: null, expiresAt: null };
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Cache cleared');
  }, []);

  const addQuestion = useCallback(async (question) => {
    try {
      const questionWithImages = await processQuestionImages(question);
      const dbQuestion = mapAppToDatabase(questionWithImages);
      const responseData = await questionApi.createQuestion(dbQuestion);
      
      console.log('📥 [QuestionContext] addQuestion - responseData:', responseData);
      
      // Captures ID from various common response structures
      const newId = responseData.id || 
                    responseData.question_id || 
                    (responseData.data && (responseData.data.id || responseData.data.question_id)) || 
                    (responseData.question && (responseData.question.id || responseData.question.question_id)) ||
                    dbQuestion.id;
      
      console.log(`📡 [QuestionContext] Captured new ID: ${newId}`);
      
      const newQuestion = { ...questionWithImages, id: newId };
      
      dispatch({ type: ACTIONS.ADD_QUESTION, payload: newQuestion });
      
      dispatch({ type: ACTIONS.UPDATE_STATS, payload: (prevStats) => ({
        ...prevStats,
        total: prevStats.total + 1
      })});

      refreshHierarchy();
      return newQuestion;
    } catch (error) {
      console.error('Error in addQuestion:', error);
      throw error;
    }
  }, [refreshHierarchy, processQuestionImages]);

  const bulkAddQuestions = useCallback(async (questions, onProgress) => {
    try {
      console.log(`🚀 Starting bulk add of ${questions.length} questions...`);
      const results = { successCount: 0, failedCount: 0, errors: [] };
      const CHUNK_SIZE = 100;
      const total = questions.length;
      const allNewQuestions = [];

      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = questions.slice(i, i + CHUNK_SIZE);
        const processedChunk = await Promise.all(chunk.map(async q => {
          try {
            return await processQuestionImages(q);
          } catch (e) {
            console.error(`Error processing images for question ${q.id}:`, e);
            return q;
          }
        }));

        const dbChunk = processedChunk.map(mapAppToDatabase);
        const batchResults = await questionApi.bulkCreateQuestions(dbChunk);
        results.successCount += batchResults.successCount;
        results.failedCount += batchResults.failedCount;
        results.errors.push(...batchResults.errors);
        
        console.log(`📥 [QuestionContext] bulkAddQuestions - batch results:`, batchResults.questions);

        // Merge the IDs back into our processed questions
        if (batchResults.questions) {
            batchResults.questions.forEach((dbQ, idx) => {
                const sourceQ = processedChunk[idx];
                if (sourceQ) {
                    const capturedId = dbQ.id || dbQ.question_id || (dbQ.data && dbQ.data.id);
                    console.log(`   -> Q#${idx} assigned ID: ${capturedId}`);
                    allNewQuestions.push({ ...sourceQ, id: capturedId });
                }
            });
        }

        if (onProgress) onProgress(Math.min(i + CHUNK_SIZE, total), total);
      }

      if (allNewQuestions.length > 0) {
          dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prev) => [...allNewQuestions, ...prev] });
      } else {
          await refreshHierarchy();
      }
      
      console.log(`🚀 bulkAddQuestions: Finished. Success: ${results.successCount}, Failed: ${results.failedCount}`);
      return results;
    } catch (error) {
      console.error('Error in bulkAddQuestions:', error);
      throw error;
    }
  }, [refreshHierarchy, processQuestionImages]);

  const refreshQuestions = useCallback(async () => {
    try {
      console.log('🔄 Manually refreshing questions (API)...');
      refreshHierarchy();
      const allQuestions = await questionApi.fetchAllQuestions();
      if (allQuestions && allQuestions.length > 0) {
        // Handle both direct array and {value: [...]} response
        const batch = Array.isArray(allQuestions) ? allQuestions : (allQuestions.value || allQuestions.data || []);
        const mappedQuestions = batch.map(mapDatabaseToApp);
        dispatch({ type: ACTIONS.SET_QUESTIONS, payload: mappedQuestions });
        console.log(`✅ Successfully refreshed ${mappedQuestions.length} questions`);
      }
    } catch (error) {
      console.error('Error refreshing questions:', error);
    }
  }, [refreshHierarchy]);

  const batchAddQuestions = useCallback(async (questions, onProgress) => {
    try {
      console.log(`🚀 Starting batch add of ${questions.length} questions...`);
      const processed = await Promise.all(questions.map(q => processQuestionImages(q)));
      const dbQuestions = processed.map(q => mapAppToDatabase(q));
      const result = await questionApi.batchCreateQuestions(dbQuestions, onProgress);
      await refreshQuestions();
      refreshHierarchy();
      return result;
    } catch (error) {
      console.error('Error in batchAddQuestions:', error);
      throw error;
    }
  }, [refreshHierarchy, refreshQuestions, processQuestionImages]);

  const updateQuestion = useCallback(async (question) => {
    try {
      const questionWithImages = await processQuestionImages(question);
      const dbQuestion = mapAppToDatabase(questionWithImages);
      const questionId = parseInt(question.id);
      await questionApi.updateQuestion(questionId, dbQuestion);
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: questionWithImages });
      refreshHierarchy();
      return questionWithImages;
    } catch (error) {
      console.error('Error in updateQuestion:', error);
      throw error;
    }
  }, [refreshHierarchy, processQuestionImages]);

  const bulkUpdateQuestions = useCallback(async (questions) => {
    try {
      console.log(`🔄 Starting bulk update of ${questions.length} questions...`);
      const processed = await Promise.all(questions.map(q => processQuestionImages(q)));
      const dbQuestions = processed.map(q => mapAppToDatabase(q));
      const { successCount, failedCount } = await questionApi.bulkUpdateQuestions(dbQuestions);
      
      const updateMap = new Map(processed.filter(q => q && q.id).map(q => [q.id.toString(), q]));
      dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          return prevQuestions.map(q => {
              if (!q || !q.id) return q;
              const improved = updateMap.get(q.id.toString());
              return improved ? { ...q, ...improved } : q;
          });
      }});
      
      refreshHierarchy();
      console.log(`✅ Bulk update complete: ${successCount} succeeded, ${failedCount} failed`);
      return { successCount, failedCount };
    } catch (error) {
      console.error('Error in bulkUpdateQuestions:', error);
      throw error;
    }
  }, [refreshHierarchy, processQuestionImages]);

  const deleteQuestion = useCallback(async (id) => {
    if (id === null || id === undefined) {
        console.error('❌ deleteQuestion: ID is null or undefined!');
        return;
    }
    
    try {
      console.log(`🗑️ [QuestionContext] deleteQuestion: ID: ${id}`);
      await questionApi.deleteQuestion(id);
      dispatch({ type: ACTIONS.DELETE_QUESTION, payload: id });
      refreshHierarchy();
      console.log('✅ Question deleted successfully:', id);
    } catch (error) {
      console.error('❌ Error in deleteQuestion:', error);
      throw error;
    }
  }, [refreshHierarchy]);

  const setFilters = useCallback((filters) => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
  }, []);

  const setEditingQuestion = useCallback((question) => {
    dispatch({ type: ACTIONS.SET_EDITING_QUESTION, payload: question });
  }, []);

  const setAuthenticated = useCallback((isAuth) => {
    dispatch({ type: ACTIONS.SET_AUTHENTICATED, payload: isAuth });
  }, []);

  const fetchMoreQuestions = useCallback(async (forcedPage = null) => {
    if (isFetchingRef.current && forcedPage === null) return;
    
    try {
      if (forcedPage === null) isFetchingRef.current = true;
      const BATCH_SIZE = 500;
      const nextPage = forcedPage !== null ? forcedPage : Math.floor(state.questions.length / BATCH_SIZE);
      
      console.log(`📡 Fetching Page ${nextPage}...`);
      const response = await questionApi.fetchQuestions({
        limit: BATCH_SIZE,
        page: nextPage
      });
      
      const batch = Array.isArray(response) ? response : (response.data || []);
      if (batch.length > 0) {
        const mappedBatch = batch.map(mapDatabaseToApp);
        dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
          const existingIds = new Set(prevQuestions.filter(q => q && q.id).map(q => q.id.toString()));
          const uniqueNewBatch = mappedBatch.filter(q => q && q.id && !existingIds.has(q.id.toString()));
          return uniqueNewBatch.length > 0 ? [...prevQuestions, ...uniqueNewBatch] : prevQuestions;
        }});
        return batch.length; 
      }
      return 0;
    } catch (error) {
      console.error('Error fetching more questions:', error);
      throw error;
    } finally {
      if (forcedPage === null) isFetchingRef.current = false;
    }
  }, [state.questions.length]);

  const fetchAllRemaining = useCallback(async (onProgress) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    let totalAdded = 0;
    let hasMore = true;
    const BATCH_SIZE = 500;
    let currentPage = Math.floor(state.questions.length / BATCH_SIZE);
    
    try {
      while (hasMore) {
        const batchSizeReceived = await fetchMoreQuestions(currentPage);
        if (batchSizeReceived > 0) {
          totalAdded += batchSizeReceived;
          if (onProgress) onProgress(totalAdded);
          currentPage++;
          if (batchSizeReceived < BATCH_SIZE) hasMore = false;
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          hasMore = false;
        }
      }
    } catch (error) {
      console.error('Error during Fetch All:', error);
    } finally {
      isFetchingRef.current = false;
    }
    return totalAdded;
  }, [fetchMoreQuestions, state.questions.length]);

  const toggleQuestionFlag = useCallback(async (questionId) => {
    const question = state.questions.find(q => q && q.id && q.id.toString() === (questionId ? questionId.toString() : ''));
    if (!question) return;
    
    const newFlaggedStatus = !question.isFlagged;
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: { ...question, isFlagged: newFlaggedStatus } });

    try {
      await questionApi.updateQuestion(parseInt(questionId), { is_flagged: newFlaggedStatus });
    } catch (err) {
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  }, [state.questions]);

  const toggleQuestionVerification = useCallback(async (questionId) => {
    const question = state.questions.find(q => q && q.id && q.id.toString() === (questionId ? questionId.toString() : ''));
    if (!question) return;
    
    const newVerifiedStatus = !question.isVerified;
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: { ...question, isVerified: newVerifiedStatus } });

    try {
      await questionApi.updateQuestion(parseInt(questionId), { is_verified: newVerifiedStatus });
    } catch (err) {
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  }, [state.questions]);

  const toggleReviewQueue = useCallback(async (questionId) => {
    const question = state.questions.find(q => q && q.id && q.id.toString() === (questionId ? questionId.toString() : ''));
    if (!question) return;
    
    const newQueueStatus = !question.inReviewQueue;
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: { ...question, inReviewQueue: newQueueStatus } });

    try {
      await questionApi.updateQuestion(parseInt(questionId), { in_review_queue: newQueueStatus });
    } catch (err) {
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  }, [state.questions]);

  const bulkReviewQueue = useCallback(async (questionIds, inQueue) => {
    const idSet = new Set(questionIds.map(String));
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
        return prevQuestions.map(q => idSet.has(String(q.id)) ? { ...q, inReviewQueue: inQueue } : q);
    }});

    try {
      const numericIds = questionIds.map(id => parseInt(id));
      const updates = numericIds.map(id => ({ id, in_review_queue: inQueue }));
      return await questionApi.bulkUpdateQuestions(updates);
    } catch (err) {
      return { successCount: 0, failedCount: questionIds.length };
    }
  }, []);

  const bulkFlagQuestions = useCallback(async (questionIds, flagged) => {
    const idSet = new Set(questionIds.map(String));
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
        return prevQuestions.map(q => idSet.has(String(q.id)) ? { ...q, isFlagged: flagged } : q);
    }});

    try {
      const numericIds = questionIds.map(id => parseInt(id));
      const updates = numericIds.map(id => ({ id, is_flagged: flagged }));
      return await questionApi.bulkUpdateQuestions(updates);
    } catch (err) {
      return { successCount: 0, failedCount: questionIds.length };
    }
  }, []);

  const bulkVerifyQuestions = useCallback(async (questionIds, verified) => {
    const idSet = new Set(questionIds.map(String));
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: (prevQuestions) => {
        return prevQuestions.map(q => idSet.has(String(q.id)) ? { ...q, isVerified: verified } : q);
    }});

    try {
      const numericIds = questionIds.map(id => parseInt(id));
      const updates = numericIds.map(id => ({ id, is_verified: verified }));
      return await questionApi.bulkUpdateQuestions(updates);
    } catch (err) {
      return { successCount: 0, failedCount: questionIds.length };
    }
  }, []);

  const fetchQuestionsByIds = useCallback(async (ids) => {
    if (ids.length === 0) return [];
    try {
      const data = await questionApi.fetchQuestionsByIds(ids);
      return data.map(mapDatabaseToApp);
    } catch (error) {
      return [];
    }
  }, []);

  const value = useMemo(() => ({
    ...state,
    supabaseClient: supabase,
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
  }), [
    state, 
    setQuestions, clearCache, addQuestion, bulkAddQuestions, batchAddQuestions, 
    updateQuestion, bulkUpdateQuestions, deleteQuestion, fetchQuestionsByIds, 
    setFilters, setEditingQuestion, setAuthenticated, refreshQuestions, 
    refreshHierarchy, fetchMoreQuestions, fetchAllRemaining, toggleQuestionFlag, 
    bulkFlagQuestions, toggleQuestionVerification, bulkVerifyQuestions, 
    toggleReviewQueue, bulkReviewQueue
  ]);

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
