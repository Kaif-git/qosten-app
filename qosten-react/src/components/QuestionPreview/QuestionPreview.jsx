import React, { useState } from 'react';
import './QuestionPreview.css';

export default function QuestionPreview({ questions, onConfirm, onCancel }) {
  const [editableQuestions, setEditableQuestions] = useState(questions);
  
  if (!questions || questions.length === 0) return null;
  
  const updateQuestion = (index, field, value) => {
    setEditableQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };
  
  const updateQuestionOption = (qIndex, optIndex, field, value) => {
    setEditableQuestions(prev => {
      const updated = [...prev];
      const options = [...updated[qIndex].options];
      options[optIndex] = { ...options[optIndex], [field]: value };
      updated[qIndex] = { ...updated[qIndex], options };
      return updated;
    });
  };
  
  const updateQuestionPart = (qIndex, partIndex, field, value) => {
    setEditableQuestions(prev => {
      const updated = [...prev];
      const parts = [...updated[qIndex].parts];
      parts[partIndex] = { ...parts[partIndex], [field]: value };
      updated[qIndex] = { ...updated[qIndex], parts };
      return updated;
    });
  };
  
  const handleImageUpload = (index, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateQuestion(index, 'image', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeImage = (index) => {
    updateQuestion(index, 'image', null);
  };

  const renderMCQPreview = (question, index) => (
    <div key={index} className="question-preview-item">
      <h4>Question {index + 1} - MCQ</h4>
      <div className="preview-metadata-edit">
        <input
          type="text"
          placeholder="Subject"
          value={question.subject || ''}
          onChange={(e) => updateQuestion(index, 'subject', e.target.value)}
        />
        <input
          type="text"
          placeholder="Chapter"
          value={question.chapter || ''}
          onChange={(e) => updateQuestion(index, 'chapter', e.target.value)}
        />
        <input
          type="text"
          placeholder="Lesson"
          value={question.lesson || ''}
          onChange={(e) => updateQuestion(index, 'lesson', e.target.value)}
        />
        <input
          type="text"
          placeholder="Board"
          value={question.board || ''}
          onChange={(e) => updateQuestion(index, 'board', e.target.value)}
        />
      </div>
      <div className="preview-content">
        <div className="image-upload-section">
          <label className="image-upload-label">Question Image (Optional):</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(index, e.target.files[0])}
            className="image-upload-input"
          />
          {question.image && (
            <div className="image-preview-container">
              <img src={question.image} alt="Question" className="preview-uploaded-image" />
              <button 
                className="remove-image-btn" 
                onClick={() => removeImage(index)}
                type="button"
              >
                ✕ Remove Image
              </button>
            </div>
          )}
        </div>
        
        <label className="edit-label">Question Text:</label>
        <textarea
          className="preview-question-edit"
          value={question.question || question.questionText || ''}
          onChange={(e) => updateQuestion(index, question.question ? 'question' : 'questionText', e.target.value)}
          rows={3}
        />
        
        {question.options && question.options.length > 0 && (
          <div className="preview-options-edit">
            <label className="edit-label">Options:</label>
            {question.options.map((opt, i) => (
              <div key={i} className="option-edit-row">
                <input
                  type="radio"
                  name={`correct-${index}`}
                  checked={opt.label === question.correctAnswer}
                  onChange={() => updateQuestion(index, 'correctAnswer', opt.label)}
                />
                <strong>{opt.label.toUpperCase()})</strong>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => updateQuestionOption(index, i, 'text', e.target.value)}
                  className="option-text-input"
                />
              </div>
            ))}
          </div>
        )}
        
        <label className="edit-label">Explanation (Optional):</label>
        <textarea
          className="preview-explanation-edit"
          value={question.explanation || ''}
          onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
          rows={2}
          placeholder="Enter explanation..."
        />
      </div>
    </div>
  );

  const renderCQPreview = (question, index) => (
    <div key={index} className="question-preview-item">
      <h4>Question {index + 1} - CQ</h4>
      <div className="preview-metadata-edit">
        <input
          type="text"
          placeholder="Subject"
          value={question.subject || ''}
          onChange={(e) => updateQuestion(index, 'subject', e.target.value)}
        />
        <input
          type="text"
          placeholder="Chapter"
          value={question.chapter || ''}
          onChange={(e) => updateQuestion(index, 'chapter', e.target.value)}
        />
        <input
          type="text"
          placeholder="Lesson"
          value={question.lesson || ''}
          onChange={(e) => updateQuestion(index, 'lesson', e.target.value)}
        />
        <input
          type="text"
          placeholder="Board"
          value={question.board || ''}
          onChange={(e) => updateQuestion(index, 'board', e.target.value)}
        />
      </div>
      <div className="preview-content">
        <div className="image-upload-section">
          <label className="image-upload-label">Stem Image (Optional):</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleImageUpload(index, e.target.files[0])}
            className="image-upload-input"
          />
          {question.image && (
            <div className="image-preview-container">
              <img src={question.image} alt="Question Stem" className="preview-uploaded-image" />
              <button 
                className="remove-image-btn" 
                onClick={() => removeImage(index)}
                type="button"
              >
                ✕ Remove Image
              </button>
            </div>
          )}
        </div>
        
        <label className="edit-label">Question Stem:</label>
        <textarea
          className="preview-question-edit"
          value={question.questionText || ''}
          onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
          rows={3}
        />
        
        {question.parts && question.parts.length > 0 && (
          <div className="preview-parts-edit">
            <label className="edit-label">Parts:</label>
            {question.parts.map((part, i) => (
              <div key={i} className="preview-part-edit">
                <div className="part-header">
                  <strong>{part.letter})</strong>
                  <input
                    type="number"
                    value={part.marks || 0}
                    onChange={(e) => updateQuestionPart(index, i, 'marks', parseInt(e.target.value) || 0)}
                    className="marks-input"
                    min="0"
                    placeholder="Marks"
                  />
                  <span className="marks-label">marks</span>
                </div>
                <textarea
                  value={part.text || ''}
                  onChange={(e) => updateQuestionPart(index, i, 'text', e.target.value)}
                  className="part-text-input"
                  rows={2}
                  placeholder="Part text..."
                />
                <textarea
                  value={part.answer || ''}
                  onChange={(e) => updateQuestionPart(index, i, 'answer', e.target.value)}
                  className="part-answer-input"
                  rows={2}
                  placeholder="Answer..."
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSQPreview = (question, index) => (
    <div key={index} className="question-preview-item">
      <h4>Question {index + 1} - SQ</h4>
      <div className="preview-metadata-edit">
        <input
          type="text"
          placeholder="Subject"
          value={question.subject || ''}
          onChange={(e) => updateQuestion(index, 'subject', e.target.value)}
        />
        <input
          type="text"
          placeholder="Chapter"
          value={question.chapter || ''}
          onChange={(e) => updateQuestion(index, 'chapter', e.target.value)}
        />
        <input
          type="text"
          placeholder="Lesson"
          value={question.lesson || ''}
          onChange={(e) => updateQuestion(index, 'lesson', e.target.value)}
        />
        <input
          type="text"
          placeholder="Board"
          value={question.board || ''}
          onChange={(e) => updateQuestion(index, 'board', e.target.value)}
        />
      </div>
      <div className="preview-content">
        <label className="edit-label">Question Text:</label>
        <textarea
          className="preview-question-edit"
          value={question.question || question.questionText || ''}
          onChange={(e) => updateQuestion(index, question.question ? 'question' : 'questionText', e.target.value)}
          rows={3}
        />
        
        <label className="edit-label">Answer:</label>
        <textarea
          className="preview-answer-edit"
          value={question.answer || ''}
          onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
          rows={3}
          placeholder="Enter answer..."
        />
      </div>
    </div>
  );

  const renderQuestionPreview = (question, index) => {
    switch (question.type) {
      case 'mcq':
        return renderMCQPreview(question, index);
      case 'cq':
        return renderCQPreview(question, index);
      case 'sq':
        return renderSQPreview(question, index);
      default:
        return renderMCQPreview(question, index);
    }
  };

  return (
    <div className="preview-modal-overlay">
      <div className="preview-modal">
        <h2>Preview & Edit Questions</h2>
        <p className="preview-count">
          Review and edit <strong>{editableQuestions.length}</strong> question{editableQuestions.length !== 1 ? 's' : ''} before adding to the question bank.
        </p>
        <div className="preview-questions-container">
          {editableQuestions.map((question, index) => renderQuestionPreview(question, index))}
        </div>
        <div className="preview-modal-actions">
          <button className="confirm-btn" onClick={() => onConfirm(editableQuestions)}>
            Confirm & Add to Question Bank
          </button>
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
