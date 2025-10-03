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
    isQuizzable: '',
    language: ''
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

  const addQuestion = (question) => {
    const newQuestion = { ...question, id: Date.now().toString() };
    dispatch({ type: ACTIONS.ADD_QUESTION, payload: newQuestion });
    return newQuestion;
  };

  const updateQuestion = (question) => {
    dispatch({ type: ACTIONS.UPDATE_QUESTION, payload: question });
  };

  const deleteQuestion = (id) => {
    dispatch({ type: ACTIONS.DELETE_QUESTION, payload: id });
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

  // Load questions from localStorage on mount
  useEffect(() => {
    const savedQuestions = localStorage.getItem('questionBank');
    if (savedQuestions) {
      try {
        const questions = JSON.parse(savedQuestions);
        setQuestions(questions);
      } catch (error) {
        console.error('Error parsing saved questions:', error);
      }
    }
  }, []);

  // Save questions to localStorage whenever questions change
  useEffect(() => {
    if (state.questions.length > 0) {
      localStorage.setItem('questionBank', JSON.stringify(state.questions));
    }
  }, [state.questions]);

  const value = {
    ...state,
    supabaseClient,
    setQuestions,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    setFilters,
    setEditingQuestion,
    setAuthenticated,
    updateStats
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