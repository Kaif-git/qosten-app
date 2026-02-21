import React, { useState, useEffect } from 'react';
import { labApi } from '../../services/labApi';
import { questionApi } from '../../services/questionApi';
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
  const [syncAllProgress, setSyncAllProgress] = useState(null); // { current, total }

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

  const handleSyncAllImages = async () => {
    if (problems.length === 0) return;
    if (!window.confirm(`This will scan ${problems.length} lab problems and sync images from the database. Continue?`)) return;

    setIsUpdating(true);
    setSyncAllProgress({ current: 0, total: problems.length });
    
    try {
      const ids = problems.map(p => p.lab_problem_id).filter(Boolean);
      const questionMap = {};
      
      console.log(`🔍 Starting bulk sync for ${ids.length} IDs...`);

      // Fetch matching questions in smaller chunks for parallel speed
      const CHUNK_SIZE = 50;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);
        console.log(`📡 Fetching batch ${i/CHUNK_SIZE + 1} (${chunk.length} IDs)...`);
        const questions = await questionApi.fetchQuestionsByIds(chunk);
        
        questions.forEach(q => {
          if (q.id) questionMap[String(q.id)] = q;
          if (q.lab_problem_id) questionMap[String(q.lab_problem_id)] = q;
        });
        setSyncAllProgress(prev => ({ ...prev, current: Math.min(i + CHUNK_SIZE, ids.length) }));
      }

      const foundCount = Object.keys(questionMap).length;
      console.log(`✅ Fetched ${foundCount} unique questions from API.`);
      if (foundCount > 0) {
        const firstQ = questionMap[Object.keys(questionMap)[0]];
        console.log('📝 Sample Question Props:', Object.keys(firstQ).filter(k => k.toLowerCase().includes('image')));
      }

      let updateCount = 0;
      let alreadySyncedCount = 0;
      let noImageInApiCount = 0;
      let notFoundCount = 0;

      setSyncAllProgress({ current: 0, total: problems.length, stage: 'Analyzing and Updating...' });

      const isRealImage = (str) => {
        if (!str || typeof str !== 'string') return false;
        const s = str.toLowerCase();
        if (s.includes('there is a picture') || s.includes('ছবি আছে')) return false;
        if (s.startsWith('[') && s.endsWith(']')) return false;
        return s.length > 10;
      };

      // Process updates in smaller parallel chunks to avoid blocking and speed up
      const updateTasks = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < problems.length; i++) {
        const problem = problems[i];
        const labId = String(problem.lab_problem_id);
        const q = questionMap[labId];
        
        if (q) {
          const updateData = {};
          
          // Detect properties (handle both camelCase and lowercase from API)
          const apiQuestionImage = q.questionimage || q.questionImage || q.image;
          const apiImg1 = q.answerimage1 || q.answerImage1;
          const apiImg2 = q.answerimage2 || q.answerImage2;
          const apiImg3 = q.answerimage3 || q.answerImage3;
          const apiImg4 = q.answerimage4 || q.answerImage4;

          if (isRealImage(apiQuestionImage) && apiQuestionImage !== problem.questionimage) updateData.questionimage = apiQuestionImage;
          if (isRealImage(apiImg1) && apiImg1 !== problem.answerimage1) updateData.answerimage1 = apiImg1;
          if (isRealImage(apiImg2) && apiImg2 !== problem.answerimage2) updateData.answerimage2 = apiImg2;
          if (isRealImage(apiImg3) && apiImg3 !== problem.answerimage3) updateData.answerimage3 = apiImg3;
          if (isRealImage(apiImg4) && apiImg4 !== problem.answerimage4) updateData.answerimage4 = apiImg4;
          
          if (isRealImage(apiQuestionImage) && apiQuestionImage !== problem.stem_image) updateData.stem_image = apiQuestionImage;

          if (Object.keys(updateData).length > 0) {
            updateTasks.push({ id: problem.id, labId, data: updateData });
          } else {
            const hasAnyApiImage = [apiQuestionImage, apiImg1, apiImg2, apiImg3, apiImg4].some(isRealImage);
            if (hasAnyApiImage) alreadySyncedCount++;
            else noImageInApiCount++;
          }
        } else {
          notFoundCount++;
        }
      }

      console.log(`📊 Analysis: ${updateTasks.length} to update, ${alreadySyncedCount} already synced, ${noImageInApiCount} no images in API, ${notFoundCount} not found.`);

      // Execute updates in batches
      for (let i = 0; i < updateTasks.length; i += BATCH_SIZE) {
        const chunk = updateTasks.slice(i, i + BATCH_SIZE);
        await Promise.all(chunk.map(task => 
          labApi.updateLabProblem(task.id, task.data)
            .then(() => { updateCount++; })
            .catch(err => console.error(`Failed to update ${task.labId}:`, err))
        ));
        setSyncAllProgress(prev => ({ ...prev, current: i + chunk.length, total: updateTasks.length, stage: 'Saving Updates...' }));
      }

      alert(`Sync Complete!\n\n- Updated: ${updateCount}\n- Already synced: ${alreadySyncedCount}\n- No images in API: ${noImageInApiCount}\n- Questions not found: ${notFoundCount}`);
      await loadProblems();
    } catch (err) {
      console.error('Bulk sync failed:', err);
      alert('Bulk sync failed: ' + err.message);
    } finally {
      setIsUpdating(false);
      setSyncAllProgress(null);
    }
  };

  const handleSyncImages = async (problem, shouldSave = true) => {
    if (!problem.lab_problem_id) {
      alert('Error: Lab problem ID is missing.');
      return;
    }

    setIsUpdating(true);
    try {
      const questions = await questionApi.fetchQuestionsByIds([problem.lab_problem_id]);
      if (!questions || questions.length === 0) {
        alert('Could not find a matching question in the database.');
        setIsUpdating(false);
        return;
      }

      const q = questions[0];
      const updateData = {
        questionimage: q.image || null,
        answerimage1: q.answerimage1 || null,
        answerimage2: q.answerimage2 || null,
        answerimage3: q.answerimage3 || null,
        answerimage4: q.answerimage4 || null,
        // Also update stem_image if it was used
        stem_image: q.image || null
      };

      if (shouldSave) {
        await labApi.updateLabProblem(problem.id, updateData);
        
        // Update local state
        setProblems(prev => prev.map(p => 
          p.id === problem.id ? { ...p, ...updateData } : p
        ));
        
        alert(`Successfully synced and saved images for ${problem.lab_problem_id}!`);
      }
      
      if (editMode === problem.id) {
        setEditedData(prev => ({ ...prev, ...updateData }));
        if (!shouldSave) {
          alert(`Images pulled into fields for ${problem.lab_problem_id}. Don't forget to Save Changes!`);
        }
      }
      
    } catch (err) {
      console.error('Error syncing images:', err);
      alert('Sync failed: ' + err.message);
    } finally {
      setIsUpdating(false);
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
        <div className="header-actions">
          <button className="sync-all-btn" onClick={handleSyncAllImages} disabled={isUpdating}>
            🔄 Sync All Missing Images
          </button>
          <button className="refresh-btn" onClick={loadProblems} disabled={isUpdating}>Refresh</button>
        </div>
      </div>

      {syncAllProgress && (
        <div className="sync-progress-overlay">
          <div className="sync-progress-box">
            <h4>Syncing Lab Images...</h4>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${(syncAllProgress.current / syncAllProgress.total) * 100}%` }}
              ></div>
            </div>
            <p>{syncAllProgress.stage || 'Fetching from API...'}</p>
            <span>{syncAllProgress.current} / {syncAllProgress.total}</span>
          </div>
        </div>
      )}

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
                                    <button className="sync-btn" onClick={(e) => { e.stopPropagation(); handleSyncImages(problem, true); }} disabled={isUpdating}>
                                      🔄 Sync Images
                                    </button>
                                    <button className="delete-problem-btn" onClick={(e) => { e.stopPropagation(); handleDeleteProblem(problem.id, problem.lab_problem_id); }} disabled={isUpdating}>Delete Problem</button>
                                  </div>
                                ) : (
                                  <div className="edit-actions">
                                    <button className="save-btn" onClick={saveProblemChanges} disabled={isUpdating}>
                                      {isUpdating ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button className="sync-btn" onClick={(e) => { e.stopPropagation(); handleSyncImages(editedData, false); }} disabled={isUpdating}>
                                      🔄 Sync to Fields
                                    </button>
                                    <button className="cancel-btn" onClick={cancelEdit} disabled={isUpdating}>Cancel</button>
                                  </div>
                                )}
                              </div>

                              <section className="stem-section">
                                <h4>Stem</h4>
                                {editMode === problem.id ? (
                                  <>
                                    <textarea 
                                      className="edit-textarea stem-input"
                                      value={editedData.stem}
                                      onChange={(e) => handleDataChange('stem', e.target.value)}
                                    />
                                    <div className="images-edit-grid">
                                      <div className="image-edit-block">
                                        <label>Question Image URL (from API):</label>
                                        <input 
                                          type="text"
                                          className="edit-input"
                                          value={editedData.questionimage || ''}
                                          onChange={(e) => handleDataChange('questionimage', e.target.value)}
                                          placeholder="questionimage URL/Base64"
                                        />
                                        {editedData.questionimage && (
                                          <img src={editedData.questionimage} alt="Question Preview" className="preview-img-small" />
                                        )}
                                      </div>
                                      <div className="image-edit-block">
                                        <label>Stem Image URL (legacy):</label>
                                        <input 
                                          type="text"
                                          className="edit-input"
                                          value={editedData.stem_image || ''}
                                          onChange={(e) => handleDataChange('stem_image', e.target.value)}
                                          placeholder="stem_image URL/Base64"
                                        />
                                        {editedData.stem_image && (
                                          <img src={editedData.stem_image} alt="Stem Preview" className="preview-img-small" />
                                        )}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="stem-content">
                                    {problem.stem}
                                    <div className="problem-images-row">
                                      {problem.questionimage && (
                                        <div className="problem-image-container">
                                          <span className="image-label">Question Image:</span>
                                          <img src={problem.questionimage} alt="Question" className="problem-image" />
                                        </div>
                                      )}
                                      {problem.stem_image && (
                                        <div className="problem-image-container">
                                          <span className="image-label">Stem Image (Legacy):</span>
                                          <img src={problem.stem_image} alt="Stem" className="problem-image" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </section>

                              <section className="images-section">
                                <h4>Answer Images</h4>
                                <div className="answer-images-grid">
                                  {[
                                    { key: 'answerimage3', label: 'Part A Image' },
                                    { key: 'answerimage4', label: 'Part B Image' },
                                    { key: 'answerimage1', label: 'Part C Image' },
                                    { key: 'answerimage2', label: 'Part D Image' }
                                  ].map(img => (
                                    <div key={img.key} className="answer-image-item">
                                      <label>{img.label}:</label>
                                      {editMode === problem.id ? (
                                        <>
                                          <input 
                                            type="text"
                                            className="edit-input"
                                            value={editedData[img.key] || ''}
                                            onChange={(e) => handleDataChange(img.key, e.target.value)}
                                            placeholder="URL/Base64"
                                          />
                                          {editedData[img.key] && (
                                            <img src={editedData[img.key]} alt="Preview" className="preview-img-small" />
                                          )}
                                        </>
                                      ) : (
                                        problem[img.key] ? (
                                          <div className="problem-image-container">
                                            <img src={problem[img.key]} alt={img.label} className="problem-image" />
                                          </div>
                                        ) : <span>No image</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
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
