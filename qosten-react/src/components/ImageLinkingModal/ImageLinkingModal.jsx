import React, { useState, useEffect } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import LatexRenderer from '../LatexRenderer/LatexRenderer';
import FullQuestionContent from '../FullQuestionContent/FullQuestionContent';

export default function ImageLinkingModal({ question, onClose, onLink, onUnlink }) {
  const { questions } = useQuestions();
  const [searchText, setSearchText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [boardSearch, setBoardSearch] = useState('');
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  const [targetLanguage, setTargetLanguage] = useState(question.language === 'bn' ? 'en' : 'bn');
  const [showAutoSuggest, setShowAutoSuggest] = useState(question.language === 'bn');

  // Get available CQ questions for linking
  const linkableQuestions = questions.filter(q => 
    q.type === 'cq' && 
    q.id !== question.id // Don't link to itself
  );

  // Filter based on selected language
  const languageFilteredQuestions = linkableQuestions.filter(q => q.language === targetLanguage);

  // Dynamic unique lists for filters - only show options that have results given OTHER filters
  const uniqueSubjects = [...new Set(languageFilteredQuestions
    .filter(q => (!selectedChapter || q.chapter === selectedChapter) && (!boardSearch || q.board === boardSearch))
    .map(q => q.subject)
    .filter(Boolean)
  )].sort();

  const uniqueChapters = [...new Set(languageFilteredQuestions
    .filter(q => (!selectedSubject || q.subject === selectedSubject) && (!boardSearch || q.board === boardSearch))
    .map(q => q.chapter)
    .filter(Boolean)
  )].sort();

  const uniqueBoards = [...new Set(languageFilteredQuestions
    .filter(q => (!selectedSubject || q.subject === selectedSubject) && (!selectedChapter || q.chapter === selectedChapter))
    .map(q => q.board)
    .filter(Boolean)
  )].sort();

  // Apply filters for the final list display
  useEffect(() => {
    let filtered = languageFilteredQuestions;

    if (selectedSubject) {
      filtered = filtered.filter(q => q.subject === selectedSubject);
    }
    if (selectedChapter) {
      filtered = filtered.filter(q => q.chapter === selectedChapter);
    }
    if (boardSearch) {
      filtered = filtered.filter(q => q.board === boardSearch);
    }
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(q => 
        (q.questionText?.toLowerCase().includes(searchLower)) ||
        (q.lesson?.toLowerCase().includes(searchLower)) ||
        (q.id.toString() === searchLower)
      );
    }

    setFilteredQuestions(filtered);
  }, [searchText, selectedSubject, selectedChapter, boardSearch, targetLanguage, questions, question.id]);

  const findCounterpart = () => {
    // Try to find the exact English counterpart for this Bangla question
    // Match based on Chapter, Lesson, Board and Question similarity
    const counterparts = questions.filter(q => 
      q.type === 'cq' && 
      q.language === 'en' &&
      q.chapter === question.chapter &&
      (q.board === question.board || (q.board?.includes(question.board) || question.board?.includes(q.board)))
    );

    if (counterparts.length > 0) {
      // Sort by some similarity or just pick first
      setSelectedQuestion(counterparts[0]);
      setTargetLanguage('en');
      alert(`💡 Found ${counterparts.length} potential counterpart(s). Selected ID: ${counterparts[0].id}`);
    } else {
      alert('❌ No direct counterpart found. Try manual search.');
    }
  };

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
        <h3 style={{ marginTop: 0, color: '#007bff', marginBottom: '10px' }}>
          🔗 Image Linking / Duplication
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Source Language:</span>
            <div style={{ display: 'flex', backgroundColor: '#eee', borderRadius: '20px', padding: '4px' }}>
              <button
                onClick={() => setTargetLanguage('en')}
                style={{
                  padding: '5px 15px',
                  borderRadius: '15px',
                  border: 'none',
                  backgroundColor: targetLanguage === 'en' ? '#007bff' : 'transparent',
                  color: targetLanguage === 'en' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                English
              </button>
              <button
                onClick={() => setTargetLanguage('bn')}
                style={{
                  padding: '5px 15px',
                  borderRadius: '15px',
                  border: 'none',
                  backgroundColor: targetLanguage === 'bn' ? '#007bff' : 'transparent',
                  color: targetLanguage === 'bn' ? 'white' : '#333',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px'
                }}
              >
                Bangla
              </button>
            </div>
          </div>
          
          {question.language === 'bn' && (
            <button
              onClick={findCounterpart}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold'
              }}
            >
              🔍 Auto-find English Counterpart
            </button>
          )}
        </div>

        <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
          Link images from another question. Current question is <strong>{question.language === 'en' ? 'English' : 'Bangla'}</strong>.
        </p>

        {/* Filters */}
        <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedChapter(''); }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
            >
              <option value="">All subjects</option>
              {uniqueSubjects.map((s, i) => <option key={i} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>Chapter</label>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
            >
              <option value="">All chapters</option>
              {uniqueChapters.map((c, i) => <option key={i} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>Board</label>
            <select
              value={boardSearch}
              onChange={(e) => setBoardSearch(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
            >
              <option value="">All boards</option>
              {uniqueBoards.map((b, i) => <option key={i} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '6px', textTransform: 'uppercase' }}>Text Search</label>
            <input
              type="text"
              placeholder="Search text or ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Main Content Area - Split Layout */}
        <div style={{ display: 'flex', gap: '20px', height: '60vh', minHeight: '400px', marginBottom: '20px' }}>
          {/* Left Side: Search Results List */}
          <div style={{ flex: '0 0 35%', display: 'flex', flexDirection: 'column', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#f1f1f1', padding: '10px 15px', fontWeight: 'bold', borderBottom: '1px solid #ddd', fontSize: '14px' }}>
              Results ({filteredQuestions.length})
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredQuestions.length === 0 ? (
                <p style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No questions found.</p>
              ) : (
                filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuestion(q)}
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid #eee',
                      cursor: 'pointer',
                      backgroundColor: selectedQuestion?.id === q.id ? '#e7f3ff' : '#fff',
                      borderLeft: selectedQuestion?.id === q.id ? '4px solid #007bff' : '4px solid transparent',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <div style={{ marginBottom: '5px' }}>
                      <strong style={{ color: '#007bff' }}>ID: {q.id}</strong>
                      <span style={{ marginLeft: '10px', fontSize: '11px', color: '#666' }}>{q.board}</span>
                    </div>
                    <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {q.questionText || q.question}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Side: Comparison Preview */}
          <div style={{ flex: '1', display: 'flex', gap: '10px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
            {/* Target Question Column (The one we're editing) */}
            <div style={{ flex: 1, borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column', backgroundColor: '#f9f9f9' }}>
              <div style={{ padding: '10px 15px', backgroundColor: '#e9ecef', fontWeight: 'bold', borderBottom: '1px solid #ddd', fontSize: '13px' }}>
                CURRENT QUESTION (Target)
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                  ID: {question.id} | {question.language?.toUpperCase()} | {question.subject}
                </div>
                <FullQuestionContent question={question} />
              </div>
            </div>

            {/* Source Question Column (The one we're copying from) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
              <div style={{ padding: '10px 15px', backgroundColor: '#d1ecf1', color: '#0c5460', fontWeight: 'bold', borderBottom: '1px solid #bee5eb', fontSize: '13px' }}>
                SOURCE QUESTION (Link From)
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                {selectedQuestion ? (
                  <>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                      ID: {selectedQuestion.id} | {selectedQuestion.language?.toUpperCase()} | {selectedQuestion.subject}
                    </div>
                    <FullQuestionContent question={selectedQuestion} />
                    
                    <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b8daff' }}>
                      <strong style={{ display: 'block', marginBottom: '10px', color: '#0056b3' }}>🖼️ Images to be Copied:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {selectedQuestion.image && <div style={{ textAlign: 'center' }}><img src={selectedQuestion.image} alt="S" style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1px solid #ccc' }} /><br/><span style={{ fontSize: '10px' }}>Stem</span></div>}
                        {selectedQuestion.answerimage1 && <div style={{ textAlign: 'center' }}><img src={selectedQuestion.answerimage1} alt="A1" style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1px solid #ccc' }} /><br/><span style={{ fontSize: '10px' }}>Ans 1</span></div>}
                        {selectedQuestion.answerimage2 && <div style={{ textAlign: 'center' }}><img src={selectedQuestion.answerimage2} alt="A2" style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1px solid #ccc' }} /><br/><span style={{ fontSize: '10px' }}>Ans 2</span></div>}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', textAlign: 'center', padding: '20px' }}>
                    Select a question from the list on the left to see its content and images for comparison.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #eee' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
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
              backgroundColor: selectedQuestion ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              padding: '10px 25px',
              borderRadius: '6px',
              cursor: selectedQuestion ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold',
              boxShadow: selectedQuestion ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            🔗 LINK IMAGES TO TARGET
          </button>
          <button
            onClick={handleUnlink}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ✖ Unlink All
          </button>
        </div>
      </div>
    </div>
  );
}
