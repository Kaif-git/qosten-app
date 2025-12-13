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

// Context provider component
export function QuestionProvider({ children }) {
  const [state, dispatch] = useReducer(questionReducer, initialState);

  // Actions
  const setQuestions = (questions) => {
    dispatch({ type: ACTIONS.SET_QUESTIONS, payload: questions });
    updateStats(questions);
  };

  const addQuestion = async (question) => {
    // Check for duplicate questions
    const isDuplicate = checkDuplicate(question);
    if (isDuplicate) {
      throw new Error('Duplicate question detected. This question already exists in the question bank.');
    }
    
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
      const dbQuestion = mapAppToDatabase({ ...question, id: uniqueId });
      
      const { data, error } = await supabaseClient
        .from('questions_duplicate')
        .insert([dbQuestion])
        .select();

      if (error) {
        console.error('Error adding question to database:', error);
        // Check if it's a duplicate key constraint violation
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          throw new Error('Duplicate question detected in database');
        }
        throw new Error('Failed to add question to database');
      }

      if (data && data[0]) {
        const newQuestion = mapDatabaseToApp(data[0]);
        dispatch({ type: ACTIONS.ADD_QUESTION, payload: newQuestion });
        console.log('Question added to database:', newQuestion.id);
        return newQuestion;
      }
    } catch (error) {
      console.error('Error in addQuestion:', error);
      throw error;
    }
  };

  const checkDuplicate = (newQuestion) => {
    // Get the question text based on question type
    const newQuestionText = (newQuestion.questionText || newQuestion.question || '').trim().toLowerCase();
    
    if (!newQuestionText) {
      return false;
    }

    // Check if a similar question already exists
    return state.questions.some(existingQuestion => {
      const existingQuestionText = (existingQuestion.questionText || existingQuestion.question || '').trim().toLowerCase();
      
      // Check if question text matches and type matches
      return existingQuestionText === newQuestionText && 
             existingQuestion.type === newQuestion.type;
    });
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
          
          const { error } = await supabaseClient
            .from('questions_duplicate')
            .update(dbQuestion)
            .eq('id', questionId);
          
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
      questionText: dbQuestion.question_text || dbQuestion.question,
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
      linkedImageParentId: dbQuestion.linked_image_parent_id,
      createdAt: dbQuestion.created_at
    };
  };

  // Helper function to map app question to database format
  const mapAppToDatabase = (appQuestion) => {
    const dbQuestion = {
      type: appQuestion.type,
      subject: appQuestion.subject,
      chapter: appQuestion.chapter,
      lesson: appQuestion.lesson || 'N/A',
      board: appQuestion.board || 'N/A',
      language: appQuestion.language || 'en',
      question: appQuestion.question || appQuestion.questionText,
      question_text: appQuestion.questionText || appQuestion.question,
      options: appQuestion.options,
      correct_answer: appQuestion.correctAnswer,
      answer: appQuestion.answer,
      parts: appQuestion.parts,
      image: appQuestion.image,
      answerimage1: appQuestion.answerimage1,
      answerimage2: appQuestion.answerimage2,
      explanation: appQuestion.explanation,
      tags: appQuestion.tags || [],
      is_quizzable: appQuestion.isQuizzable !== undefined ? appQuestion.isQuizzable : true,
      is_flagged: appQuestion.isFlagged || false,
      linked_image_parent_id: appQuestion.linkedImageParentId,
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
      if (!supabaseClient) {
        console.warn('Supabase client not initialized. Falling back to localStorage.');
        // Fallback to localStorage if Supabase is not configured
        const savedQuestions = localStorage.getItem('questionBank');
        if (savedQuestions) {
          try {
            const questions = JSON.parse(savedQuestions);
            setQuestions(questions);
          } catch (error) {
            console.error('Error parsing saved questions:', error);
          }
        }
        return;
      }

      try {
        console.log('Starting to fetch all questions from database...');
        let allQuestions = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        // Fetch questions in batches to overcome the 1000 row limit
        while (hasMore) {
          const { data, error, count } = await supabaseClient
            .from('questions_duplicate')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1);

          if (error) {
            console.error('Error fetching questions from database:', error);
            break;
          }

          if (data) {
            allQuestions = [...allQuestions, ...data];
            console.log(`Fetched batch: ${data.length} questions (total so far: ${allQuestions.length})`);
            
            // Check if there are more questions to fetch
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        if (allQuestions.length > 0) {
          const mappedQuestions = allQuestions.map(mapDatabaseToApp);
          setQuestions(mappedQuestions);
          console.log(`Successfully loaded ${mappedQuestions.length} questions from database`);
        } else {
          console.log('No questions found in database');
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
      console.log('Manually refreshing questions from database...');
      let allQuestions = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabaseClient
          .from('questions_duplicate')
          .select('*', { count: 'exact' })
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
        console.log(`Successfully refreshed ${mappedQuestions.length} questions`);
      }
    } catch (error) {
      console.error('Error refreshing questions:', error);
    }
  };

  const toggleQuestionFlag = async (questionId) => {
    const question = state.questions.find(q => q.id === questionId);
    if (!question) return;
    
    const updatedQuestion = { ...question, isFlagged: !question.isFlagged };
    await updateQuestion(updatedQuestion);
  };

  const bulkFlagQuestions = async (questionIds, flagged) => {
    const questionsToUpdate = state.questions.filter(q => questionIds.includes(q.id));
    const updatedQuestions = questionsToUpdate.map(q => ({ ...q, isFlagged: flagged }));
    return await bulkUpdateQuestions(updatedQuestions);
  };

  const value = {
    ...state,
    supabaseClient,
    setQuestions,
    addQuestion,
    updateQuestion,
    bulkUpdateQuestions,
    deleteQuestion,
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