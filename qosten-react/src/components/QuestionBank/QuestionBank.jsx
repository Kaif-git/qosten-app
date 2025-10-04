import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import Statistics from '../Statistics/Statistics';
import SearchFilters from '../SearchFilters/SearchFilters';
import QuestionCard from '../QuestionCard/QuestionCard';

export default function QuestionBank() {
  const { questions, currentFilters, deleteQuestion, updateQuestion } = useQuestions();
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkMetadataEditor, setShowBulkMetadataEditor] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({ subject: '', chapter: '', lesson: '', board: '' });
  
  // Get unique metadata values from all questions
  const getUniqueValues = (field) => {
    const values = questions
      .map(q => q[field])
      .filter(val => val && val.trim() !== '' && val !== 'N/A')
      .filter((value, index, self) => self.indexOf(value) === index);
    return values.sort();
  };
  
  const uniqueSubjects = getUniqueValues('subject');
  const uniqueChapters = getUniqueValues('chapter');
  const uniqueLessons = getUniqueValues('lesson');
  const uniqueBoards = getUniqueValues('board');
  
  // Filter questions based on current filters
  const filteredQuestions = questions.filter(q => {
    const matchesSearchText = !currentFilters.searchText ||
      (q.question?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.questionText?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.answer?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.explanation?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.parts?.some(p => (p.text?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) || (p.answer?.toLowerCase().includes(currentFilters.searchText.toLowerCase()))));
    const matchesSubject = !currentFilters.subject || q.subject === currentFilters.subject;
    const matchesChapter = !currentFilters.chapter || q.chapter === currentFilters.chapter;
    const matchesLesson = !currentFilters.lesson || q.lesson === currentFilters.lesson;
    const matchesType = !currentFilters.type || q.type === currentFilters.type;
    const matchesBoard = !currentFilters.board || q.board === currentFilters.board;
    const matchesLanguage = !currentFilters.language || q.language === currentFilters.language;
    return matchesSearchText && matchesSubject && matchesChapter && matchesLesson && matchesType && matchesBoard && matchesLanguage;
  });
  
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedQuestions([]);
  };
  
  const toggleQuestionSelection = (questionId) => {
    setSelectedQuestions(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId);
      } else {
        return [...prev, questionId];
      }
    });
  };
  
  const selectAll = () => {
    setSelectedQuestions(filteredQuestions.map(q => q.id));
  };
  
  const deselectAll = () => {
    setSelectedQuestions([]);
  };
  
  const bulkDelete = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to delete.');
      return;
    }
    
    const confirmMessage = `Are you sure you want to delete ${selectedQuestions.length} question(s)? This action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      for (const id of selectedQuestions) {
        await deleteQuestion(id);
      }
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`Successfully deleted ${selectedQuestions.length} question(s).`);
    }
  };

  const bulkEditMetadata = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to edit.');
      return;
    }

    // Get the selected question objects
    const selectedQuestionObjects = questions.filter(q => selectedQuestions.includes(q.id));
    
    let updatedCount = 0;
    for (const question of selectedQuestionObjects) {
      const updatedQuestion = { ...question };
      
      // Only update fields that have values
      if (bulkMetadata.subject) {
        updatedQuestion.subject = bulkMetadata.subject;
      }
      if (bulkMetadata.chapter) {
        updatedQuestion.chapter = bulkMetadata.chapter;
      }
      if (bulkMetadata.lesson) {
        updatedQuestion.lesson = bulkMetadata.lesson;
      }
      if (bulkMetadata.board) {
        updatedQuestion.board = bulkMetadata.board;
      }
      
      try {
        await updateQuestion(updatedQuestion);
        updatedCount++;
      } catch (error) {
        console.error('Error updating question:', error);
      }
    }

    // Reset and close
    setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
    setShowBulkMetadataEditor(false);
    setSelectedQuestions([]);
    setSelectionMode(false);
    alert(`✅ Metadata updated for ${updatedCount} question(s)!`);
  };

  return (
    <>
      {/* Bulk Metadata Editor Modal */}
      {showBulkMetadataEditor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0, color: '#3498db' }}>✏️ Bulk Edit Metadata</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Update metadata for <strong>{selectedQuestions.length}</strong> selected question(s).
              Leave fields empty to keep existing values.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Subject:
                  {uniqueSubjects.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueSubjects.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="subjects-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.subject}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="subjects-list">
                    {uniqueSubjects.map((subject, idx) => (
                      <option key={idx} value={subject} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.subject}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueSubjects.map((subject, idx) => (
                      <option key={idx} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Chapter:
                  {uniqueChapters.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueChapters.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="chapters-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.chapter}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="chapters-list">
                    {uniqueChapters.map((chapter, idx) => (
                      <option key={idx} value={chapter} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.chapter}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueChapters.map((chapter, idx) => (
                      <option key={idx} value={chapter}>{chapter}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Lesson:
                  {uniqueLessons.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueLessons.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="lessons-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.lesson}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="lessons-list">
                    {uniqueLessons.map((lesson, idx) => (
                      <option key={idx} value={lesson} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.lesson}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueLessons.map((lesson, idx) => (
                      <option key={idx} value={lesson}>{lesson}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Board:
                  {uniqueBoards.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueBoards.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="boards-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.board}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="boards-list">
                    {uniqueBoards.map((board, idx) => (
                      <option key={idx} value={board} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.board}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueBoards.map((board, idx) => (
                      <option key={idx} value={board}>{board}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowBulkMetadataEditor(false);
                  setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
                }}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={bulkEditMetadata}
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ✓ Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="panel">
        <h2>Question Bank</h2>
      <Statistics questions={filteredQuestions} />
      <SearchFilters />
      
      {/* Selection Mode Controls */}
      <div className="selection-controls" style={{ 
        margin: '20px 0', 
        padding: '15px', 
        backgroundColor: selectionMode ? '#e7f3ff' : '#f9f9f9',
        borderRadius: '8px',
        border: selectionMode ? '2px solid #007bff' : '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={toggleSelectionMode}
            style={{
              backgroundColor: selectionMode ? '#6c757d' : '#007bff',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {selectionMode ? '✕ Cancel Selection' : '☑ Select Multiple'}
          </button>
          
          {selectionMode && (
            <>
              <button 
                onClick={selectAll}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Select All ({filteredQuestions.length})
              </button>
              
              <button 
                onClick={deselectAll}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#333',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Deselect All
              </button>
              
              <button 
                onClick={() => setShowBulkMetadataEditor(true)}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#3498db' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✏️ Edit Metadata ({selectedQuestions.length})
              </button>
              
              <button 
                onClick={bulkDelete}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#dc3545' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                🗑 Delete Selected ({selectedQuestions.length})
              </button>
              
              <span style={{ 
                marginLeft: 'auto', 
                fontWeight: '600', 
                color: selectedQuestions.length > 0 ? '#007bff' : '#666'
              }}>
                {selectedQuestions.length} of {filteredQuestions.length} selected
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="questionsContainer">
        {filteredQuestions.length === 0 ? (
          <p>No questions found matching your criteria.</p>
        ) : (
          filteredQuestions.map(question => (
            <QuestionCard 
              key={question.id} 
              question={question}
              selectionMode={selectionMode}
              isSelected={selectedQuestions.includes(question.id)}
              onToggleSelect={toggleQuestionSelection}
            />
          ))
        )}
      </div>
    </div>
    </>
  );
}
