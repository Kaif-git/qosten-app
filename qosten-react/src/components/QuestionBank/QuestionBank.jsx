import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import Statistics from '../Statistics/Statistics';
import SearchFilters from '../SearchFilters/SearchFilters';
import QuestionCard from '../QuestionCard/QuestionCard';

export default function QuestionBank() {
  const { questions, currentFilters, deleteQuestion } = useQuestions();
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  
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

  return (
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
  );
}
