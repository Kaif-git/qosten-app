import React, { useState, useEffect } from 'react';
import { usePrompts } from '../../context/SimplePromptContext';
import './SimplePromptManager.css';

export default function SimplePromptManager() {
  const { prompts, selectedPrompt, addPrompt, updatePrompt, deletePrompt, selectPrompt } = usePrompts();
  
  const [promptName, setPromptName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Update form when a prompt is selected from dropdown
  useEffect(() => {
    if (selectedPrompt) {
      setPromptName(selectedPrompt.name);
      setPromptText(selectedPrompt.text);
      setIsEditing(true);
      setEditingId(selectedPrompt.id);
    }
  }, [selectedPrompt]);

  const handleSave = () => {
    if (!promptName.trim() || !promptText.trim()) {
      alert('Please enter both a name and text for the prompt.');
      return;
    }

    if (isEditing && editingId) {
      updatePrompt(editingId, promptName, promptText);
      alert('Prompt updated successfully!');
    } else {
      addPrompt(promptName, promptText);
      alert('Prompt saved successfully!');
    }

    handleClear();
  };

  const handleDelete = () => {
    if (!editingId) return;
    
    if (window.confirm(`Are you sure you want to delete "${promptName}"?`)) {
      deletePrompt(editingId);
      handleClear();
      alert('Prompt deleted successfully!');
    }
  };

  const handleClear = () => {
    setPromptName('');
    setPromptText('');
    setIsEditing(false);
    setEditingId(null);
    selectPrompt(null);
  };

  const handleSelectChange = (e) => {
    const id = e.target.value;
    if (id) {
      selectPrompt(id);
    } else {
      handleClear();
    }
  };

  const handleCopy = () => {
    if (promptText) {
      navigator.clipboard.writeText(promptText);
      alert('Prompt text copied to clipboard!');
    }
  };

  return (
    <div className="simple-prompt-manager">
      <div className="header">
        <h1>AI Prompt Manager</h1>
        <p>Store and manage your AI prompts</p>
      </div>

      {/* Selector */}
      <div className="panel">
        <h3>Select Prompt</h3>
        <select 
          value={editingId || ''} 
          onChange={handleSelectChange}
          className="prompt-selector"
        >
          <option value="">-- Create New Prompt --</option>
          {prompts.map(prompt => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.name}
            </option>
          ))}
        </select>
        <div className="prompt-count">
          Total Prompts: {prompts.length}
        </div>
      </div>

      {/* Editor */}
      <div className="panel">
        <h3>{isEditing ? 'Edit Prompt' : 'Create New Prompt'}</h3>
        
        <div className="form-group">
          <label htmlFor="promptName">Prompt Name</label>
          <input
            id="promptName"
            type="text"
            placeholder="e.g., MCQ Generator, Math Problems, etc."
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="promptText">Prompt Text</label>
          <textarea
            id="promptText"
            placeholder="Enter your prompt text here..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows="12"
          />
          <div className="char-count">
            {promptText.length} characters
          </div>
        </div>

        <div className="button-group">
          <button onClick={handleSave} className="save-btn">
            {isEditing ? 'Update' : 'Save'} Prompt
          </button>
          
          {promptText && (
            <button onClick={handleCopy} className="secondary">
              Copy Text
            </button>
          )}
          
          {isEditing && (
            <button onClick={handleDelete} className="danger">
              Delete
            </button>
          )}
          
          {(isEditing || promptName || promptText) && (
            <button onClick={handleClear} className="secondary">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Saved Prompts List */}
      {prompts.length > 0 && (
        <div className="panel">
          <h3>Saved Prompts ({prompts.length})</h3>
          <div className="prompts-list">
            {prompts.map(prompt => (
              <div 
                key={prompt.id} 
                className={`prompt-item ${editingId === prompt.id ? 'active' : ''}`}
                onClick={() => selectPrompt(prompt.id)}
              >
                <div className="prompt-item-header">
                  <strong>{prompt.name}</strong>
                  <span className="prompt-item-date">
                    {new Date(prompt.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="prompt-item-preview">
                  {prompt.text.substring(0, 100)}
                  {prompt.text.length > 100 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
