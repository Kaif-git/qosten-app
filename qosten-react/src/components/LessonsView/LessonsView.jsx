import React, { useState, useEffect } from 'react';
import { lessonApi } from '../../services/lessonApi';
import { parseQuestionsOnly, parseLessonText, formatLessonToMarkdown } from '../../utils/lessonParser';
import './LessonsView.css';

export default function LessonsView() {
  // -- Data State --
  const [subjects, setSubjects] = useState([]); // Array of strings
  const [chaptersBySubject, setChaptersBySubject] = useState({}); // { [subject]: [chapters] }
  const [topicsByChapter, setTopicsByChapter] = useState({}); // { [subject_chapter]: [topics] }
  
  // -- UI State --
  const [loading, setLoading] = useState(true); // Initial subjects load
  const [error, setError] = useState(null);
  
  const [loadingChapters, setLoadingChapters] = useState({}); // { [subject]: boolean }
  const [loadingTopics, setLoadingTopics] = useState({}); // { [subject_chapter]: boolean }
  const [loadingDetails, setLoadingDetails] = useState({}); // { [topicId]: boolean }
  const [copyingChapter, setCopyingChapter] = useState({}); // { [subject_chapter]: boolean }

  const [expandedSubjects, setExpandedSubjects] = useState({}); // { [subject]: boolean }
  const [expandedChapters, setExpandedChapters] = useState({}); // { [subject_chapter]: boolean }
  
  const [expandedTopicId, setExpandedTopicId] = useState(null);
  
  // -- Edit/Interaction State --
  const [editMode, setEditMode] = useState(null); // ID of topic being edited
  const [editedData, setEditedData] = useState(null);
  const [batchQuestionText, setBatchQuestionText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [editingSubject, setEditingSubject] = useState(null); // { oldName, newName }
  const [editingChapter, setEditingChapter] = useState(null); // { subject, oldName, newName }
  const [addingTopicTo, setAddingTopicTo] = useState(null); // { subject, chapter, position }
  const [newTopicData, setNewTopicData] = useState({ title: '', content: '' });

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      const data = await lessonApi.fetchSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('Error loading subjects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyChapter = async (subject, chapter) => {
    const key = `${subject}_${chapter}`;
    setCopyingChapter(prev => ({ ...prev, [key]: true }));
    try {
      const fullTopics = await lessonApi.fetchFullChapter(subject, chapter);
      const markdown = formatLessonToMarkdown(subject, chapter, fullTopics);
      
      await navigator.clipboard.writeText(markdown);
      alert(`Chapter "${chapter}" copied to clipboard in import format!`);
    } catch (err) {
      console.error('Error copying chapter:', err);
      alert('Failed to copy chapter: ' + err.message);
    } finally {
      setCopyingChapter(prev => ({ ...prev, [key]: false }));
    }
  };

  const toggleSubject = async (subject) => {
    const isExpanding = !expandedSubjects[subject];
    setExpandedSubjects(prev => ({ ...prev, [subject]: isExpanding }));

    if (isExpanding && !chaptersBySubject[subject]) {
      setLoadingChapters(prev => ({ ...prev, [subject]: true }));
      try {
        const data = await lessonApi.fetchChapters(subject);
        setChaptersBySubject(prev => ({ ...prev, [subject]: data }));
      } catch (err) {
        console.error('Error loading chapters:', err);
        // Maybe show error in UI?
      } finally {
        setLoadingChapters(prev => ({ ...prev, [subject]: false }));
      }
    }
  };

  const toggleChapter = async (subject, chapter) => {
    const key = `${subject}_${chapter}`;
    const isExpanding = !expandedChapters[key];
    setExpandedChapters(prev => ({ ...prev, [key]: isExpanding }));

    if (isExpanding && !topicsByChapter[key]) {
      setLoadingTopics(prev => ({ ...prev, [key]: true }));
      try {
        const data = await lessonApi.fetchTopics(subject, chapter);
        setTopicsByChapter(prev => ({ ...prev, [key]: data }));
      } catch (err) {
        console.error('Error loading topics:', err);
      } finally {
        setLoadingTopics(prev => ({ ...prev, [key]: false }));
      }
    }
  };

  const toggleTopic = async (topic) => {
    if (editMode && editMode !== topic.id) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
      setEditMode(null);
    }

    const isExpanding = expandedTopicId !== topic.id;
    
    if (isExpanding) {
      setExpandedTopicId(topic.id);
      if (!topic.detailsLoaded) {
        setLoadingDetails(prev => ({ ...prev, [topic.id]: true }));
        try {
          const details = await lessonApi.fetchTopicDetails(topic.id);
          const key = `${topic.subject}_${topic.chapter}`;
          setTopicsByChapter(prev => ({
            ...prev,
            [key]: prev[key].map(t => 
              t.id === topic.id ? { ...t, ...details, detailsLoaded: true } : t
            )
          }));
        } catch (err) {
          console.error('Error loading topic details:', err);
        } finally {
          setLoadingDetails(prev => ({ ...prev, [topic.id]: false }));
        }
      }
    } else {
      setExpandedTopicId(null);
    }
  };

  const handleRenameSubject = async () => {
    if (!editingSubject || !editingSubject.newName.trim() || editingSubject.newName === editingSubject.oldName) {
      setEditingSubject(null);
      return;
    }

    setIsUpdating(true);
    try {
      const { oldName, newName } = editingSubject;
      const trimmedNewName = newName.trim();
      
      await lessonApi.renameSubject(oldName, trimmedNewName);
      
      setChaptersBySubject(prev => {
        const next = { ...prev };
        if (next[oldName]) {
          next[trimmedNewName] = next[oldName];
          delete next[oldName];
        }
        return next;
      });

      setTopicsByChapter(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (key.startsWith(`${oldName}_`)) {
            const chapterPart = key.substring(oldName.length + 1);
            next[`${trimmedNewName}_${chapterPart}`] = next[key];
            delete next[key];
          }
        });
        return next;
      });

      setExpandedSubjects(prev => {
        const next = { ...prev };
        if (next[oldName]) {
          next[trimmedNewName] = next[oldName];
          delete next[oldName];
        }
        return next;
      });

      await loadSubjects(); 
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
      const freshChapters = await lessonApi.fetchChapters(editingChapter.subject);
      setChaptersBySubject(prev => ({ ...prev, [editingChapter.subject]: freshChapters }));
      
      const oldKey = `${editingChapter.subject}_${editingChapter.oldName}`;
      setTopicsByChapter(prev => {
        const next = { ...prev };
        delete next[oldKey];
        return next;
      });
      setExpandedChapters(prev => {
          const next = {...prev};
          delete next[oldKey];
          return next;
      });

      setEditingChapter(null);
    } catch (err) {
      alert('Failed to rename chapter: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const startEdit = (topic) => {
    setEditMode(topic.id);
    setEditedData(JSON.parse(JSON.stringify(topic))); 
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
      
      const key = `${editedData.subject}_${editedData.chapter}`;
      setTopicsByChapter(prev => ({
        ...prev,
        [key]: prev[key].map(t => t.id === editedData.id ? { ...editedData, detailsLoaded: true } : t)
      }));
      
      setEditMode(null);
    } catch (err) {
      alert('Failed to update topic: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteTopic = async (topicId, topicTitle, subject, chapter) => {
    if (!window.confirm(`Are you sure you want to delete "${topicTitle}"?`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await lessonApi.deleteTopic(topicId);
      const key = `${subject}_${chapter}`;
      setTopicsByChapter(prev => ({
        ...prev,
        [key]: prev[key].filter(t => t.id !== topicId)
      }));
      
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
    if (!window.confirm(`Are you sure you want to delete the entire chapter "${chapter}"?`)) {
      return;
    }

    setIsUpdating(true);
    try {
      await lessonApi.deleteChapter(subject, chapter);
      setChaptersBySubject(prev => ({
        ...prev,
        [subject]: prev[subject].filter(c => c !== chapter)
      }));
      const key = `${subject}_${chapter}`;
      setTopicsByChapter(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
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
      
      if (editedData) {
        setEditedData(prev => ({
          ...prev,
          questions: prev.questions.filter(q => q.id !== qId)
        }));
      }

      if (editMode) {
          const key = `${editedData.subject}_${editedData.chapter}`;
          setTopicsByChapter(prev => ({
            ...prev,
            [key]: prev[key].map(t => 
                t.id === editMode 
                ? { ...t, questions: t.questions.filter(q => q.id !== qId) }
                : t
            )
          }));
      }
    } catch (err) {
      alert('Failed to delete question: ' + err.message);
    }
  };

  const handleBatchAdd = async () => {
    const parsedQuestions = parseQuestionsOnly(batchQuestionText);
    if (parsedQuestions.length === 0) {
      alert('No valid questions found.');
      return;
    }

    if (!window.confirm(`Found ${parsedQuestions.length} questions. Add them?`)) return;

    setIsUpdating(true);
    try {
      const maxOrder = editedData.questions.reduce((max, q) => Math.max(max, q.order_index), -1);
      await lessonApi.addQuestionsToTopic(editedData.id, parsedQuestions, maxOrder + 1);
      setBatchQuestionText('');
      
      const details = await lessonApi.fetchTopicDetails(editedData.id);
      
      setEditedData(prev => ({ ...prev, ...details }));
      
      const key = `${editedData.subject}_${editedData.chapter}`;
      setTopicsByChapter(prev => ({
        ...prev,
        [key]: prev[key].map(t => t.id === editedData.id ? { ...t, ...details } : t)
      }));

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
            alert('Please provide a Topic Title.');
            setIsUpdating(false); return;
          }
          parserInput += `Topic: ${topicTitle}\n`;
        }
        parserInput += newTopicData.content;
        
        const parsed = parseLessonText(parserInput);
        if (parsed.length > 0) {
          const firstChapter = parsed[0];
          let currentPosition = addingTopicTo.position;
          for (const topicData of firstChapter.topics) {
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
        if (!topicTitle) {
          alert('Topic title is required');
          setIsUpdating(false); return;
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
      
      const key = `${addingTopicTo.subject}_${addingTopicTo.chapter}`;
      const freshTopics = await lessonApi.fetchTopics(addingTopicTo.subject, addingTopicTo.chapter);
      setTopicsByChapter(prev => ({ ...prev, [key]: freshTopics }));

    } catch (err) {
      console.error('Error in handleInsertTopic:', err);
      alert('Failed to insert topic: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <div className="loading">Loading subjects...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="lessons-view-container panel">
      <div className="header-row">
        <div className="title-area">
          <h2>Lesson Library</h2>
        </div>
        <button className="refresh-btn" onClick={loadSubjects} disabled={isUpdating}>Refresh Subjects</button>
      </div>

      {subjects.length === 0 ? (
        <p>No lessons found. Go to the Import tab to add some!</p>
      ) : (
        <div className="subjects-list">
          {subjects.map(subject => (
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
                  <>
                    <h3 className="subject-heading" onClick={() => toggleSubject(subject)}>
                      <span>{subject} {chaptersBySubject[subject] ? `(${chaptersBySubject[subject].length} Chapters)` : ''}</span>
                      <span className="expand-icon">{expandedSubjects[subject] ? '−' : '+'}</span>
                    </h3>
                    <div className="subject-actions">
                      <button 
                        className="edit-icon-btn" 
                        title="Rename Subject"
                        onClick={(e) => { e.stopPropagation(); setEditingSubject({ oldName: subject, newName: subject }); }}
                      >
                        ✎
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {expandedSubjects[subject] && (
                loadingChapters[subject] ? (
                  <div className="loading-sub">Loading chapters...</div>
                ) : (
                  chaptersBySubject[subject] && chaptersBySubject[subject].map(chapter => {
                    const key = `${subject}_${chapter}`;
                    const topics = topicsByChapter[key] || [];
                    const isChapterExpanded = expandedChapters[key];

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
                                {topicsByChapter[key] ? (
                                    <span>{topics.length} Lessons</span>
                                ) : null}
                            </div>
                          </div>
                          <div className="chapter-actions">
                            <button 
                              className="copy-chapter-btn" 
                              onClick={(e) => { e.stopPropagation(); handleCopyChapter(subject, chapter); }}
                              disabled={copyingChapter[key]}
                              title="Copy entire chapter in import format"
                            >
                              {copyingChapter[key] ? 'Copying...' : 'Copy Chapter'}
                            </button>
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
                          loadingTopics[key] ? (
                              <div className="loading-sub">Loading lessons...</div>
                          ) : (
                          <div className="lessons-list">
                            {addingTopicTo?.subject === subject && addingTopicTo?.chapter === chapter && addingTopicTo?.position === 0 ? (
                              <div className="insert-topic-form">
                                <h5>Insert New Lesson at Beginning</h5>
                                <div className="form-group">
                                  <label>Topic Title</label>
                                  <input 
                                    value={newTopicData.title}
                                    onChange={(e) => setNewTopicData({ ...newTopicData, title: e.target.value })}
                                  />
                                </div>
                                <div className="form-group">
                                  <label>Content (Optional)</label>
                                  <textarea 
                                    value={newTopicData.content}
                                    onChange={(e) => setNewTopicData({ ...newTopicData, content: e.target.value })}
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

                            {topics.map((topic, index) => (
                              <React.Fragment key={topic.id}>
                                <div className={`topic-card ${expandedTopicId === topic.id ? 'expanded' : ''} ${editMode === topic.id ? 'is-editing' : ''}`}>
                                  <div className="topic-header" onClick={() => toggleTopic(topic)}>
                                    <div className="topic-main-info">
                                      <h3 className="topic-title">{topic.title}</h3>
                                    </div>
                                    <div className="topic-meta">
                                      <span className="expand-icon">{expandedTopicId === topic.id ? '−' : '+'}</span>
                                    </div>
                                  </div>

                                  {expandedTopicId === topic.id && (
                                    <div className="topic-content">
                                      {loadingDetails[topic.id] ? (
                                          <div className="loading-sub">Loading details...</div>
                                      ) : (
                                      <>
                                      <div className="action-bar">
                                        {editMode !== topic.id ? (
                                          <div className="default-actions">
                                            <button className="edit-btn" onClick={(e) => { e.stopPropagation(); startEdit(topic); }}>Edit Lesson</button>
                                            <button className="delete-lesson-btn" onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.id, topic.title, subject, chapter); }} disabled={isUpdating}>Delete Lesson</button>
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
                                      </>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {addingTopicTo?.subject === subject && addingTopicTo?.chapter === chapter && addingTopicTo?.position === index + 1 ? (
                                  <div className="insert-topic-form">
                                    <h5>Insert New Lesson after {topic.title}</h5>
                                    <div className="form-group">
                                      <label>Topic Title</label>
                                      <input 
                                        value={newTopicData.title}
                                        onChange={(e) => setNewTopicData({ ...newTopicData, title: e.target.value })}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Content (Optional)</label>
                                      <textarea 
                                        value={newTopicData.content}
                                        onChange={(e) => setNewTopicData({ ...newTopicData, content: e.target.value })}
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
                          )
                        )}
                      </div>
                    );
                  })
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
