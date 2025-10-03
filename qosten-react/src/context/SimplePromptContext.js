import React, { createContext, useContext, useState, useEffect } from 'react';

// Create context
const PromptContext = createContext();

// Context provider component
export function PromptProvider({ children }) {
  const [prompts, setPrompts] = useState([]);
  const [selectedPromptId, setSelectedPromptId] = useState(null);

  // Load prompts from localStorage on mount
  useEffect(() => {
    const savedPrompts = localStorage.getItem('promptLibrary');
    if (savedPrompts) {
      try {
        const parsedPrompts = JSON.parse(savedPrompts);
        setPrompts(parsedPrompts);
      } catch (error) {
        console.error('Error loading prompts:', error);
      }
    }
  }, []);

  // Save prompts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('promptLibrary', JSON.stringify(prompts));
  }, [prompts]);

  // Add a new prompt
  const addPrompt = (name, text) => {
    const newPrompt = {
      id: Date.now().toString(),
      name: name.trim(),
      text: text.trim(),
      createdAt: new Date().toISOString()
    };
    setPrompts(prev => [...prev, newPrompt]);
    return newPrompt;
  };

  // Update an existing prompt
  const updatePrompt = (id, name, text) => {
    setPrompts(prev => prev.map(p => 
      p.id === id 
        ? { ...p, name: name.trim(), text: text.trim(), updatedAt: new Date().toISOString() }
        : p
    ));
  };

  // Delete a prompt
  const deletePrompt = (id) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
    if (selectedPromptId === id) {
      setSelectedPromptId(null);
    }
  };

  // Select a prompt
  const selectPrompt = (id) => {
    setSelectedPromptId(id);
  };

  const selectedPrompt = prompts.find(p => p.id === selectedPromptId) || null;

  const value = {
    prompts,
    selectedPromptId,
    selectedPrompt,
    addPrompt,
    updatePrompt,
    deletePrompt,
    selectPrompt
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