import React, { useState } from 'react';
import { aiService } from '../../services/aiService';
import { useQuestions } from '../../context/QuestionContext';
import './AIQuestionImprover.css';

export default function AIQuestionImprover({ selectedQuestions, onComplete, onCancel }) {
  const { questions, bulkUpdateQuestions } = useQuestions();
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [selectedTask, setSelectedTask] = useState('fix_latex');
  const [error, setError] = useState(null);

  const tasks = [
    { id: 'fix_latex', label: 'Fix LaTeX', icon: '∑' },
    { id: 'expand_answers', label: 'Expand Answers', icon: '📝' },
    { id: 'fact_check', label: 'Fact Check', icon: '🔍' },
    { id: 'improve_style', label: 'Improve Style', icon: '✍️' },
  ];

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const questionsToProcess = questions.filter(q => selectedQuestions.includes(q.id));
      const improvements = await aiService.improveQuestions(questionsToProcess, selectedTask);
      
      const preview = improvements.map(imp => {
        const original = questionsToProcess.find(q => q.id.toString() === imp.id.toString());
        return {
          id: imp.id,
          original,
          improved: { ...original, ...imp }
        };
      });
      
      setPreviewData(preview);
    } catch (err) {
      console.error('AI Generation Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      const updates = previewData.map(p => p.improved);
      await bulkUpdateQuestions(updates);
      alert(`Successfully updated ${updates.length} questions!`);
      onComplete();
    } catch (err) {
      console.error('Apply Error:', err);
      alert('Failed to apply changes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (previewData) {
    return (
      <div className="ai-improver-preview">
        <div className="preview-header">
          <div className="header-info">
            <h3>AI Improvement Preview</h3>
            <span>Reviewing {previewData.length} modified questions</span>
          </div>
          <div className="preview-actions">
            <button className="secondary" onClick={() => setPreviewData(null)} disabled={loading}>
              Discard & Back
            </button>
            <button className="primary" onClick={handleApply} disabled={loading}>
              {loading ? 'Applying...' : `Confirm & Apply Changes`}
            </button>
          </div>
        </div>
        <div className="preview-list">
          {previewData.map(item => {
            const hasChanges = JSON.stringify(item.original) !== JSON.stringify(item.improved);
            
            return (
              <div key={item.id} className={`preview-item ${!hasChanges ? 'unchanged' : ''}`}>
                <div className="preview-meta">
                  <span className="q-id">ID: {item.id}</span>
                  <span className="q-type">{item.original.type.toUpperCase()}</span>
                  {!hasChanges && <span className="status-badge">No Changes Detected</span>}
                  {hasChanges && <span className="status-badge modified">Modified by AI</span>}
                </div>
                
                <div className="comparison-grid">
                  <div className="comparison-row header">
                    <div className="col original">Original</div>
                    <div className="col improved">AI Improved</div>
                  </div>

                  {/* Question Text */}
                  <div className="comparison-row">
                    <div className="field-label">Question Text</div>
                    <div className="col original">{item.original.questionText || item.original.question}</div>
                    <div className={`col improved ${item.original.questionText !== item.improved.questionText ? 'changed' : ''}`}>
                      {item.improved.questionText}
                    </div>
                  </div>

                  {/* Options if MCQ */}
                  {item.original.options && (
                    <div className="comparison-row">
                      <div className="field-label">Options</div>
                      <div className="col original">
                        {Object.entries(item.original.options).map(([key, val]) => (
                          <div key={key}><strong>{key}:</strong> {val}</div>
                        ))}
                      </div>
                      <div className="col improved">
                        {Object.entries(item.improved.options).map(([key, val]) => {
                          const isChanged = item.original.options[key] !== val;
                          return (
                            <div key={key} className={isChanged ? 'changed-text' : ''}>
                              <strong>{key}:</strong> {val}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {(item.original.explanation || item.improved.explanation) && (
                    <div className="comparison-row">
                      <div className="field-label">Explanation</div>
                      <div className="col original">{item.original.explanation}</div>
                      <div className={`col improved ${item.original.explanation !== item.improved.explanation ? 'changed' : ''}`}>
                        {item.improved.explanation}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="ai-improver-overlay">
      <div className="ai-improver-modal">
        <div className="modal-header">
          <h2>AI Question Improver</h2>
          <button className="close-btn" onClick={onCancel}>&times;</button>
        </div>
        
        <div className="modal-body">
          <p>Selected <strong>{selectedQuestions.length}</strong> questions to improve.</p>
          
          <div className="task-selector">
            {tasks.map(task => (
              <div 
                key={task.id} 
                className={`task-card ${selectedTask === task.id ? 'active' : ''}`}
                onClick={() => setSelectedTask(task.id)}
              >
                <span className="task-icon">{task.icon}</span>
                <span className="task-label">{task.label}</span>
              </div>
            ))}
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onCancel}>Cancel</button>
          <button 
            className="primary" 
            onClick={handleGenerate} 
            disabled={loading || selectedQuestions.length === 0}
          >
            {loading ? 'AI is thinking...' : 'Generate Improvements'}
          </button>
        </div>
      </div>
    </div>
  );
}
