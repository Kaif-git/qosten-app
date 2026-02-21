import React, { useState, useEffect } from 'react';
import { lessonApi } from '../../services/lessonApi';
import { parseQuestionsOnly, parseLessonText } from '../../utils/lessonParser';
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
  const [editingSubject, setEditingSubject] = useState(null); // { oldName, newName }
  const [editingChapter, setEditingChapter] = useState(null); // { subject, oldName, newName }
  const [addingTopicTo, setAddingTopicTo] = useState(null); // { subject, chapter, position }
  const [newTopicData, setNewTopicData] = useState({ title: '', content: '' });
  const [expandedSubjects, setExpandedSubjects] = useState({}); // { [subjectName]: boolean }
  const [expandedChapters, setExpandedChapters] = useState({}); // { [subject_chapter]: boolean }
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [chapterFilter, setChapterFilter] = useState('All');

  useEffect(() => {
    loadLessons();
  }, []);

  const toggleSubject = (subject) => {
    setExpandedSubjects(prev => ({ ...prev, [subject]: !prev[subject] }));
  };

  const toggleChapter = (subject, chapter) => {
    const key = `${subject}_${chapter}`;
    setExpandedChapters(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

  const handleRenameSubject = async () => {
    if (!editingSubject || !editingSubject.newName.trim() || editingSubject.newName === editingSubject.oldName) {
      setEditingSubject(null);
      return;
    }

    setIsUpdating(true);
    try {
      await lessonApi.renameSubject(editingSubject.oldName, editingSubject.newName.trim());
      await loadLessons();
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
      await lessonApi.renameChapter(editingChapter.subject, editingChapter.oldName, editingChapter.newName.trim());
      await loadLessons();
      setEditingChapter(null);
    } catch (err) {
      alert('Failed to rename chapter: ' + err.message);
    } finally {
      setIsUpdating(false);
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

  const handleDeleteTopic = async (topicId, topicTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${topicTitle}"? This will permanently remove all its content and questions.`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await lessonApi.deleteTopic(topicId);
      setLessons(prev => prev.filter(t => t.id !== topicId));
      if (expandedTopicId === topicId) setExpandedTopicId(null);
      if (editMode === topicId) {
        setEditMode(null);
        setEditedData(null);
      }
    } catch (err) {
      alert('Failed to delete lesson: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteChapter = async (subject, chapter) => {
    if (!window.confirm(`Are you sure you want to delete the entire chapter "${chapter}"? This will remove all lessons, subtopics, and questions within it.`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await lessonApi.deleteChapter(subject, chapter);
      setLessons(prev => prev.filter(t => !(t.subject === subject && t.chapter === chapter)));
      setExpandedTopicId(null);
    } catch (err) {
      alert('Failed to delete chapter: ' + err.message);
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

  const handleInsertTopic = async () => {
    setIsUpdating(true);
    try {
      let topicTitle = newTopicData.title.trim();

      if (newTopicData.content.trim()) {
        const hasTopicHeader = newTopicData.content.match(/^(?:[*#-]*\s*)?(?:###\s*)?(?:\*\*)?Topic(?:\s+[\d.]+)?\s*[:：ঃ.-]/im);
        
        let parserInput = `Subject: ${addingTopicTo.subject}\nChapter: ${addingTopicTo.chapter}\n`;
        if (!hasTopicHeader) {
          if (!topicTitle) {
            alert('Please provide a Topic Title or include a "Topic:" header in the content.');
            setIsUpdating(false);
            return;
          }
          parserInput += `Topic: ${topicTitle}\n`;
        }
        
        parserInput += newTopicData.content;
        
        console.log('Parser Input Prepared:', parserInput.substring(0, 100) + '...');
        const parsed = parseLessonText(parserInput);
        console.log('Parsed Chapters:', parsed.length);

        if (parsed.length > 0) {
          const firstChapter = parsed[0];
          console.log(`Found ${firstChapter.topics.length} topics in first chapter.`);
          
          let currentPosition = addingTopicTo.position;

          for (const topicData of firstChapter.topics) {
            console.log(`Uploading topic: "${topicData.title}" at position ${currentPosition}`);
            await lessonApi.createTopicAtPosition({
              subject: addingTopicTo.subject,
              chapter: addingTopicTo.chapter,
              title: topicData.title,
              subtopics: topicData.subtopics,
              questions: topicData.questions
            }, currentPosition);
            currentPosition++;
          }
        }
      } else {
        // Just a title, no content
        if (!topicTitle) {
          alert('Topic title is required');
          setIsUpdating(false);
          return;
        }
        await lessonApi.createTopicAtPosition({
          subject: addingTopicTo.subject,
          chapter: addingTopicTo.chapter,
          title: topicTitle,
          subtopics: [],
          questions: []
        }, addingTopicTo.position);
      }

      setAddingTopicTo(null);
      setNewTopicData({ title: '', content: '' });
      await loadLessons();
    } catch (err) {
      console.error('Error in handleInsertTopic:', err);
      alert('Failed to insert topic: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // Filter and Group lessons
  const allSubjects = Array.from(new Set(lessons.map(l => l.subject || 'Unknown'))).sort();
  const chaptersForSelectedSubject = subjectFilter !== 'All' 
    ? Array.from(new Set(lessons.filter(l => l.subject === subjectFilter).map(l => l.chapter || 'General'))).sort()
    : [];

  const filteredLessons = lessons.filter(topic => {
    const matchSubject = subjectFilter === 'All' || topic.subject === subjectFilter;
    const matchChapter = chapterFilter === 'All' || topic.chapter === chapterFilter;
    return matchSubject && matchChapter;
  });

  const groupedLessons = filteredLessons.reduce((acc, topic) => {
    const subject = topic.subject || 'Unknown';
    const chapter = topic.chapter || 'General';
    
    if (!acc[subject]) acc[subject] = {};
    if (!acc[subject][chapter]) acc[subject][chapter] = [];
    
    acc[subject][chapter].push(topic);
    return acc;
  }, {});

  if (loading) return <div className="loading">Loading lessons...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="lessons-view-container panel">
      <div className="header-row">
        <div className="title-area">
          <h2>Lesson Library</h2>
          <div className="filters">
            <div className="filter-group">
              <label>Subject:</label>
              <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setChapterFilter('All'); }}>
                <option value="All">All Subjects</option>
                {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {subjectFilter !== 'All' && (
              <div className="filter-group">
                <label>Chapter:</label>
                <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}>
                  <option value="All">All Chapters</option>
                  {chaptersForSelectedSubject.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <button className="refresh-btn" onClick={loadLessons} disabled={isUpdating}>Refresh</button>
      </div>

      {lessons.length === 0 ? (
        <p>No lessons found. Go to the Import tab to add some!</p>
      ) : (
        <div className="subjects-list">
          {Object.keys(groupedLessons).map(subject => (
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
                  <h3 className="subject-heading" onClick={() => toggleSubject(subject)}>
                    <span>{subject} ({Object.keys(groupedLessons[subject]).length} Chapters)</span>
                    <span className="expand-icon">{expandedSubjects[subject] ? '−' : '+'}</span>
                  </h3>
                )}
              </div>
              
              {expandedSubjects[subject] && Object.keys(groupedLessons[subject]).map(chapter => {
                const chapterTopics = groupedLessons[subject][chapter];
                const totalSubtopics = chapterTopics.reduce((sum, t) => sum + (t.subtopics?.length || 0), 0);
                const totalQuestions = chapterTopics.reduce((sum, t) => sum + (t.questions?.length || 0), 0);
                const isChapterExpanded = expandedChapters[`${subject}_${chapter}`];

                return (
                  <div key={chapter} className="chapter-section">
                    <div className="chapter-header-row" onClick={() => toggleChapter(subject, chapter)}>
                      <div className="chapter-info">
                        {editingChapter?.subject === subject && editingChapter?.oldName === chapter ? (
                          <div className="rename-container" onClick={e => e.stopPropagation()}>
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
                          <h4 className="chapter-heading">
                            Chapter: {chapter}
                            <span className="expand-icon-small">{isChapterExpanded ? '−' : '+'}</span>
                          </h4>
                        )}
                        <div className="chapter-stats">
                          <span>{chapterTopics.length} Lessons</span>
                          <span>{totalSubtopics} Subtopics</span>
                          <span>{totalQuestions} Questions</span>
                        </div>
                      </div>
                      <div className="chapter-actions">
                        <button className="edit-icon-btn" onClick={(e) => { e.stopPropagation(); setEditingChapter({ subject, oldName: chapter, newName: chapter }); }}>✎</button>
                        <button 
                          className="delete-chapter-btn" 
                          onClick={(e) => { e.stopPropagation(); handleDeleteChapter(subject, chapter); }}
                          disabled={isUpdating}
                        >
                          Delete Chapter
                        </button>
                      </div>
                    </div>

                    {isChapterExpanded && (
                      <div className="lessons-list">
                      {/* Insertion point at the very top (Position 0) */}
                      {addingTopicTo?.subject === subject && addingTopicTo?.chapter === chapter && addingTopicTo?.position === 0 ? (
                        <div className="insert-topic-form">
                          <h5>Insert New Lesson at Beginning</h5>
                          <div className="form-group">
                            <label>Topic Title</label>
                            <input 
                              value={newTopicData.title}
                              onChange={(e) => setNewTopicData({ ...newTopicData, title: e.target.value })}
                              placeholder="e.g. Newton's First Law"
                            />
                          </div>
                          <div className="form-group">
                            <label>Content (Optional - Subtopics & Questions)</label>
                            <textarea 
                              value={newTopicData.content}
                              onChange={(e) => setNewTopicData({ ...newTopicData, content: e.target.value })}
                              placeholder="Subtopic: ...&#10;Definition: ...&#10;Q1: ...&#10;a) ..."
                            />
                          </div>
                          <div className="form-actions">
                            <button className="confirm-btn" onClick={handleInsertTopic} disabled={isUpdating}>Add Lesson</button>
                            <button className="cancel-btn" onClick={() => setAddingTopicTo(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="insertion-gap">
                          <button 
                            className="insert-btn-mini"
                            onClick={() => setAddingTopicTo({ subject, chapter, position: 0 })}
                          >
                            + Insert Lesson Here
                          </button>
                        </div>
                      )}

                      {chapterTopics.map((topic, index) => (
                        <React.Fragment key={topic.id}>
                          <div className={`topic-card ${expandedTopicId === topic.id ? 'expanded' : ''} ${editMode === topic.id ? 'is-editing' : ''}`}>
                            <div className="topic-header" onClick={() => toggleTopic(topic.id)}>
                              <div className="topic-main-info">
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
                                    <div className="default-actions">
                                      <button className="edit-btn" onClick={(e) => { e.stopPropagation(); startEdit(topic); }}>Edit Lesson</button>
                                      <button className="delete-lesson-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id, topic.title); }} disabled={isUpdating}>Delete Lesson</button>
                                    </div>
                                  ) : (
                                    <div className="edit-actions">
                                      <button className="save-btn" onClick={saveTopicChanges} disabled={isUpdating}>
                                        {isUpdating ? 'Saving...' : 'Save All Changes'}
                                      </button>
                                      <button className="cancel-btn" onClick={cancelEdit} disabled={isUpdating}>Cancel</button>
                                    </div>
                                  )}
                                </div>
                                {/* ... rest of topic content ... */}
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

                          {/* Insertion point after this topic (Position index + 1) */}
                          {addingTopicTo?.subject === subject && addingTopicTo?.chapter === chapter && addingTopicTo?.position === index + 1 ? (
                            <div className="insert-topic-form">
                              <h5>Insert New Lesson after {topic.title}</h5>
                              <div className="form-group">
                                <label>Topic Title</label>
                                <input 
                                  value={newTopicData.title}
                                  onChange={(e) => setNewTopicData({ ...newTopicData, title: e.target.value })}
                                  placeholder="e.g. Newton's First Law"
                                />
                              </div>
                              <div className="form-group">
                                <label>Content (Optional - Subtopics & Questions)</label>
                                <textarea 
                                  value={newTopicData.content}
                                  onChange={(e) => setNewTopicData({ ...newTopicData, content: e.target.value })}
                                  placeholder="Subtopic: ...&#10;Definition: ...&#10;Q1: ...&#10;a) ..."
                                />
                              </div>
                              <div className="form-actions">
                                <button className="confirm-btn" onClick={handleInsertTopic} disabled={isUpdating}>Add Lesson</button>
                                <button className="cancel-btn" onClick={() => setAddingTopicTo(null)}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="insertion-gap">
                              <button 
                                className="insert-btn-mini"
                                onClick={() => setAddingTopicTo({ subject, chapter, position: index + 1 })}
                              >
                                + Insert Lesson Here
                              </button>
                            </div>
                                                    )}
                                                  </React.Fragment>
                                                ))}
                                              </div>
                                              )}
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
