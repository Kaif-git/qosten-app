import React, { useState, useEffect } from 'react';
import { usePrompts } from '../../context/PromptContext';
import { useNavigate } from 'react-router-dom';
import { 
  PROMPT_TYPES, 
  SUBJECTS, 
  GRADE_LEVELS, 
  AI_MODELS,
  validatePrompt,
  extractPlaceholders
} from '../../utils/promptUtils';
import './PromptForm.css';

export default function PromptForm() {
  const { editingPrompt, addPrompt, updatePrompt, setEditingPrompt } = usePrompts();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    prompt_text: '',
    prompt_type: 'question_generation',
    subject: '',
    grade_level: '',
    language: 'English',
    tags: [],
    ai_model: '',
    temperature: 0.7,
    max_tokens: 1000,
    is_active: true,
    notes: ''
  });
  
  const [tagInput, setTagInput] = useState('');
  const [placeholders, setPlaceholders] = useState([]);
  const [errors, setErrors] = useState([]);

  // Load editing prompt data on mount
  useEffect(() => {
    if (editingPrompt) {
      setFormData({
        title: editingPrompt.title || '',
        prompt_text: editingPrompt.prompt_text || '',
        prompt_type: editingPrompt.prompt_type || 'question_generation',
        subject: editingPrompt.subject || '',
        grade_level: editingPrompt.grade_level || '',
        language: editingPrompt.language || 'English',
        tags: editingPrompt.tags || [],
        ai_model: editingPrompt.ai_model || '',
        temperature: editingPrompt.temperature || 0.7,
        max_tokens: editingPrompt.max_tokens || 1000,
        is_active: editingPrompt.is_active !== undefined ? editingPrompt.is_active : true,
        notes: editingPrompt.notes || ''
      });
    }
  }, [editingPrompt]);

  // Extract placeholders when prompt text changes
  useEffect(() => {
    if (formData.prompt_text) {
      const extracted = extractPlaceholders(formData.prompt_text);
      setPlaceholders(extracted);
    } else {
      setPlaceholders([]);
    }
  }, [formData.prompt_text]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagInputKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate
    const validation = validatePrompt(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      alert('Please fix the errors:\n' + validation.errors.join('\n'));
      return;
    }

    try {
      if (editingPrompt) {
        await updatePrompt(editingPrompt.id, formData);
        alert('Prompt updated successfully!');
        setEditingPrompt(null);
      } else {
        await addPrompt(formData);
        alert('Prompt added successfully!');
      }
      navigate('/prompts');
    } catch (error) {
      alert('Error saving prompt: ' + error.message);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      setEditingPrompt(null);
      navigate('/prompts');
    }
  };

  const insertPlaceholder = (placeholder) => {
    const textarea = document.getElementById('prompt_text');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.prompt_text;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + `{${placeholder}}` + after;
    
    setFormData(prev => ({ ...prev, prompt_text: newText }));
    
    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + placeholder.length + 2;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  return (
    <div className="prompt-form-container">
      <div className="header">
        <h1>{editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}</h1>
        <button className="secondary" onClick={handleCancel}>
          ← Back to Library
        </button>
      </div>

      {errors.length > 0 && (
        <div className="error-messages">
          <strong>Please fix the following errors:</strong>
          <ul>
            {errors.map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="prompt-form">
        <div className="panel">
          <h3>Basic Information</h3>
          
          <div className="form-group">
            <label htmlFor="title">Prompt Title *</label>
            <input
              id="title"
              type="text"
              placeholder="e.g., Generate MCQ Questions"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="prompt_type">Prompt Type *</label>
            <select
              id="prompt_type"
              value={formData.prompt_type}
              onChange={(e) => handleInputChange('prompt_type', e.target.value)}
              required
            >
              {Object.entries(PROMPT_TYPES).map(([key, value]) => (
                <option key={value} value={value}>
                  {key.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <select
                id="subject"
                value={formData.subject}
                onChange={(e) => handleInputChange('subject', e.target.value)}
              >
                <option value="">Select Subject</option>
                {SUBJECTS.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="grade_level">Grade Level</label>
              <select
                id="grade_level"
                value={formData.grade_level}
                onChange={(e) => handleInputChange('grade_level', e.target.value)}
              >
                <option value="">Select Grade</option>
                {GRADE_LEVELS.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="language">Language</label>
              <input
                id="language"
                type="text"
                placeholder="e.g., English"
                value={formData.language}
                onChange={(e) => handleInputChange('language', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Prompt Content</h3>
          
          <div className="form-group">
            <label htmlFor="prompt_text">
              Prompt Text * 
              <span className="help-text">
                Use {'{'}placeholder{'}'} format for dynamic values
              </span>
            </label>
            <textarea
              id="prompt_text"
              placeholder="e.g., Generate {count} questions on {topic} for {grade_level} students..."
              value={formData.prompt_text}
              onChange={(e) => handleInputChange('prompt_text', e.target.value)}
              rows="8"
              required
            />
          </div>

          {placeholders.length > 0 && (
            <div className="placeholders-detected">
              <strong>Detected Placeholders:</strong>
              <div className="placeholder-chips">
                {placeholders.map((ph, idx) => (
                  <span key={idx} className="placeholder-chip">{'{' + ph + '}'}</span>
                ))}
              </div>
            </div>
          )}

          <div className="quick-placeholders">
            <strong>Quick Insert:</strong>
            <div className="placeholder-buttons">
              {['count', 'topic', 'subject', 'grade_level', 'concept', 'problem'].map(ph => (
                <button
                  key={ph}
                  type="button"
                  className="placeholder-button"
                  onClick={() => insertPlaceholder(ph)}
                >
                  {'{' + ph + '}'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Tags</h3>
          
          <div className="form-group">
            <label htmlFor="tags">Add Tags</label>
            <div className="tag-input-group">
              <input
                id="tags"
                type="text"
                placeholder="Type a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleTagInputKeyPress}
              />
              <button type="button" onClick={handleAddTag}>Add Tag</button>
            </div>
          </div>

          {formData.tags.length > 0 && (
            <div className="tags-list">
              {formData.tags.map((tag, idx) => (
                <span key={idx} className="tag-item">
                  {tag}
                  <button
                    type="button"
                    className="remove-tag"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>AI Configuration</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="ai_model">Preferred AI Model</label>
              <select
                id="ai_model"
                value={formData.ai_model}
                onChange={(e) => handleInputChange('ai_model', e.target.value)}
              >
                <option value="">Select Model</option>
                {Object.entries(AI_MODELS).map(([key, value]) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="temperature">
                Temperature (0-1)
                <span className="help-text">Lower = more focused, Higher = more creative</span>
              </label>
              <input
                id="temperature"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="max_tokens">Max Tokens</label>
              <input
                id="max_tokens"
                type="number"
                min="1"
                value={formData.max_tokens}
                onChange={(e) => handleInputChange('max_tokens', parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Additional Settings</h3>
          
          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              placeholder="Add any notes or instructions about this prompt..."
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows="3"
            />
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => handleInputChange('is_active', e.target.checked)}
              />
              <span>Active (visible in library)</span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="primary">
            {editingPrompt ? 'Update Prompt' : 'Create Prompt'}
          </button>
          <button type="button" className="secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
