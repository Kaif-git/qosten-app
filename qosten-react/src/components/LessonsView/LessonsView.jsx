import React, { useState, useEffect } from 'react';
import { lessonApi } from '../../services/lessonApi';
import { parseQuestionsOnly } from '../../utils/lessonParser';
import './LessonsView.css';

export default function LessonsView() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTopicId, setExpandedTopicId] = useState(null);
  const [editMode, setEditMode] = useState(null); // ID of topic being edited
  const [editedData, setEditedData] = useState(null);
  const [batchQuestionText, setBatchQuestionText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const data = await lessonApi.fetchLessons();
      setLessons(data);
    } catch (err) {
      console.error('Error loading lessons:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (id) => {
    if (editMode && editMode !== id) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
      setEditMode(null);
    }
    setExpandedTopicId(expandedTopicId === id ? null : id);
  };

  const startEdit = (topic) => {
    setEditMode(topic.id);
    setEditedData(JSON.parse(JSON.stringify(topic))); // Deep clone
    setBatchQuestionText('');
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditedData(null);
  };

  const handleSubtopicChange = (stId, field, value) => {
    const updatedSubtopics = editedData.subtopics.map(st => 
      st.id === stId ? { ...st, [field]: value } : st
    );
    setEditedData({ ...editedData, subtopics: updatedSubtopics });
  };

  const saveTopicChanges = async () => {
    setIsUpdating(true);
    try {
      await lessonApi.updateTopic(editedData.id, editedData);
      await loadLessons();
      setEditMode(null);
    } catch (err) {
      alert('Failed to update topic: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteQuestion = async (qId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      await lessonApi.deleteQuestion(qId);
      // Update local state for immediate feedback
      setLessons(prev => prev.map(topic => ({
        ...topic,
        questions: topic.questions.filter(q => q.id !== qId)
      })));
      if (editedData) {
        setEditedData({
          ...editedData,
          questions: editedData.questions.filter(q => q.id !== qId)
        });
      }
    } catch (err) {
      alert('Failed to delete question: ' + err.message);
    }
  };

  const handleBatchAdd = async () => {
    const parsedQuestions = parseQuestionsOnly(batchQuestionText);
    if (parsedQuestions.length === 0) {
      alert('No valid questions found. Please check your format.');
      return;
    }

    if (!window.confirm(`Found ${parsedQuestions.length} questions. Add them to this topic?`)) return;

    setIsUpdating(true);
    try {
      const maxOrder = editedData.questions.reduce((max, q) => Math.max(max, q.order_index), -1);
      await lessonApi.addQuestionsToTopic(editedData.id, parsedQuestions, maxOrder + 1);
      setBatchQuestionText('');
      await loadLessons();
      // Need to refresh editedData too to show new questions
      const freshTopic = (await lessonApi.fetchLessons()).find(t => t.id === editedData.id);
      setEditedData(freshTopic);
    } catch (err) {
      alert('Failed to add questions: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="loading">Loading lessons...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="lessons-view-container panel">
      <div className="header-row">
        <h2>Lesson Library</h2>
        <button className="refresh-btn" onClick={loadLessons} disabled={isUpdating}>Refresh</button>
      </div>

      {lessons.length === 0 ? (
        <p>No lessons found. Go to the Import tab to add some!</p>
      ) : (
        <div className="lessons-list">
          {lessons.map((topic) => (
            <div key={topic.id} className={`topic-card ${expandedTopicId === topic.id ? 'expanded' : ''} ${editMode === topic.id ? 'is-editing' : ''}`}>
              <div className="topic-header" onClick={() => toggleTopic(topic.id)}>
                <div className="topic-main-info">
                  <span className="subject-tag">{topic.subject}</span>
                  <span className="chapter-name">{topic.chapter}</span>
                  <h3 className="topic-title">{topic.title}</h3>
                </div>
                <div className="topic-meta">
                  <span>{topic.subtopics.length} Subtopics</span>
                  <span>{topic.questions.length} Questions</span>
                  <span className="expand-icon">{expandedTopicId === topic.id ? '−' : '+'}</span>
                </div>
              </div>

              {expandedTopicId === topic.id && (
                <div className="topic-content">
                  <div className="action-bar">
                    {editMode !== topic.id ? (
                      <button className="edit-btn" onClick={(e) => { e.stopPropagation(); startEdit(topic); }}>Edit Lesson</button>
                    ) : (
                      <div className="edit-actions">
                        <button className="save-btn" onClick={saveTopicChanges} disabled={isUpdating}>
                          {isUpdating ? 'Saving...' : 'Save All Changes'}
                        </button>
                        <button className="cancel-btn" onClick={cancelEdit} disabled={isUpdating}>Cancel</button>
                      </div>
                    )}
                  </div>

                  <section className="subtopics-section">
                    <h4>Study Content</h4>
                    {(editMode === topic.id ? editedData.subtopics : topic.subtopics).map((st) => (
                      <div key={st.id} className="subtopic-item">
                        <div className="subtopic-title-row">
                          {editMode === topic.id ? (
                            <input 
                              className="edit-input title-input"
                              value={st.title}
                              onChange={(e) => handleSubtopicChange(st.id, 'title', e.target.value)}
                            />
                          ) : (
                            <h5>{st.title}</h5>
                          )}
                          <span className={`difficulty-badge ${st.difficulty?.toLowerCase()}`}>
                            {st.difficulty}
                          </span>
                        </div>
                        
                        <div className="content-grid">
                          <div className="content-block">
                            <label>Definition</label>
                            {editMode === topic.id ? (
                              <textarea 
                                value={st.definition}
                                onChange={(e) => handleSubtopicChange(st.id, 'definition', e.target.value)}
                              />
                            ) : (
                              <p>{st.definition}</p>
                            )}
                          </div>
                          <div className="content-block">
                            <label>Explanation</label>
                            {editMode === topic.id ? (
                              <textarea 
                                value={st.explanation}
                                onChange={(e) => handleSubtopicChange(st.id, 'explanation', e.target.value)}
                              />
                            ) : (
                              <p>{st.explanation}</p>
                            )}
                          </div>
                          {(st.shortcut || editMode === topic.id) && (
                            <div className="content-block shortcut">
                              <label>Memory Shortcut</label>
                              {editMode === topic.id ? (
                                <textarea 
                                  value={st.shortcut}
                                  onChange={(e) => handleSubtopicChange(st.id, 'shortcut', e.target.value)}
                                />
                              ) : (
                                <p>{st.shortcut}</p>
                              )}
                            </div>
                          )}
                          {(st.mistakes || editMode === topic.id) && (
                            <div className="content-block mistake">
                              <label>Common Mistakes</label>
                              {editMode === topic.id ? (
                                <textarea 
                                  value={st.mistakes}
                                  onChange={(e) => handleSubtopicChange(st.id, 'mistakes', e.target.value)}
                                />
                              ) : (
                                <p>{st.mistakes}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="questions-section">
                    <div className="section-header">
                      <h4>Review Questions</h4>
                      {editMode === topic.id && <span className="edit-hint">(You can delete questions or batch add more below)</span>}
                    </div>
                    
                    <div className="questions-grid">
                      {(editMode === topic.id ? editedData.questions : topic.questions).map((q, idx) => (
                        <div key={q.id} className="lesson-question-card mcq-card">
                          <div className="q-header">
                            <div className="q-text"><strong>Q{idx + 1}:</strong> {q.question}</div>
                            {editMode === topic.id && (
                              <button className="delete-q-btn" onClick={() => deleteQuestion(q.id)}>×</button>
                            )}
                          </div>
                          <div className="options-list">
                            {q.options && q.options.map((opt, oIdx) => (
                              <div key={oIdx} className={`option-item ${q.correct_answer === opt.label ? 'correct' : ''}`}>
                                <span className="option-label">{opt.label})</span>
                                <span className="option-text">{opt.text}</span>
                              </div>
                            ))}
                          </div>
                          {q.explanation && (
                            <div className="explanation-text">
                              <strong>Explanation:</strong> {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {editMode === topic.id && (
                      <div className="batch-add-section">
                        <h5>Batch Add MCQ Questions</h5>
                        
                        <div className="format-guide">
                          <p><strong>Required Format:</strong></p>
                          <pre>
{`Q1: Question text here?
a) Option One
b) Option Two
c) Option Three
d) Option Four
Correct: b
Explanation: Why it is correct...`}
                          </pre>
                          <p className="hint">Supports Bengali: <strong>ক), খ), গ), ঘ)</strong> and <strong>Correct: গ</strong></p>
                        </div>

                        <textarea 
                          placeholder="Paste more questions here..."
                          value={batchQuestionText}
                          onChange={(e) => setBatchQuestionText(e.target.value)}
                        />
                        <button className="batch-add-btn" onClick={handleBatchAdd} disabled={!batchQuestionText.trim() || isUpdating}>
                          Parse & Add Questions
                        </button>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
