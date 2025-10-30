import React from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { useNavigate } from 'react-router-dom';
import LatexRenderer from '../LatexRenderer/LatexRenderer';

export default function QuestionCard({ question, selectionMode, isSelected, onToggleSelect }) {
  const { deleteQuestion, setEditingQuestion, toggleQuestionFlag } = useQuestions();
  const navigate = useNavigate();
  
  const handleCardClick = () => {
    if (selectionMode) {
      onToggleSelect(question.id);
    }
  };
  
  const handleEdit = () => {
    setEditingQuestion(question);
    navigate('/add');
  };
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      await deleteQuestion(question.id);
    }
  };
  
  const handleToggleFlag = async (e) => {
    e.stopPropagation(); // Prevent card click when toggling flag
    await toggleQuestionFlag(question.id);
  };
  
  const renderQuestionContent = () => {
    if (question.type === 'mcq') {
      return (
        <>
          <p><strong>Question:</strong> <LatexRenderer text={question.question || 'N/A'} /></p>
          {question.image && (
            <img 
              src={question.image} 
              alt="Question" 
              style={{maxWidth: '200px', maxHeight: '200px', marginBottom: '10px'}} 
            />
          )}
          {question.options && Array.isArray(question.options) ? (
            <ul className="options-list">
              {question.options.map((option, index) => (
                <li 
                  key={index} 
                  className={question.correctAnswer && option.label === question.correctAnswer ? 'correct' : ''}
                >
                  <LatexRenderer text={option.text || 'N/A'} />
                  {option.image && (
                    <img 
                      src={option.image} 
                      alt={`Option ${option.label}`}
                      style={{maxWidth: '100px', maxHeight: '100px', display: 'block', marginTop: '5px'}} 
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No options available</p>
          )}
          <p><strong>Correct Answer:</strong> {question.correctAnswer ? question.correctAnswer.toUpperCase() : 'N/A'}</p>
          {question.explanation && <p><strong>Explanation:</strong> <LatexRenderer text={question.explanation} /></p>}
        </>
      );
    } else if (question.type === 'cq') {
      return (
        <>
          <p><strong>Question:</strong> <LatexRenderer text={question.questionText || 'N/A'} /></p>
          {question.image && (
            <img 
              src={question.image} 
              alt="Question" 
              style={{maxWidth: '200px', maxHeight: '200px', marginBottom: '10px'}} 
            />
          )}
          {question.parts && Array.isArray(question.parts) ? (
            <ul className="options-list">
              {question.parts.map((part, index) => {
                let partImage = part.image;
                if (part.letter === 'c' && question.answerimage1 && 
                    question.answerimage1 !== '[There is a picture for part c]' && 
                    question.answerimage1 !== '[ছবি আছে জন্য অংশ c]') {
                  partImage = question.answerimage1;
                } else if (part.letter === 'd' && question.answerimage2 && 
                           question.answerimage2 !== '[There is a picture for part d]' && 
                           question.answerimage2 !== '[ছবি আছে জন্য অংশ d]') {
                  partImage = question.answerimage2;
                }
                
                return (
                  <li key={index}>
                    <strong>Part {part.letter?.toUpperCase() || 'N/A'}:</strong> <LatexRenderer text={part.text || 'N/A'} /><br/>
                    <strong>Answer:</strong> <LatexRenderer text={part.answer || 'N/A'} />
                    {partImage && (
                      <img 
                        src={partImage} 
                        alt={`Part ${part.letter} answer`}
                        style={{maxWidth: '100px', maxHeight: '100px', display: 'block', marginTop: '5px'}} 
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No parts available</p>
          )}
        </>
      );
    } else if (question.type === 'sq') {
      return (
        <>
          <p><strong>Question:</strong> <LatexRenderer text={question.question || 'N/A'} /></p>
          {question.image && (
            <img 
              src={question.image} 
              alt="Question" 
              style={{maxWidth: '200px', maxHeight: '200px', marginBottom: '10px'}} 
            />
          )}
          <p><strong>Answer:</strong> <LatexRenderer text={question.answer || 'N/A'} /></p>
        </>
      );
    }
    return null;
  };

  return (
    <div 
      className={`question ${selectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''} ${question.isFlagged ? 'flagged' : ''}`}
      onClick={handleCardClick}
      style={{
        cursor: selectionMode ? 'pointer' : 'default',
        border: isSelected ? '3px solid #007bff' : (question.isFlagged ? '2px solid #e74c3c' : undefined),
        backgroundColor: isSelected ? '#e7f3ff' : (question.isFlagged ? '#fff5f5' : undefined),
        position: 'relative'
      }}
    >
      {selectionMode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          backgroundColor: isSelected ? '#007bff' : '#fff',
          border: '2px solid #007bff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: isSelected ? '#fff' : '#007bff',
          fontSize: '18px',
          zIndex: 10
        }}>
          {isSelected ? '✓' : ''}
        </div>
      )}
      
      <div className="metadata">
        <span>Subject: {question.subject || 'N/A'}</span>
        <span>Chapter: {question.chapter || 'N/A'}</span>
        <span>Lesson: {question.lesson || 'N/A'}</span>
        <span>Board: {question.board || 'N/A'}</span>
        <span>Type: {question.type ? question.type.toUpperCase() : 'N/A'}</span>
        {question.isFlagged && (
          <span style={{ 
            backgroundColor: '#e74c3c', 
            color: 'white', 
            padding: '2px 8px', 
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            🚩 FLAGGED
          </span>
        )}
      </div>
      
      {renderQuestionContent()}
      
      {!selectionMode && (
        <div className="actions">
          <button 
            onClick={handleToggleFlag}
            style={{
              backgroundColor: question.isFlagged ? '#27ae60' : '#e74c3c',
              color: 'white',
              border: 'none'
            }}
          >
            {question.isFlagged ? '✓ Unflag' : '🚩 Flag'}
          </button>
          <button onClick={handleEdit}>Edit</button>
          <button className="danger" onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}
