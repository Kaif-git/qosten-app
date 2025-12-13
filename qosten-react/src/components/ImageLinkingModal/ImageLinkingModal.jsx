import React, { useState, useEffect } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import LatexRenderer from '../LatexRenderer/LatexRenderer';

export default function ImageLinkingModal({ question, onClose, onLink, onUnlink }) {
  const { questions } = useQuestions();
  const [searchText, setSearchText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  // Get available English CQ questions
  const englishCQs = questions.filter(q => 
    q.type === 'cq' && 
    q.language === 'en' &&
    q.id !== question.id // Don't link to itself
  );

  // Unique lists for filters
  const uniqueSubjects = [...new Set(englishCQs.map(q => q.subject).filter(Boolean))].sort();
  const uniqueChapters = selectedSubject 
    ? [...new Set(englishCQs.filter(q => q.subject === selectedSubject).map(q => q.chapter).filter(Boolean))].sort()
    : [...new Set(englishCQs.map(q => q.chapter).filter(Boolean))].sort();

  // Apply filters
  useEffect(() => {
    let filtered = englishCQs;

    if (selectedSubject) {
      filtered = filtered.filter(q => q.subject === selectedSubject);
    }
    if (selectedChapter) {
      filtered = filtered.filter(q => q.chapter === selectedChapter);
    }
    if (boardSearch.trim()) {
      const boardLower = boardSearch.toLowerCase();
      filtered = filtered.filter(q => q.board?.toLowerCase().includes(boardLower));
    }
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(q => 
        (q.questionText?.toLowerCase().includes(searchLower)) ||
        (q.lesson?.toLowerCase().includes(searchLower))
      );
    }

    setFilteredQuestions(filtered);
  }, [searchText, selectedSubject, selectedChapter, boardSearch, questions, question.id]);

  const handleLink = () => {
    if (!selectedQuestion) {
      alert('Please select a question to link with.');
      return;
    }

    // Pass the selected question to parent component
    onLink({
      image: selectedQuestion.image,
      answerimage1: selectedQuestion.answerimage1,
      answerimage2: selectedQuestion.answerimage2
    });

    alert(`✓ Images linked successfully from question ${selectedQuestion.id}!`);
    onClose();
  };

  const handleUnlink = () => {
    if (onUnlink) onUnlink();
    alert('✓ Image linking removed!');
    onClose();
  };

  return (
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
        maxWidth: '800px',
        width: '90%',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{ marginTop: 0, color: '#007bff', marginBottom: '20px' }}>
          🔗 Link Images from English CQ
        </h3>

        <p style={{ color: '#666', marginBottom: '20px' }}>
          Select an English CQ to copy its images (stem, answer image 1, and answer image 2) to this question.
        </p>

        {/* Filters */}
        <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px' }}>Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(''); }}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
            >
              <option value="">All subjects</option>
              {uniqueSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px' }}>Chapter</label>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
            >
              <option value="">All chapters</option>
              {uniqueChapters.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px' }}>Search board</label>
            <input
              type="text"
              placeholder="e.g., DB24, JB21, SB20"
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#555', marginBottom: '6px' }}>Search question/lesson</label>
            <input
              type="text"
              placeholder="Type to search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
            />
          </div>
        </div>

        {/* Questions List */}
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '6px',
          marginBottom: '20px'
        }}>
          {filteredQuestions.length === 0 ? (
            <p style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
              No English CQ questions found.
            </p>
          ) : (
            filteredQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => setSelectedQuestion(q)}
                style={{
                  padding: '15px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: selectedQuestion?.id === q.id ? '#e7f3ff' : '#fff',
                  border: selectedQuestion?.id === q.id ? '2px solid #007bff' : 'none',
                  transition: 'background-color 0.2s'
                }}
              >
              <div style={{ marginBottom: '8px' }}>
                <strong style={{ color: '#007bff' }}>ID: {q.id}</strong>
                <span style={{ marginLeft: '15px', color: '#666', fontSize: '12px' }}>
                  {q.board && <span style={{ marginRight: '15px' }}>📋 Board: <strong>{q.board}</strong></span>}
                  Subject: {q.subject} | Chapter: {q.chapter}
                </span>
              </div>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  <strong>Question:</strong> <LatexRenderer text={q.questionText || 'N/A'} />
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {q.image && <span style={{ marginRight: '10px' }}>🖼️ Stem Image</span>}
                  {q.answerimage1 && <span style={{ marginRight: '10px' }}>🖼️ Answer Image 1</span>}
                  {q.answerimage2 && <span>🖼️ Answer Image 2</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Question Preview */}
        {selectedQuestion && (
          <div style={{
            backgroundColor: '#f0f8ff',
            padding: '15px',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '2px solid #007bff'
          }}>
            <h4 style={{ marginTop: 0, color: '#007bff' }}>Selected Question</h4>
            <p><strong>ID:</strong> {selectedQuestion.id}</p>
            {selectedQuestion.board && <p><strong>📋 Board:</strong> {selectedQuestion.board}</p>}
            <p><strong>Subject:</strong> {selectedQuestion.subject}</p>
            <p><strong>Chapter:</strong> {selectedQuestion.chapter}</p>
            <p><strong>Lesson:</strong> {selectedQuestion.lesson}</p>
            <div style={{ marginTop: '10px' }}>
              <strong>Images to be linked:</strong>
              <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                {selectedQuestion.image && (
                  <li>
                    Stem Image
                    <img
                      src={selectedQuestion.image}
                      alt="Stem"
                      style={{ maxWidth: '150px', maxHeight: '150px', display: 'block', marginTop: '5px' }}
                    />
                  </li>
                )}
                {selectedQuestion.answerimage1 && (
                  <li>
                    Answer Image 1
                    <img
                      src={selectedQuestion.answerimage1}
                      alt="Answer 1"
                      style={{ maxWidth: '150px', maxHeight: '150px', display: 'block', marginTop: '5px' }}
                    />
                  </li>
                )}
                {selectedQuestion.answerimage2 && (
                  <li>
                    Answer Image 2
                    <img
                      src={selectedQuestion.answerimage2}
                      alt="Answer 2"
                      style={{ maxWidth: '150px', maxHeight: '150px', display: 'block', marginTop: '5px' }}
                    />
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
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
            onClick={handleLink}
            disabled={!selectedQuestion}
            style={{
              backgroundColor: selectedQuestion ? '#007bff' : '#ccc',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: selectedQuestion ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            🔗 Link Images
          </button>
          <button
            onClick={handleUnlink}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            ✖ Unlink Images
          </button>
        </div>
      </div>
    </div>
  );
}
