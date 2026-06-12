import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useQuestions } from '../../context/QuestionContext';
import { useAI } from '../../context/AIContext';
import { useNavigate } from 'react-router-dom';
import LatexRenderer from '../LatexRenderer/LatexRenderer';
import ImageLinkingModal from '../ImageLinkingModal/ImageLinkingModal';
import VideoLinkModal from '../VideoLinkModal/VideoLinkModal';

const AIActionPopup = ({ position, onClose, onSelect }) => {
  if (!position) return null;

  const actions = [
    { id: 'fix_latex', label: '🔢 Fix LaTeX', task: 'fix_latex' },
    { id: 'improve_clarity', label: '✍️ Improve Clarity', task: 'improve_clarity' },
    { id: 'fact_check', label: '✅ Fact Check', task: 'fact_check' },
    { id: 'gen_explanation', label: '💡 Gen Explanation', task: 'generate_explanation' },
  ];

  // Use Portal to render at body level, bypassing all parent clipping/stacking
  return ReactDOM.createPortal(
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} 
        onClick={onClose} 
      />
      <div 
        className="ai-action-popup"
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          zIndex: 10001,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          padding: '5px',
          minWidth: '180px',
          pointerEvents: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '8px', fontSize: '11px', fontWeight: 'bold', color: '#6f42c1', borderBottom: '1px solid #eee' }}>
          AI QUICK ACTIONS
        </div>
        {actions.map(action => (
          <div
            key={action.id}
            className="ai-action-item"
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: '13px',
              borderRadius: '4px',
              transition: 'background 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onClick={() => onSelect(action.task)}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0ff'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {action.label}
          </div>
        ))}
        <div 
          style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid #eee', fontSize: '11px', color: '#999', cursor: 'pointer' }}
          onClick={onClose}
        >
          Cancel
        </div>
      </div>
    </>,
    document.body
  );
};

function QuestionCard({ 
  question, 
  selectionMode, 
  isSelected, 
  onToggleSelect, 
  onActivateSelection, 
  onAIClick, 
  isLab, 
  videoCount = 0, 
  onVideoUpdate 
}) {
  const { 
    deleteQuestion, 
    setEditingQuestion, 
    toggleQuestionFlag, 
    toggleReviewQueue, 
    toggleQuestionVerification, 
    updateQuestion,
    rollbackQuestion,
    history 
  } = useQuestions();
  const { addToQueue, queue } = useAI();
  const navigate = useNavigate();
  const [showImageLinkingModal, setShowImageLinkingModal] = useState(false);
  const [showVideoLinkModal, setShowVideoLinkModal] = useState(false);
  const [aiPopup, setAiPopup] = useState(null); // { x, y, field }
  const [hoveredField, setHoveredField] = useState(null);

  // Check if a specific field is already in the AI queue for this question
  const isFieldQueued = (field) => {
    return queue.some(t => t.questionId === question.id && t.field === field);
  };

  const handleFieldClick = (e, field) => {
    if (selectionMode) return;
    e.stopPropagation();
    
    // Adjust position to keep popup on screen
    let x = e.clientX;
    let y = e.clientY;
    if (x + 200 > window.innerWidth) x -= 200;
    if (y + 250 > window.innerHeight) y -= 250;

    setAiPopup({ x, y, field });
  };

  const getInteractiveStyle = (field) => {
    const isQueued = isFieldQueued(field);
    const isHovered = hoveredField === field;

    return {
      marginBottom: '10px',
      cursor: 'pointer',
      padding: '4px 8px',
      margin: '-4px -8px 6px -8px',
      borderRadius: '4px',
      transition: 'all 0.2s',
      // Priority: Queued > Hovered > Default
      backgroundColor: isQueued 
        ? 'rgba(111, 66, 193, 0.12)' 
        : (isHovered ? 'rgba(111, 66, 193, 0.06)' : 'transparent'),
      border: isQueued
        ? '1px solid #6f42c1'
        : (isHovered ? '1px dashed #6f42c1' : '1px solid transparent'),
      position: 'relative'
    };
  };

  const handleAISelect = (task) => {
    if (aiPopup) {
      addToQueue(question, aiPopup.field, task);
      setAiPopup(null);
    }
  };
  
  const handleCardClick = (e) => {
    if (selectionMode) {
      console.log('[Card Debug] Card clicked in selection mode. Question ID:', question.id);
      onToggleSelect(question.id, e);
    } else if (e.shiftKey && onActivateSelection) {
      console.log('[Card Debug] Shift+Click detected. Activating selection mode for:', question.id);
      onActivateSelection(question.id);
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
    e.stopPropagation();
    await toggleQuestionFlag(question.id);
  };

  const handleToggleQueue = async (e) => {
    e.stopPropagation();
    await toggleReviewQueue(question.id);
  };

  const handleToggleVerification = async (e) => {
    e.stopPropagation();
    await toggleQuestionVerification(question.id);
  };
  
  const handleLinkImages = async (imageData) => {
    try {
      const updatedQuestion = {
        ...question,
        image: imageData.image,
        answerimage1: imageData.answerimage1,
        answerimage2: imageData.answerimage2,
        answerimage3: imageData.answerimage3,
        answerimage4: imageData.answerimage4,
        parts: (question.parts || []).map(p => ({ ...p, image: null, answerImage: null }))
      };
      await updateQuestion(updatedQuestion);
    } catch (error) {
      console.error('Error linking images:', error);
    }
  };

  const handleUnlinkImages = async () => {
    try {
      const updatedQuestion = {
        ...question,
        image: null,
        answerimage1: null,
        answerimage2: null,
        answerimage3: null,
        answerimage4: null,
        parts: (question.parts || []).map(p => ({ ...p, image: null, answerImage: null }))
      };
      await updateQuestion(updatedQuestion);
    } catch (error) {
      console.error('Error unlinking images:', error);
    }
  };

  const renderQuestionContent = () => {
    console.log(`🖼️ [QuestionCard] Rendering Q#${question.id} content. Type: ${question.type}`);
    if (question.type === 'mcq') {
      return (
        <>
          <div 
            style={getInteractiveStyle('questionText')}
            onClick={(e) => handleFieldClick(e, 'questionText')}
            onMouseEnter={() => setHoveredField('questionText')}
            onMouseLeave={() => setHoveredField(null)}
            title="Click for AI Actions"
          >
            <strong>Question:</strong> {question.board && <span style={{color: '#666', fontSize: '0.9em', fontWeight: 'normal'}}>({question.board})</span>} <LatexRenderer text={question.questionText || question.question || 'N/A'} />
          </div>
          {question.image && (
            <img src={question.image} alt="Question" style={{maxWidth: '200px', maxHeight: '200px', marginBottom: '10px'}} />
          )}
          {question.options && Array.isArray(question.options) ? (
            <ul className="options-list">
              {question.options.map((option, index) => (
                <li key={index} className={question.correctAnswer && option.label === question.correctAnswer ? 'correct' : ''}>
                  <LatexRenderer text={option.text || 'N/A'} />
                  {option.image && (
                    <img src={option.image} alt={`Option ${option.label}`} style={{maxWidth: '100px', maxHeight: '100px', display: 'block', marginTop: '5px'}} />
                  )}
                </li>
              ))}
            </ul>
          ) : ( <p>No options available</p> )}
          <div style={{ marginBottom: '10px' }}><strong>Correct Answer:</strong> {question.correctAnswer ? question.correctAnswer.toUpperCase() : 'N/A'}</div>
          {question.explanation && (
            <div 
              style={getInteractiveStyle('explanation')}
              onClick={(e) => handleFieldClick(e, 'explanation')}
              onMouseEnter={() => setHoveredField('explanation')}
              onMouseLeave={() => setHoveredField(null)}
              title="Click for AI Actions"
            >
              <strong>Explanation:</strong> <LatexRenderer text={question.explanation} />
            </div>
          )}
        </>
      );
    } else if (question.type === 'cq') {
      return (
        <>
          <div 
            style={getInteractiveStyle('questionText')}
            onClick={(e) => handleFieldClick(e, 'questionText')}
            onMouseEnter={() => setHoveredField('questionText')}
            onMouseLeave={() => setHoveredField(null)}
            title="Click for AI Actions"
          >
            <strong>Question:</strong> {question.board && <span style={{color: '#666', fontSize: '0.9em', fontWeight: 'normal'}}>({question.board})</span>} <LatexRenderer text={question.questionText || 'N/A'} />
          </div>
          {question.image && (
            <img src={question.image} alt="Question" style={{maxWidth: '200px', maxHeight: '200px', marginBottom: '10px'}} />
          )}
          {question.parts && Array.isArray(question.parts) ? (
            <ul className="options-list">
              {question.parts.map((part, index) => {
                const letter = part.letter?.toLowerCase();
                const fieldKey = `part_${part.letter}`;
                let partImage = part.image;
                if (letter === 'a' && question.answerimage3 && question.answerimage3 !== '[There is a picture for part a]' && question.answerimage3 !== '[ছবি আছে জন্য অংশ a]') partImage = question.answerimage3;
                else if (letter === 'b' && question.answerimage4 && question.answerimage4 !== '[There is a picture for part b]' && question.answerimage4 !== '[ছবি আছে জন্য অংশ b]') partImage = question.answerimage4;
                else if (letter === 'c' && question.answerimage1 && question.answerimage1 !== '[There is a picture for part c]' && question.answerimage1 !== '[ছবি আছে জন্য অংশ c]') partImage = question.answerimage1;
                else if (letter === 'd' && question.answerimage2 && question.answerimage2 !== '[There is a picture for part d]' && question.answerimage2 !== '[ছবি আছে জন্য অংশ d]') partImage = question.answerimage2;
                
                return (
                  <li 
                    key={index} 
                    style={{ ...getInteractiveStyle(fieldKey), listStyle: 'none' }}
                    onClick={(e) => handleFieldClick(e, fieldKey)}
                    onMouseEnter={() => setHoveredField(fieldKey)}
                    onMouseLeave={() => setHoveredField(null)}
                    title="Click for AI Actions"
                  >
                    <strong>Part {part.letter?.toUpperCase() || 'N/A'}:</strong> <LatexRenderer text={part.text || 'N/A'} /><br/>
                    <strong>Answer:</strong> <LatexRenderer text={part.answer || 'N/A'} />
                    {partImage && (
                      <img src={partImage} alt={`Part ${part.letter} answer`} style={{maxWidth: '100px', maxHeight: '100px', display: 'block', marginTop: '5px'}} />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : ( <p>No parts available</p> )}
        </>
      );
    } else if (question.type === 'sq') {
      return (
        <div 
          style={getInteractiveStyle('entire_question')}
          onClick={(e) => handleFieldClick(e, 'entire_question')}
          onMouseEnter={() => setHoveredField('entire_question')}
          onMouseLeave={() => setHoveredField(null)}
          title="Click for AI Actions"
        >
          <div style={{ marginBottom: '10px' }}><strong>Question:</strong> {question.board && <span style={{color: '#666', fontSize: '0.9em', fontWeight: 'normal'}}>({question.board})</span>} <LatexRenderer text={question.questionText || question.question || 'N/A'} /></div>
          {question.image && (
            <img src={question.image} alt="Question" style={{maxWidth: '200px', maxHeight: '200px', marginBottom: '10px'}} />
          )}
          <div style={{ marginBottom: '10px' }}><strong>Answer:</strong> <LatexRenderer text={question.answer || 'N/A'} /></div>
        </div>
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
        position: 'relative',
        transition: 'transform 0.1s ease',
        boxShadow: !selectionMode ? '0 2px 4px rgba(155, 89, 182, 0.1)' : undefined
      }}
      onMouseEnter={(e) => { if (!selectionMode) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { if (!selectionMode) e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <AIActionPopup position={aiPopup} onClose={() => setAiPopup(null)} onSelect={handleAISelect} />
      {!selectionMode && (
        <div style={{ position: 'absolute', top: '5px', right: '5px', fontSize: '14px', opacity: 0.6, pointerEvents: 'none' }}> ✨ </div>
      )}
      {selectionMode && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', width: '30px', height: '30px', borderRadius: '50%', backgroundColor: isSelected ? '#007bff' : '#fff', border: '2px solid #007bff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: isSelected ? '#fff' : '#007bff', fontSize: '18px', zIndex: 10 }}>
          {isSelected ? '✓' : ''}
        </div>
      )}
      
      <div className="metadata">
        <span>Subject: {question.subject || 'N/A'}</span>
        <span>Chapter: {question.chapter || 'N/A'}</span>
        <span>Type: {question.type ? question.type.toUpperCase() : 'N/A'}</span>
        {question.isFlagged && ( <span style={{ backgroundColor: '#e74c3c', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}> 🚩 FLAGGED </span> )}
        {question.isVerified && ( <span style={{ backgroundColor: '#27ae60', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}> ✅ VERIFIED </span> )}
      </div>
      
      {renderQuestionContent()}
      
      {!selectionMode && (
        <div className="actions">
          <button onClick={handleToggleFlag} style={{ backgroundColor: question.isFlagged ? '#27ae60' : '#e74c3c', color: 'white', border: 'none' }}> {question.isFlagged ? '✓ Unflag' : '🚩 Flag'} </button>
          <button onClick={handleToggleQueue} style={{ backgroundColor: question.inReviewQueue ? '#e67e22' : '#3498db', color: 'white', border: 'none' }}> {question.inReviewQueue ? '📋 De-queue' : '📋 Queue'} </button>
          <button onClick={handleToggleVerification} style={{ backgroundColor: question.isVerified ? '#f1c40f' : '#27ae60', color: 'white', border: 'none' }}> {question.isVerified ? '❌ Unverify' : '✅ Verify'} </button>
          {history[question.id]?.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); if (window.confirm('Rollback this question?')) rollbackQuestion(question.id); }} style={{ backgroundColor: '#e67e22', color: 'white', border: 'none' }}> ↩ Undo AI </button>
          )}
          <button onClick={handleEdit}>Edit</button>
          <button className="danger" onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  );
}

export default React.memo(QuestionCard);
