import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabaseClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initial state
const initialState = {
  prompts: [],
  currentFilters: {
    searchText: '',
    promptType: '',
    subject: '',
    gradeLevel: '',
    tags: [],
    isActive: true
  },
  editingPrompt: null,
  loading: false,
  error: null,
  stats: {
    total: 0,
    byType: {},
    bySubject: {}
  }
};

// Action types
const ACTIONS = {
  SET_PROMPTS: 'SET_PROMPTS',
  ADD_PROMPT: 'ADD_PROMPT',
  UPDATE_PROMPT: 'UPDATE_PROMPT',
  DELETE_PROMPT: 'DELETE_PROMPT',
  SET_FILTERS: 'SET_FILTERS',
  SET_EDITING_PROMPT: 'SET_EDITING_PROMPT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  UPDATE_STATS: 'UPDATE_STATS',
  INCREMENT_USAGE: 'INCREMENT_USAGE'
};

// Reducer function
function promptReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_PROMPTS:
      return { ...state, prompts: action.payload, loading: false };
    case ACTIONS.ADD_PROMPT:
      return { ...state, prompts: [...state.prompts, action.payload], loading: false };
    case ACTIONS.UPDATE_PROMPT:
      return {
        ...state,
        prompts: state.prompts.map(p => 
          p.id === action.payload.id ? action.payload : p
        ),
        loading: false
      };
    case ACTIONS.DELETE_PROMPT:
      return {
        ...state,
        prompts: state.prompts.filter(p => p.id !== action.payload),
        loading: false
      };
    case ACTIONS.SET_FILTERS:
      return { ...state, currentFilters: { ...state.currentFilters, ...action.payload } };
    case ACTIONS.SET_EDITING_PROMPT:
      return { ...state, editingPrompt: action.payload };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload, loading: false };
    case ACTIONS.UPDATE_STATS:
      return { ...state, stats: action.payload };
    case ACTIONS.INCREMENT_USAGE:
      return {
        ...state,
        prompts: state.prompts.map(p =>
          p.id === action.payload ? { ...p, usage_count: (p.usage_count || 0) + 1 } : p
        )
      };
    default:
      return state;
  }
}

// Create context
const PromptContext = createContext();

// Context provider component
export function PromptProvider({ children }) {
  const [state, dispatch] = useReducer(promptReducer, initialState);

  // Fetch all prompts from Supabase
  const fetchPrompts = async () => {
    if (!supabaseClient) {
      console.error('Supabase client not initialized');
      return;
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      
      const { data, error } = await supabaseClient
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      dispatch({ type: ACTIONS.SET_PROMPTS, payload: data || [] });
      updateStats(data || []);
    } catch (error) {
      console.error('Error fetching prompts:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
    }
  };

  // Add a new prompt
  const addPrompt = async (prompt) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const { data, error } = await supabaseClient
        .from('prompts')
        .insert([prompt])
        .select()
        .single();

      if (error) throw error;

      dispatch({ type: ACTIONS.ADD_PROMPT, payload: data });
      updateStats([...state.prompts, data]);
      return data;
    } catch (error) {
      console.error('Error adding prompt:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Update an existing prompt
  const updatePrompt = async (id, updates) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const { data, error } = await supabaseClient
        .from('prompts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      dispatch({ type: ACTIONS.UPDATE_PROMPT, payload: data });
      return data;
    } catch (error) {
      console.error('Error updating prompt:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Delete a prompt
  const deletePrompt = async (id) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });

      const { error } = await supabaseClient
        .from('prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      dispatch({ type: ACTIONS.DELETE_PROMPT, payload: id });
    } catch (error) {
      console.error('Error deleting prompt:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      throw error;
    }
  };

  // Get prompts by type
  const getPromptsByType = async (promptType) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await supabaseClient
        .from('prompts')
        .select('*')
        .eq('prompt_type', promptType)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching prompts by type:', error);
      throw error;
    }
  };

  // Get prompts by subject
  const getPromptsBySubject = async (subject) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await supabaseClient
        .from('prompts')
        .select('*')
        .eq('subject', subject)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching prompts by subject:', error);
      throw error;
    }
  };

  // Search prompts
  const searchPrompts = async (searchText) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const { data, error } = await supabaseClient
        .from('prompts')
        .select('*')
        .or(`title.ilike.%${searchText}%,prompt_text.ilike.%${searchText}%`)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error searching prompts:', error);
      throw error;
    }
  };

  // Increment usage count
  const incrementUsage = async (id) => {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    try {
      const prompt = state.prompts.find(p => p.id === id);
      if (!prompt) return;

      const { error } = await supabaseClient
        .from('prompts')
        .update({ usage_count: (prompt.usage_count || 0) + 1 })
        .eq('id', id);

      if (error) throw error;

      dispatch({ type: ACTIONS.INCREMENT_USAGE, payload: id });
    } catch (error) {
      console.error('Error incrementing usage:', error);
    }
  };

  // Replace placeholders in prompt text
  const formatPrompt = (promptText, variables) => {
    let formatted = promptText;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{${key}}`, 'g');
      formatted = formatted.replace(regex, variables[key]);
    });
    return formatted;
  };

  // Set filters
  const setFilters = (filters) => {
    dispatch({ type: ACTIONS.SET_FILTERS, payload: filters });
  };

  // Set editing prompt
  const setEditingPrompt = (prompt) => {
    dispatch({ type: ACTIONS.SET_EDITING_PROMPT, payload: prompt });
  };

  // Update statistics
  const updateStats = (prompts) => {
    const byType = {};
    const bySubject = {};

    prompts.forEach(prompt => {
      // Count by type
      if (prompt.prompt_type) {
        byType[prompt.prompt_type] = (byType[prompt.prompt_type] || 0) + 1;
      }
      // Count by subject
      if (prompt.subject) {
        bySubject[prompt.subject] = (bySubject[prompt.subject] || 0) + 1;
      }
    });

    dispatch({
      type: ACTIONS.UPDATE_STATS,
      payload: {
        total: prompts.length,
        byType,
        bySubject
      }
    });
  };

  // Load prompts on mount
  useEffect(() => {
    fetchPrompts();
  }, []);

  const value = {
    ...state,
    supabaseClient,
    fetchPrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    getPromptsByType,
    getPromptsBySubject,
    searchPrompts,
    incrementUsage,
    formatPrompt,
    setFilters,
    setEditingPrompt
  };

  return (
    <PromptContext.Provider value={value}>
      {children}
    </PromptContext.Provider>
  );
}

// Custom hook to use the context
export function usePrompts() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error('usePrompts must be used within a PromptProvider');
  }
  return context;
}

export default PromptContext;
