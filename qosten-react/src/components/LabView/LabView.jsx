import React, { useState, useEffect } from 'react';
import { labApi } from '../../services/labApi';
import './LabView.css';

export default function LabView() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedProblemId, setExpandedProblemId] = useState(null);
  const [editMode, setEditMode] = useState(null); // ID of problem being edited
  const [editedData, setEditedData] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null); // { oldName, newName }
  const [editingChapter, setEditingChapter] = useState(null); // { subject, oldName, newName }

  useEffect(() => {
    loadProblems();
  }, []);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const { data } = await labApi.fetchLabProblems();
      setProblems(data || []);
    } catch (err) {
      console.error('Error loading lab problems:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSubject = async () => {
    if (!editingSubject || !editingSubject.newName.trim() || editingSubject.newName === editingSubject.oldName) {
      setEditingSubject(null);
      return;
    }

    setIsUpdating(true);
    try {
      await labApi.renameSubject(editingSubject.oldName, editingSubject.newName.trim());
      await loadProblems();
      setEditingSubject(null);
    } catch (err) {
      alert('Failed to rename subject: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRenameChapter = async () => {
    if (!editingChapter || !editingChapter.newName.trim() || editingChapter.newName === editingChapter.oldName) {
      setEditingChapter(null);
      return;
    }

    setIsUpdating(true);
    try {
      await labApi.renameChapter(editingChapter.subject, editingChapter.oldName, editingChapter.newName.trim());
      await loadProblems();
      setEditingChapter(null);
    } catch (err) {
      alert('Failed to rename chapter: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleProblem = (id) => {
    if (editMode && editMode !== id) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
      setEditMode(null);
    }
    setExpandedProblemId(expandedProblemId === id ? null : id);
  };

  const startEdit = (problem) => {
    setEditMode(problem.id);
    setEditedData(JSON.parse(JSON.stringify(problem))); // Deep clone
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditedData(null);
  };

  const handleDataChange = (field, value) => {
    setEditedData({ ...editedData, [field]: value });
  };

  const handlePartChange = (index, field, value) => {
    const updatedParts = [...editedData.parts];
    if (field === 'guided_steps' && typeof value === 'string') {
      try {
        // Try to parse as JSON if it looks like JSON array
        if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
          updatedParts[index] = { ...updatedParts[index], [field]: JSON.parse(value) };
        } else {
          // Otherwise treat as newline separated strings
          updatedParts[index] = { ...updatedParts[index], [field]: value.split('\n').filter(s => s.trim()) };
        }
      } catch (e) {
        // Fallback to raw string if parsing fails while typing
        updatedParts[index] = { ...updatedParts[index], [field]: value };
      }
    } else {
      updatedParts[index] = { ...updatedParts[index], [field]: value };
    }
    setEditedData({ ...editedData, parts: updatedParts });
  };

  const renderStep = (step) => {
    if (typeof step === 'string') return step;
    if (typeof step === 'object' && step !== null) {
      return (
        <div className="step-object">
          {step.explanation && <div className="step-explanation">{step.explanation}</div>}
          {step.mcq && (
            <div className="step-mcq">
              <strong>MCQ:</strong> {step.mcq.question}
            </div>
          )}
          {step.current_state && <div className="step-state">State: {step.current_state}</div>}
        </div>
      );
    }
    return JSON.stringify(step);
  };

  const saveProblemChanges = async () => {
    setIsUpdating(true);
    try {
      const { id, created_at, updated_at, ...updateData } = editedData;
      await labApi.updateLabProblem(id, updateData);
      await loadProblems();
      setEditMode(null);
    } catch (err) {
      alert('Failed to update lab problem: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProblem = async (id, problemId) => {
    if (!window.confirm(`Are you sure you want to delete problem "${problemId}"?`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await labApi.deleteLabProblem(id);
      setProblems(prev => prev.filter(p => p.id !== id));
      if (expandedProblemId === id) setExpandedProblemId(null);
      if (editMode === id) {
        setEditMode(null);
        setEditedData(null);
      }
    } catch (err) {
      alert('Failed to delete problem: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteChapter = async (subject, chapter) => {
    if (!window.confirm(`Are you sure you want to delete the entire chapter "${chapter}"? This will remove all lab problems within it.`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await labApi.deleteChapter(subject, chapter);
      setProblems(prev => prev.filter(p => !(p.subject === subject && p.chapter === chapter)));
      setExpandedProblemId(null);
    } catch (err) {
      alert('Failed to delete chapter: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Group problems by Subject and then Chapter
  const groupedProblems = problems.reduce((acc, problem) => {
    const subject = problem.subject || 'Unknown';
    const chapter = problem.chapter || 'General';
    
    if (!acc[subject]) acc[subject] = {};
    if (!acc[subject][chapter]) acc[subject][chapter] = [];
    
    acc[subject][chapter].push(problem);
    return acc;
  }, {});

  if (loading) return <div className="loading">Loading lab problems...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="lab-view-container panel">
      <div className="header-row">
        <h2>🧪 Lab Library</h2>
        <button className="refresh-btn" onClick={loadProblems} disabled={isUpdating}>Refresh</button>
      </div>

      {problems.length === 0 ? (
        <p>No lab problems found. Go to the Lab Import tab to add some!</p>
      ) : (
        <div className="subjects-list">
          {Object.keys(groupedProblems).map(subject => (
            <div key={subject} className="subject-section">
              <div className="subject-header-row">
                {editingSubject?.oldName === subject ? (
                  <div className="rename-container">
                    <input 
                      className="rename-input"
                      value={editingSubject.newName}
                      onChange={(e) => setEditingSubject({ ...editingSubject, newName: e.target.value })}
                      autoFocus
                    />
                    <button className="confirm-btn" onClick={handleRenameSubject} disabled={isUpdating}>✓</button>
                    <button className="cancel-btn-small" onClick={() => setEditingSubject(null)} disabled={isUpdating}>×</button>
                  </div>
                ) : (
                  <h3 className="subject-heading" onClick={() => setEditingSubject({ oldName: subject, newName: subject })}>
                    <span>{subject} ({Object.keys(groupedProblems[subject]).length} Chapters)</span>
                    <span className="edit-icon-inline">✎</span>
                  </h3>
                )}
              </div>
              
              {Object.keys(groupedProblems[subject]).map(chapter => {
                const chapterProblems = groupedProblems[subject][chapter];

                return (
                  <div key={chapter} className="chapter-section">
                    <div className="chapter-header-row">
                      <div className="chapter-info">
                        {editingChapter?.subject === subject && editingChapter?.oldName === chapter ? (
                          <div className="rename-container">
                            <input 
                              className="rename-input"
                              value={editingChapter.newName}
                              onChange={(e) => setEditingChapter({ ...editingChapter, newName: e.target.value })}
                              autoFocus
                            />
                            <button className="confirm-btn" onClick={handleRenameChapter} disabled={isUpdating}>✓</button>
                            <button className="cancel-btn-small" onClick={() => setEditingChapter(null)} disabled={isUpdating}>×</button>
                          </div>
                        ) : (
                          <h4 className="chapter-heading" onClick={() => setEditingChapter({ subject, oldName: chapter, newName: chapter })}>
                            Chapter: {chapter}
                            <span className="edit-icon-inline">✎</span>
                          </h4>
                        )}
                        <div className="chapter-stats">
                          <span>{chapterProblems.length} Problems</span>
                        </div>
                      </div>
                      <button 
                        className="delete-chapter-btn" 
                        onClick={() => handleDeleteChapter(subject, chapter)}
                        disabled={isUpdating}
                      >
                        Delete Chapter
                      </button>
                    </div>
                    
                    <div className="problems-list">
                      {chapterProblems.map((problem) => (
                        <div key={problem.id} className={`problem-card ${expandedProblemId === problem.id ? 'expanded' : ''} ${editMode === problem.id ? 'is-editing' : ''}`}>
                          <div className="problem-header" onClick={() => toggleProblem(problem.id)}>
                            <div className="problem-main-info">
                              <h3 className="problem-title">{problem.lab_problem_id}: {problem.lesson || 'Lab Problem'}</h3>
                            </div>
                            <div className="problem-meta">
                              <span>{problem.parts?.length || 0} Parts</span>
                              {problem.board && <span className="board-tag">{problem.board}</span>}
                              <span className="expand-icon">{expandedProblemId === problem.id ? '−' : '+'}</span>
                            </div>
                          </div>

                          {expandedProblemId === problem.id && (
                            <div className="problem-content">
                              <div className="action-bar">
                                {editMode !== problem.id ? (
                                  <div className="default-actions">
                                    <button className="edit-btn" onClick={(e) => { e.stopPropagation(); startEdit(problem); }}>Edit Problem</button>
                                    <button className="delete-problem-btn" onClick={(e) => { e.stopPropagation(); handleDeleteProblem(problem.id, problem.lab_problem_id); }} disabled={isUpdating}>Delete Problem</button>
                                  </div>
                                ) : (
                                  <div className="edit-actions">
                                    <button className="save-btn" onClick={saveProblemChanges} disabled={isUpdating}>
                                      {isUpdating ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button className="cancel-btn" onClick={cancelEdit} disabled={isUpdating}>Cancel</button>
                                  </div>
                                )}
                              </div>

                              <section className="stem-section">
                                <h4>Stem</h4>
                                {editMode === problem.id ? (
                                  <textarea 
                                    className="edit-textarea stem-input"
                                    value={editedData.stem}
                                    onChange={(e) => handleDataChange('stem', e.target.value)}
                                  />
                                ) : (
                                  <div className="stem-content">{problem.stem}</div>
                                )}
                              </section>

                              <section className="parts-section">
                                <h4>Questions & Guided Steps</h4>
                                {(editMode === problem.id ? editedData.parts : problem.parts).map((part, idx) => (
                                  <div key={idx} className="part-item">
                                    <div className="part-header">
                                      <h5>Part ({part.part_id})</h5>
                                    </div>
                                    
                                    <div className="part-content">
                                      <div className="content-block">
                                        <label>Question</label>
                                        {editMode === problem.id ? (
                                          <textarea 
                                            value={part.question_text}
                                            onChange={(e) => handlePartChange(idx, 'question_text', e.target.value)}
                                          />
                                        ) : (
                                          <p>{part.question_text}</p>
                                        )}
                                      </div>

                                      <div className="content-block">
                                        <label>Guided Steps</label>
                                        {editMode === problem.id ? (
                                          <textarea 
                                            value={typeof editedData.parts[idx].guided_steps === 'string' 
                                              ? editedData.parts[idx].guided_steps 
                                              : JSON.stringify(editedData.parts[idx].guided_steps, null, 2)}
                                            onChange={(e) => handlePartChange(idx, 'guided_steps', e.target.value)}
                                            placeholder="Enter steps (JSON array or one per line)"
                                            className="edit-textarea"
                                          />
                                        ) : (
                                          <ul className="steps-list">
                                            {Array.isArray(part.guided_steps) ? (
                                              part.guided_steps.map((step, sIdx) => (
                                                <li key={sIdx}>{renderStep(step)}</li>
                                              ))
                                            ) : (
                                              <li>{renderStep(part.guided_steps)}</li>
                                            )}
                                          </ul>
                                        )}
                                      </div>

                                      <div className="content-block final-answer">
                                        <label>Final Answer</label>
                                        {editMode === problem.id ? (
                                          <input 
                                            className="edit-input"
                                            value={part.final_answer}
                                            onChange={(e) => handlePartChange(idx, 'final_answer', e.target.value)}
                                          />
                                        ) : (
                                          <p><strong>{part.final_answer}</strong></p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </section>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
