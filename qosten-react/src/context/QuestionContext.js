import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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
    flaggedStatus: '' // 'all', 'flagged', 'unflagged'
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

  // Actions
  const setQuestions = (questions) => {
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: questions });
    updateStats(questions);
  };

  const addQuestion = async (question) => {
    if (!supabaseClient) {
      // Fallback to local storage
      const newQuestion = { ...question, id: Date.now().toString() };
      dispatch({ type: ACTIONS.ADD_QUESTION, payload: newQuestion });
      return newQuestion;
    }

    try {
      // Generate a unique ID using timestamp + random number
      // This avoids race conditions when inserting multiple questions in parallel
      const uniqueId = Date.now() + Math.floor(Math.random() * 10000);
      
      // Map to database format with the generated ID
      let dbQuestion = mapAppToDatabase({ ...question, id: uniqueId });
      
      let { data, error } = await supabaseClient
        .from('questions_duplicate')
        .insert([dbQuestion])
        .select();

      // Handle duplicate key constraint violation by appending a unique suffix
      if (error && (error.code === '23505' || error.message?.includes('duplicate key'))) {
        console.warn('Duplicate question detected, appending unique suffix:', error.details);
        // Append a unique suffix to both question and question_text fields to make them unique
        const suffix = ` [${uniqueId}]`;
        dbQuestion.question = (dbQuestion.question || '') + suffix;
        
        // Ensure we append to question_text even if it's an empty string
        if (dbQuestion.hasOwnProperty('question_text')) {
          dbQuestion.question_text = (dbQuestion.question_text || '') + suffix;
        }
        
        // Retry with the modified fields
        const retryResult = await supabaseClient
          .from('questions_duplicate')
          .insert([dbQuestion])
          .select();
        
        if (retryResult.error) {
          console.error('Error adding question after retry:', retryResult.error);
          throw new Error('Failed to add question to database');
        }
        
        data = retryResult.data;
        error = null;
      }

      if (error) {
        console.error('Error adding question to database:', error);
        throw new Error('Failed to add question to database');
      }

      if (data && data[0]) {
        const newQuestion = mapDatabaseToApp(data[0]);
        dispatch({ type: ACTIONS.ADD_QUESTION, payload: newQuestion });
        console.log('Question added to database:', newQuestion.id);
        
        // Invalidate memory cache so next load fetches fresh data or we'd need to update it
        memoryCache.questions = null; 
        
        return newQuestion;
      }
    } catch (error) {
      console.error('Error in addQuestion:', error);
      throw error;
    }
  };


  const updateQuestion = async (question) => {
    if (!supabaseClient) {
      // Fallback to local state only
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
      return;
    }

    try {
      const dbQuestion = mapAppToDatabase(question);
      const questionId = parseInt(question.id);

      const { error } = await supabaseClient
        .from('questions_duplicate')
        .update(dbQuestion)
        .eq('id', questionId);

      if (error) {
        console.error('Error updating question in database:', error);
        throw new Error('Failed to update question in database');
      }

      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
      console.log('Question updated in database:', question.id);
      
      // Invalidate memory cache
      memoryCache.questions = null;
    } catch (error) {
      console.error('Error in updateQuestion:', error);
      throw error;
    }
  };

  const bulkUpdateQuestions = async (questions) => {
    if (!supabaseClient) {
      // Fallback to local state only
      questions.forEach(question => {
        dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
      });
      return { successCount: questions.length, failedCount: 0 };
    }

    try {
      console.log(`🔄 Starting bulk update of ${questions.length} questions...`);
      
      // Process in batches of 50 for optimal performance
      const BATCH_SIZE = 50;
      let successCount = 0;
      let failedCount = 0;
      
      for (let i = 0; i < questions.length; i += BATCH_SIZE) {
        const batch = questions.slice(i, i + BATCH_SIZE);
        
        // Prepare batch update operations
        const updatePromises = batch.map(async (question) => {
          const dbQuestion = mapAppToDatabase(question);
          const questionId = parseInt(question.id);
          
          let { error } = await supabaseClient
            .from('questions_duplicate')
            .update(dbQuestion)
            .eq('id', questionId);
          
          // Handle duplicate key constraint violation by appending a unique suffix
          if (error && (error.code === '23505' || error.message?.includes('duplicate key'))) {
            console.warn(`Duplicate key error for question ${questionId}, retrying with suffix...`);
            const uniqueSuffix = ` [${Date.now() + Math.floor(Math.random() * 1000)}]`;
            
            // Append suffix to unique fields
            dbQuestion.question = dbQuestion.question + uniqueSuffix;
            if (dbQuestion.question_text) {
                dbQuestion.question_text = dbQuestion.question_text + uniqueSuffix;
            }
            
            // Retry update
            const retryResult = await supabaseClient
                .from('questions_duplicate')
                .update(dbQuestion)
                .eq('id', questionId);
                
            error = retryResult.error;
          }

          if (error) {
            console.error(`Error updating question ${questionId}:`, error);
            return { success: false, error, questionId };
          }
          
          return { success: true, questionId };
        });
        
        // Execute batch in parallel
        const results = await Promise.allSettled(updatePromises);
        
        // Process results
        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
            const question = batch[idx];
            dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
          } else {
            failedCount++;
          }
        });
        
        console.log(`  ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successCount} succeeded, ${failedCount} failed`);
      }
      
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
    if (!supabaseClient) {
      // Fallback to local state only
      dispatch({ type: ACTIONS.DELETE_QUESTION, payload: id });
      return;
    }

    try {
      const questionId = parseInt(id);

      const { error } = await supabaseClient
        .from('questions_duplicate')
        .delete()
        .eq('id', questionId);

      if (error) {
        console.error('Error deleting question from database:', error);
        throw new Error('Failed to delete question from database');
      }

      dispatch({ type: ACTIONS.DELETE_QUESTION, payload: id });
      console.log('Question deleted from database:', id);
      
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
      options: dbQuestion.options,
      correctAnswer: dbQuestion.correct_answer,
      answer: dbQuestion.answer,
      parts: dbQuestion.parts,
      image: dbQuestion.image,
      answerimage1: dbQuestion.answerimage1,
      answerimage2: dbQuestion.answerimage2,
      explanation: dbQuestion.explanation,
      tags: dbQuestion.tags || [],
      isQuizzable: dbQuestion.is_quizzable !== undefined ? dbQuestion.is_quizzable : true,
      isFlagged: dbQuestion.is_flagged || false,
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
      // For CQ, we now use the clean text for the question field as well
      // to match the question_text column.
      questionField = qText;
    } else if (type === 'mcq') {
      // For MCQ, we now use the clean text for the question field as well
      // to satisfy the requirement of syncing both columns to be identical.
      questionField = qText;
    } else if (type === 'sq') {
      // For SQ, we now use the clean text for the question field as well
      // to match the question_text column.
      questionField = qText;
    }
    
    // Final safety check for empty question field
    // For CQ, we now allow the question field to be empty (null stem support)
    if (!questionField || questionField === 'MCQ:' || questionField === 'CQ:' || questionField === 'SQ:') {
      if (type !== 'cq') {
        questionField = `ID_${appQuestion.id || Date.now()}`;
      } else {
        // For CQ, if it's strictly just the prefix or empty, let it be empty
        questionField = (questionField === 'CQ:') ? '' : questionField;
      }
    }
    
    console.log(`🛠 mapAppToDatabase for ID ${appQuestion.id}: type=${type}`);
    console.log(`   - DB question column will be: "${questionField.substring(0, 50)}${questionField.length > 50 ? '...' : ''}"`);
    console.log(`   - DB question_text column will be: "${qText.substring(0, 50)}${qText.length > 50 ? '...' : ''}"`);

    const dbQuestion = {
      type: appQuestion.type,
      subject: appQuestion.subject,
      chapter: appQuestion.chapter,
      lesson: appQuestion.lesson || 'N/A',
      board: appQuestion.board || 'N/A',
      language: appQuestion.language || 'en',
      question: questionField,
      question_text: qText, // Always use cleaned text for question_text column
      options: appQuestion.options,
      correct_answer: appQuestion.correctAnswer,
      answer: appQuestion.answer,
      parts: appQuestion.parts,
      image: appQuestion.image,
      answerimage1: appQuestion.answerimage1,
      answerimage2: appQuestion.answerimage2,
      explanation: appQuestion.explanation,
      tags: appQuestion.tags || [],
      is_flagged: appQuestion.isFlagged || false,
      synced: false
    };
    
    // Only include id if it exists (for updates), exclude it for inserts
    if (appQuestion.id) {
      dbQuestion.id = parseInt(appQuestion.id);
    }
    
    return dbQuestion;
  };


  // Load questions from Supabase on mount
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

      if (!supabaseClient) {
        console.warn('Supabase client not initialized.');
        return;
      }

      try {
        console.log('📡 Cache MISS. Starting to fetch all questions from database...');
        let allQuestions = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        // Fetch questions in batches to overcome the 1000 row limit
        while (hasMore) {
          const { data, error } = await supabaseClient
            .from('questions_duplicate')
            .select('id, type, subject, chapter, lesson, board, language, is_flagged, created_at, question', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1);

          if (error) {
            console.error('Error fetching questions from database:', error);
            break;
          }

          if (data) {
            allQuestions = [...allQuestions, ...data];
            console.log(`Fetched batch: ${data.length} questions (total so far: ${allQuestions.length})`);
            
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        if (allQuestions.length > 0) {
          const mappedQuestions = allQuestions.map(mapDatabaseToApp);
          setQuestions(mappedQuestions);
          saveToCache(mappedQuestions); // Save to cache
          console.log(`✅ Successfully loaded ${mappedQuestions.length} questions and updated cache`);
        }
      } catch (error) {
        console.error('Error loading questions:', error);
      }
    };

    loadQuestionsFromDatabase();
  }, []);

  // Function to manually refresh questions from database
  const refreshQuestions = async () => {
    if (!supabaseClient) return;

    try {
      console.log('🔄 Manually refreshing questions (Bypassing cache)...');
      let allQuestions = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseClient
          .from('questions_duplicate')
          .select('id, type, subject, chapter, lesson, board, language, is_flagged, created_at, question', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('Error fetching questions from database:', error);
          break;
        }

        if (data) {
          allQuestions = [...allQuestions, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

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

    if (!supabaseClient) return;

    try {
      // 2. Partial Update in DB
      const { error } = await supabaseClient
        .from('questions_duplicate')
        .update({ is_flagged: newFlaggedStatus })
        .eq('id', parseInt(questionId));

      if (error) {
        console.error('Error toggling flag:', error);
        // Revert on error
        dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
        alert('Failed to update flag status.');
      } else {
        // Update cache to reflect the change
        if (memoryCache.questions) {
             memoryCache.questions = memoryCache.questions.map(q => 
                 q.id === questionId ? updatedQuestion : q
             );
        }
      }
    } catch (err) {
      console.error('Exception toggling flag:', err);
      // Revert on error
      dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
    }
  };

  const bulkFlagQuestions = async (questionIds, flagged) => {
    // 1. Optimistic Local Update
    const numericIds = questionIds.map(id => parseInt(id));
    
    // Create map for fast lookup/update
    const idSet = new Set(questionIds.map(String));
    
    const updatedQuestionsForState = state.questions.map(q => 
        idSet.has(String(q.id)) ? { ...q, isFlagged: flagged } : q
    );
    
    // Only dispatch if something actually changed (optimization)
    // Actually, dispatching replace is cleaner for now
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: updatedQuestionsForState });

    if (!supabaseClient) return { successCount: questionIds.length, failedCount: 0 };

    try {
      console.log(`🚩 Bulk flagging ${questionIds.length} questions to ${flagged}...`);
      
      // 2. Efficient Batch Update in DB
      const { data, error, count } = await supabaseClient
        .from('questions_duplicate')
        .update({ is_flagged: flagged })
        .in('id', numericIds)
        .select('id', { count: 'exact' });

      if (error) {
        console.error('Error in bulk flag update:', error);
        // Revert local state if needed, or just alert. 
        // Re-fetching might be safer than complex revert logic here.
        alert('Failed to update some flags on server.');
        return { successCount: 0, failedCount: questionIds.length };
      }

      console.log(`✅ Bulk flag update successful. Affected rows: ${data?.length || 0}`);
      
      // Update memory cache
      if (memoryCache.questions) {
          memoryCache.questions = memoryCache.questions.map(q => 
              idSet.has(String(q.id)) ? { ...q, isFlagged: flagged } : q
          );
      }

      return { successCount: data?.length || 0, failedCount: questionIds.length - (data?.length || 0) };
    } catch (err) {
      console.error('Exception in bulkFlagQuestions:', err);
      return { successCount: 0, failedCount: questionIds.length };
    }
  };

  const fetchQuestionsByIds = async (ids) => {
    if (!supabaseClient || ids.length === 0) return [];

    try {
      // Fetch in batches
      const BATCH_SIZE = 200;
      let allData = [];

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabaseClient
          .from('questions_duplicate')
          .select('*')
          .in('id', batchIds);

        if (error) {
          console.error('Error fetching batch:', error);
          continue;
        }
        if (data) {
          allData = [...allData, ...data];
        }
      }

      return allData.map(mapDatabaseToApp);
    } catch (error) {
      console.error('Error in fetchQuestionsByIds:', error);
      return [];
    }
  };

  const value = {
    ...state,
    supabaseClient,
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
    bulkFlagQuestions
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