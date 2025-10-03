import React, { useState, useEffect } from 'react';
import { usePrompts } from '../../context/PromptContext';
import { useNavigate } from 'react-router-dom';
import { filterPrompts, sortPrompts, PROMPT_TYPES, SUBJECTS, GRADE_LEVELS } from '../../utils/promptUtils';
import './PromptLibrary.css';

export default function PromptLibrary() {
  const { prompts, loading, error, stats, deletePrompt, setEditingPrompt } = usePrompts();
  const navigate = useNavigate();
  
  const [filters, setFilters] = useState({
    searchText: '',
    promptType: '',
    subject: '',
    gradeLevel: '',
    isActive: true
  });
  
  const [sortConfig, setSortConfig] = useState({
    sortBy: 'created_at',
    order: 'desc'
  });
  
  const [view, setView] = useState('all'); // 'all', 'popular', 'recent'

  // Apply filters and sorting
  const filteredPrompts = filterPrompts(prompts, filters);
  const sortedPrompts = sortPrompts(filteredPrompts, sortConfig.sortBy, sortConfig.order);
  
  // Get view-specific prompts
  const displayPrompts = view === 'popular' 
    ? [...sortedPrompts].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0)).slice(0, 20)
    : view === 'recent'
    ? [...sortedPrompts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20)
    : sortedPrompts;

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = (prompt) => {
    setEditingPrompt(prompt);
    navigate('/prompts/add');
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      try {
        await deletePrompt(id);
        alert('Prompt deleted successfully!');
      } catch (error) {
        alert('Error deleting prompt: ' + error.message);
      }
    }
  };

  const handleCopyPrompt = (prompt) => {
    navigator.clipboard.writeText(prompt.prompt_text);
    alert('Prompt copied to clipboard!');
  };

  const handleUsePrompt = (prompt) => {
    navigate('/prompts/generator', { state: { prompt } });
  };

  if (loading && prompts.length === 0) {
    return <div className="loading">Loading prompts...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="prompt-library">
      {/* Header */}
      <div className="header">
        <div>
          <h1>Prompt Library</h1>
          <p>Manage and organize your AI prompts</p>
        </div>
        <button onClick={() => navigate('/prompts/add')}>
          + Add New Prompt
        </button>
      </div>

      {/* Statistics */}
      <div className="stats">
        <div className="stat-item">
          <div className="stat-value">{stats.total}</div>
          <div>Total Prompts</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{Object.keys(stats.byType).length}</div>
          <div>Prompt Types</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{Object.keys(stats.bySubject).length}</div>
          <div>Subjects</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">
            {prompts.reduce((sum, p) => sum + (p.usage_count || 0), 0)}
          </div>
          <div>Total Uses</div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="tab-container">
        <div 
          className={`tab ${view === 'all' ? 'active' : ''}`}
          onClick={() => setView('all')}
        >
          All Prompts ({prompts.length})
        </div>
        <div 
          className={`tab ${view === 'popular' ? 'active' : ''}`}
          onClick={() => setView('popular')}
        >
          Popular
        </div>
        <div 
          className={`tab ${view === 'recent' ? 'active' : ''}`}
          onClick={() => setView('recent')}
        >
          Recently Added
        </div>
      </div>

      {/* Filters */}
      <div className="panel search-filters">
        <input
          type="text"
          placeholder="Search prompts..."
          value={filters.searchText}
          onChange={(e) => handleFilterChange('searchText', e.target.value)}
        />
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={filters.promptType}
            onChange={(e) => handleFilterChange('promptType', e.target.value)}
          >
            <option value="">All Types</option>
            {Object.entries(PROMPT_TYPES).map(([key, value]) => (
              <option key={value} value={value}>
                {key.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <select
            value={filters.subject}
            onChange={(e) => handleFilterChange('subject', e.target.value)}
          >
            <option value="">All Subjects</option>
            {SUBJECTS.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>

          <select
            value={filters.gradeLevel}
            onChange={(e) => handleFilterChange('gradeLevel', e.target.value)}
          >
            <option value="">All Grades</option>
            {GRADE_LEVELS.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>

          <select
            value={sortConfig.sortBy}
            onChange={(e) => setSortConfig({ ...sortConfig, sortBy: e.target.value })}
          >
            <option value="created_at">Sort: Date Created</option>
            <option value="updated_at">Sort: Date Updated</option>
            <option value="title">Sort: Title</option>
            <option value="usage_count">Sort: Usage Count</option>
          </select>

          <select
            value={sortConfig.order}
            onChange={(e) => setSortConfig({ ...sortConfig, order: e.target.value })}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input
            type="checkbox"
            checked={filters.isActive}
            onChange={(e) => handleFilterChange('isActive', e.target.checked)}
          />
          Show only active prompts
        </label>
      </div>

      {/* Prompts Grid */}
      <div className="prompts-grid">
        {displayPrompts.length === 0 ? (
          <div className="empty-state">
            <p>No prompts found. Create your first prompt to get started!</p>
            <button onClick={() => navigate('/prompts/add')}>
              Create Prompt
            </button>
          </div>
        ) : (
          displayPrompts.map(prompt => (
            <div key={prompt.id} className="prompt-card">
              <div className="prompt-header">
                <div>
                  <h3>{prompt.title}</h3>
                  <div className="prompt-meta">
                    <span className="badge badge-type">
                      {prompt.prompt_type?.replace(/_/g, ' ')}
                    </span>
                    {prompt.subject && (
                      <span className="badge badge-subject">{prompt.subject}</span>
                    )}
                    {prompt.grade_level && (
                      <span className="badge badge-grade">{prompt.grade_level}</span>
                    )}
                    {!prompt.is_active && (
                      <span className="badge badge-inactive">Inactive</span>
                    )}
                  </div>
                </div>
                <div className="usage-badge">
                  <span className="usage-count">{prompt.usage_count || 0}</span>
                  <span className="usage-label">uses</span>
                </div>
              </div>

              <div className="prompt-body">
                <p className="prompt-text">{prompt.prompt_text}</p>
                
                {prompt.tags && prompt.tags.length > 0 && (
                  <div className="tags">
                    {prompt.tags.map((tag, idx) => (
                      <span key={idx} className="tag">#{tag}</span>
                    ))}
                  </div>
                )}

                {prompt.ai_model && (
                  <div className="ai-config">
                    <small>
                      Model: {prompt.ai_model} | 
                      Temp: {prompt.temperature || 0.7} | 
                      Tokens: {prompt.max_tokens || 1000}
                    </small>
                  </div>
                )}

                {prompt.notes && (
                  <div className="notes">
                    <small><strong>Notes:</strong> {prompt.notes}</small>
                  </div>
                )}
              </div>

              <div className="prompt-footer">
                <div className="timestamp">
                  <small>
                    Created: {new Date(prompt.created_at).toLocaleDateString()}
                  </small>
                </div>
                <div className="actions">
                  <button 
                    className="secondary" 
                    onClick={() => handleUsePrompt(prompt)}
                    title="Use this prompt"
                  >
                    Use
                  </button>
                  <button 
                    onClick={() => handleCopyPrompt(prompt)}
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                  <button 
                    onClick={() => handleEdit(prompt)}
                    title="Edit prompt"
                  >
                    Edit
                  </button>
                  <button 
                    className="danger" 
                    onClick={() => handleDelete(prompt.id)}
                    title="Delete prompt"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
