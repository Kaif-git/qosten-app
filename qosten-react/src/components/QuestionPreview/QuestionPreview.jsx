import React, { useState, useRef } from 'react';
import './QuestionPreview.css';

export default function QuestionPreview({ questions, onConfirm, onCancel }) {
  const [editableQuestions, setEditableQuestions] = useState(questions);
  const [sourceDocument, setSourceDocument] = useState(null);
  const [sourceDocType, setSourceDocType] = useState(null); // 'image' or 'pdf'
  const [showCropper, setShowCropper] = useState(false);
  const [currentCroppingIndex, setCurrentCroppingIndex] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  
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
  
  const handleSourceDocumentUpload = (file) => {
    if (!file) return;
    
    const fileType = file.type;
    const reader = new FileReader();
    
    reader.onloadend = () => {
      setSourceDocument(reader.result);
      if (fileType.includes('pdf')) {
        setSourceDocType('pdf');
      } else if (fileType.includes('image')) {
        setSourceDocType('image');
      }
    };
    
    reader.readAsDataURL(file);
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
  
  const openCropper = (index) => {
    if (!sourceDocument) {
      alert('Please upload a source document first!');
      return;
    }
    if (sourceDocType === 'pdf') {
      alert('PDF cropping coming soon! Please convert PDF page to image first.');
      return;
    }
    setCurrentCroppingIndex(index);
    setShowCropper(true);
    setCropArea({ x: 10, y: 10, width: 200, height: 200 });
  };
  
  const handleCropImage = () => {
    if (!imageRef.current || currentCroppingIndex === null) return;
    
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    
    canvas.width = cropArea.width * scaleX;
    canvas.height = cropArea.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    
    const croppedImage = canvas.toDataURL('image/png');
    updateQuestion(currentCroppingIndex, 'image', croppedImage);
    setShowCropper(false);
    setCurrentCroppingIndex(null);
  };
  
  const handleMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCropArea(prev => ({
      ...prev,
      x: Math.max(0, Math.min(x - dragStart.x, rect.width - prev.width)),
      y: Math.max(0, Math.min(y - dragStart.y, rect.height - prev.height))
    }));
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const adjustCropSize = (dimension, delta) => {
    setCropArea(prev => {
      const newArea = { ...prev };
      if (dimension === 'width') {
        newArea.width = Math.max(50, prev.width + delta);
      } else if (dimension === 'height') {
        newArea.height = Math.max(50, prev.height + delta);
      }
      return newArea;
    });
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
          <div className="image-buttons-group">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(index, e.target.files[0])}
              className="image-upload-input"
            />
            {sourceDocument && (
              <button 
                type="button"
                onClick={() => openCropper(index)}
                className="crop-from-source-btn"
              >
                ✂️ Crop from Source
              </button>
            )}
          </div>
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
          <div className="image-buttons-group">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(index, e.target.files[0])}
              className="image-upload-input"
            />
            {sourceDocument && (
              <button 
                type="button"
                onClick={() => openCropper(index)}
                className="crop-from-source-btn"
              >
                ✂️ Crop from Source
              </button>
            )}
          </div>
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
    <>
      <div className="preview-modal-overlay">
        <div className="preview-modal">
          <h2>Preview & Edit Questions</h2>
          <p className="preview-count">
            Review and edit <strong>{editableQuestions.length}</strong> question{editableQuestions.length !== 1 ? 's' : ''} before adding to the question bank.
          </p>
          
          {/* Source Document Upload Section */}
          <div className="source-document-section">
            <h3>📄 Source Document (Optional)</h3>
            <p style={{fontSize: '14px', color: '#666', margin: '5px 0 10px 0'}}>
              Upload the original PDF or image to compare and crop from
            </p>
            <div className="source-upload-buttons">
              <label className="source-upload-btn">
                📷 Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSourceDocumentUpload(e.target.files[0])}
                  style={{display: 'none'}}
                />
              </label>
              <label className="source-upload-btn">
                📄 Upload PDF
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => handleSourceDocumentUpload(e.target.files[0])}
                  style={{display: 'none'}}
                />
              </label>
              {sourceDocument && (
                <span className="source-uploaded-indicator">
                  ✓ Source {sourceDocType} uploaded
                </span>
              )}
            </div>
            
            {/* Source Document Viewer */}
            {sourceDocument && (
              <div className="source-document-viewer">
                {sourceDocType === 'image' && (
                  <img src={sourceDocument} alt="Source" className="source-document-image" />
                )}
                {sourceDocType === 'pdf' && (
                  <iframe
                    src={sourceDocument}
                    className="source-document-pdf"
                    title="Source PDF"
                  />
                )}
              </div>
            )}
          </div>
          
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
      
      {/* Image Cropper Modal */}
      {showCropper && sourceDocument && (
        <div className="cropper-modal-overlay">
          <div className="cropper-modal">
            <h3>Crop Image from Source</h3>
            <p style={{fontSize: '14px', color: '#666', margin: '5px 0 15px 0'}}>
              Drag the box to select the area you want to crop
            </p>
            
            <div className="cropper-controls">
              <button type="button" onClick={() => adjustCropSize('width', -20)}>Width -</button>
              <button type="button" onClick={() => adjustCropSize('width', 20)}>Width +</button>
              <button type="button" onClick={() => adjustCropSize('height', -20)}>Height -</button>
              <button type="button" onClick={() => adjustCropSize('height', 20)}>Height +</button>
              <span style={{marginLeft: 'auto'}}>Size: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}px</span>
            </div>
            
            <div 
              className="cropper-container"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img 
                ref={imageRef}
                src={sourceDocument} 
                alt="Crop source" 
                className="cropper-image"
              />
              <div 
                className="crop-box"
                style={{
                  left: `${cropArea.x}px`,
                  top: `${cropArea.y}px`,
                  width: `${cropArea.width}px`,
                  height: `${cropArea.height}px`
                }}
              >
                <div className="crop-handle" />
              </div>
            </div>
            
            <div className="cropper-actions">
              <button className="crop-confirm-btn" onClick={handleCropImage}>
                ✂️ Crop & Apply
              </button>
              <button className="crop-cancel-btn" onClick={() => setShowCropper(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
