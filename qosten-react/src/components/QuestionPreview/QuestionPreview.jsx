import React, { useState, useRef, useEffect } from 'react';
import './QuestionPreview.css';
import LatexRenderer from '../LatexRenderer/LatexRenderer';
import { useQuestions } from '../../context/QuestionContext';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using unpkg CDN with matching version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function QuestionPreview({ questions, onConfirm, onCancel, title, isEditMode = false }) {
  const { questions: dbQuestions, addQuestion } = useQuestions();
  const CACHE_KEY = 'qosten_preview_cache';

  const getInitialQuestions = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log('📦 Restored', parsed.length, 'preview question(s) from cache');
        return parsed;
      }
    } catch (e) {
      console.error('Error reading preview cache', e);
    }
    return questions;
  };

  const [editableQuestions, setEditableQuestions] = useState(getInitialQuestions());
  const [sourceDocument, setSourceDocument] = useState(null);
  const [sourceDocType, setSourceDocType] = useState(null); // 'image' or 'pdf'
  const [pdfPages, setPdfPages] = useState([]);
  const [currentPdfPage, setCurrentPdfPage] = useState(0);
  const [pdfAsImage, setPdfAsImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [currentCroppingIndex, setCurrentCroppingIndex] = useState(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState(null); // Store PDF data
  const [selectedQuestions, setSelectedQuestions] = useState(new Set());
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({ subject: '', chapter: '', lesson: '', board: '' });
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom level for cropper display
  const [panX, setPanX] = useState(0); // Pan offset X
  const [panY, setPanY] = useState(0); // Pan offset Y
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const cropperContainerRef = useRef(null);
  
  // Autosave preview questions to cache
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(editableQuestions));
    } catch (e) {
      console.error('Error saving preview cache', e);
    }
  }, [editableQuestions, CACHE_KEY]);

  const clearPreviewCache = () => {
    try {
      localStorage.removeItem(CACHE_KEY);
      alert('🧹 Cleared local preview cache');
    } catch (e) {
      console.error('Error clearing preview cache', e);
    }
  };
  
  // Get unique metadata values from both preview questions AND existing database questions
  const getUniqueValues = (field) => {
    // Combine preview questions and database questions
    const allQuestions = [...editableQuestions, ...dbQuestions];
    const values = allQuestions
      .map(q => q[field])
      .filter(val => val && val.trim() !== '' && val !== 'N/A')
      .filter((value, index, self) => self.indexOf(value) === index);
    return values.sort();
  };
  
  const uniqueSubjects = getUniqueValues('subject');
  const uniqueChapters = getUniqueValues('chapter');
  const uniqueLessons = getUniqueValues('lesson');
  const uniqueBoards = getUniqueValues('board');
  
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

  // Upload/remove answer images for CQ parts
  const handlePartImageUpload = (qIndex, partIndex, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        // Save to the part
        updateQuestionPart(qIndex, partIndex, 'answerImage', dataUrl);
        // Also map to top-level columns if part is c or d
        setEditableQuestions(prev => {
          const updated = [...prev];
          const partLetter = updated[qIndex]?.parts?.[partIndex]?.letter?.toLowerCase();
          if (partLetter === 'c') {
            updated[qIndex] = { ...updated[qIndex], answerimage1: dataUrl };
          } else if (partLetter === 'd') {
            updated[qIndex] = { ...updated[qIndex], answerimage2: dataUrl };
          }
          return updated;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removePartImage = (qIndex, partIndex) => {
    updateQuestionPart(qIndex, partIndex, 'answerImage', null);
    setEditableQuestions(prev => {
      const updated = [...prev];
      const partLetter = updated[qIndex]?.parts?.[partIndex]?.letter?.toLowerCase();
      if (partLetter === 'c') {
        updated[qIndex] = { ...updated[qIndex], answerimage1: null };
      } else if (partLetter === 'd') {
        updated[qIndex] = { ...updated[qIndex], answerimage2: null };
      }
      return updated;
    });
  };
  
  const convertPdfPageToImage = async (pdfData, pageNumber) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber);
      
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      return null;
    }
  };

  const handleSourceDocumentUpload = async (file) => {
    if (!file) return;
    
    const fileType = file.type;
    
    if (fileType.includes('pdf')) {
      setSourceDocType('pdf');
      // Convert PDF to images using FileReader
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          // FileReader gives us an ArrayBuffer that we can use
          const arrayBuffer = reader.result;
          // Create a Uint8Array copy that we can safely store
          const uint8Array = new Uint8Array(arrayBuffer);
          // Store a copy for later use
          setPdfArrayBuffer(uint8Array.slice());
          
          // Load PDF with a separate copy (pdfjsLib will transfer/detach this one)
          const loadingTask = pdfjsLib.getDocument({ data: uint8Array.slice() });
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;
          
          const pages = [];
          for (let i = 1; i <= numPages; i++) {
            pages.push(i);
          }
          setPdfPages(pages);
          setCurrentPdfPage(1);
          
          // Convert first page to image with another copy
          const imageData = await convertPdfPageToImage(uint8Array.slice(), 1);
          setPdfAsImage(imageData);
          setSourceDocument(imageData); // Store first page as source
        } catch (error) {
          console.error('Error processing PDF:', error);
          alert('Error processing PDF file. Please try again.');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } else if (fileType.includes('image')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceDocument(reader.result);
      };
      reader.readAsDataURL(file);
      
      setSourceDocType('image');
      setPdfAsImage(null);
      setPdfPages([]);
      setPdfArrayBuffer(null);
    }
  };
  
  const handlePdfPageChange = async (pageNumber) => {
    if (!pdfArrayBuffer) {
      console.error('PDF data not available');
      return;
    }
    
    setCurrentPdfPage(pageNumber);
    // Convert selected PDF page to image using a fresh copy of the Uint8Array
    const imageData = await convertPdfPageToImage(pdfArrayBuffer.slice(), pageNumber);
    setPdfAsImage(imageData);
    setSourceDocument(imageData); // Update source document with new page
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
    console.log('📸 Opening cropper with index:', index);
    console.log('📄 Source document available:', !!sourceDocument);
    if (!sourceDocument) {
      alert('Please upload a source document first!');
      return;
    }
    setCurrentCroppingIndex(index);
    setShowCropper(true);
    setCropArea({ x: 10, y: 10, width: 200, height: 200 });
    setZoomLevel(1);
    setPanX(0);
    setPanY(0);
    
    // Auto-scroll to the top of cropper modal when opened
    setTimeout(() => {
      const overlay = document.querySelector('.cropper-modal-overlay');
      if (overlay) {
        overlay.scrollTop = 0;
        console.log('⬆️ Scrolled overlay to top (scrollTop: 0)');
      }
    }, 100);
    
    console.log('✅ Cropper state updated, showCropper should be true');
  };
  
  const handleCropImage = () => {
    if (!imageRef.current || currentCroppingIndex === null) return;
    
    const img = imageRef.current;
    const canvas = document.createElement('canvas');
    // Account for zoom: displayed size is layout size times zoomLevel
    const displayedWidth = img.width * zoomLevel;
    const displayedHeight = img.height * zoomLevel;
    const scaleX = img.naturalWidth / displayedWidth;
    const scaleY = img.naturalHeight / displayedHeight;
    
    // Account for pan offset when cropping
    const adjustedX = (cropArea.x + panX) * scaleX;
    const adjustedY = (cropArea.y + panY) * scaleY;
    
    canvas.width = cropArea.width * scaleX;
    canvas.height = cropArea.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      adjustedX,
      adjustedY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );
    
    const croppedImage = canvas.toDataURL('image/png');

    // If cropping for a part, save to that part and map to top-level columns; otherwise save as stem image
    if (typeof currentCroppingIndex === 'object' && currentCroppingIndex !== null && currentCroppingIndex.type === 'part') {
      const { qIndex, partIndex } = currentCroppingIndex;
      updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImage);
      setEditableQuestions(prev => {
        const updated = [...prev];
        const partLetter = updated[qIndex]?.parts?.[partIndex]?.letter?.toLowerCase();
        if (partLetter === 'c') {
          updated[qIndex] = { ...updated[qIndex], answerimage1: croppedImage };
        } else if (partLetter === 'd') {
          updated[qIndex] = { ...updated[qIndex], answerimage2: croppedImage };
        }
        return updated;
      });
    } else {
      updateQuestion(currentCroppingIndex, 'image', croppedImage);
    }

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
  
  // Touch event handlers for mobile support
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x: x - cropArea.x, y: y - cropArea.y });
  };
  
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setCropArea(prev => ({
      ...prev,
      x: Math.max(0, Math.min(x - dragStart.x, rect.width - prev.width)),
      y: Math.max(0, Math.min(y - dragStart.y, rect.height - prev.height))
    }));
  };
  
  const handleTouchEnd = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const adjustCropSize = (dimension, delta) => {
    setCropArea(prev => {
      const newArea = { ...prev };
      if (dimension === 'width') {
        newArea.width = Math.max(1, prev.width + delta);
      } else if (dimension === 'height') {
        newArea.height = Math.max(1, prev.height + delta);
      }
      return newArea;
    });
  };

  const adjustZoom = (delta) => {
    setZoomLevel(prev => {
      const next = prev + delta;
      // Keep a reasonable range but allow strong zoom-in
      return Math.min(20, Math.max(0.1, next));
    });
  };

  const pan = (direction, amount = 20) => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const maxPanX = Math.max(0, img.width * zoomLevel - img.width);
    const maxPanY = Math.max(0, img.height * zoomLevel - img.height);

    switch (direction) {
      case 'left':
        setPanX(prev => Math.max(0, prev - amount));
        break;
      case 'right':
        setPanX(prev => Math.min(maxPanX, prev + amount));
        break;
      case 'up':
        setPanY(prev => Math.max(0, prev - amount));
        break;
      case 'down':
        setPanY(prev => Math.min(maxPanY, prev + amount));
        break;
      default:
        break;
    }
  };

  const resetPan = () => {
    setPanX(0);
    setPanY(0);
  };

  const moveCropBox = (direction, amount = 10) => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const maxX = Math.max(0, img.width - cropArea.width);
    const maxY = Math.max(0, img.height - cropArea.height);

    switch (direction) {
      case 'left':
        setCropArea(prev => ({ ...prev, x: Math.max(0, prev.x - amount) }));
        break;
      case 'right':
        setCropArea(prev => ({ ...prev, x: Math.min(maxX, prev.x + amount) }));
        break;
      case 'up':
        setCropArea(prev => ({ ...prev, y: Math.max(0, prev.y - amount) }));
        break;
      case 'down':
        setCropArea(prev => ({ ...prev, y: Math.min(maxY, prev.y + amount) }));
        break;
      default:
        break;
    }
  };
  
  const removeImage = (index) => {
    updateQuestion(index, 'image', null);
  };

  const uploadSingleQuestion = async (index) => {
    const q = editableQuestions[index];
    if (!q) return;
    try {
      console.log('📑 Uploading single question:', index + 1);
      await addQuestion(q);
      alert(`✅ Uploaded question #${index + 1}`);
      // Remove from preview after successful upload
      setEditableQuestions(prev => prev.filter((_, i) => i !== index));
    } catch (e) {
      console.error('Error uploading single question', e);
      alert('❌ Failed to upload this question: ' + e.message);
    }
  };

  const toggleQuestionSelection = (index) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAllQuestions = () => {
    const allIndices = editableQuestions.map((_, idx) => idx);
    setSelectedQuestions(new Set(allIndices));
  };

  const deselectAllQuestions = () => {
    setSelectedQuestions(new Set());
  };

  const applyBulkMetadata = () => {
    if (selectedQuestions.size === 0) {
      alert('Please select at least one question.');
      return;
    }

    setEditableQuestions(prev => {
      const updated = [...prev];
      selectedQuestions.forEach(index => {
        if (bulkMetadata.subject) {
          updated[index] = { ...updated[index], subject: bulkMetadata.subject };
        }
        if (bulkMetadata.chapter) {
          updated[index] = { ...updated[index], chapter: bulkMetadata.chapter };
        }
        if (bulkMetadata.lesson) {
          updated[index] = { ...updated[index], lesson: bulkMetadata.lesson };
        }
        if (bulkMetadata.board) {
          updated[index] = { ...updated[index], board: bulkMetadata.board };
        }
      });
      return updated;
    });

    // Reset and close
    setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
    setShowBulkEditor(false);
    setSelectedQuestions(new Set());
    alert(`✅ Metadata updated for ${selectedQuestions.size} question(s)!`);
  };

  const renderMCQPreview = (question, index) => (
    <div key={index} className="question-preview-item" style={{
      border: selectedQuestions.has(index) ? '3px solid #3498db' : undefined,
      backgroundColor: selectedQuestions.has(index) ? '#f0f8ff' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Question {index + 1} - MCQ</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={selectedQuestions.has(index)}
              onChange={() => toggleQuestionSelection(index)}
              style={{ marginRight: '5px', cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <span>Select</span>
          </label>
          <button type="button" onClick={() => uploadSingleQuestion(index)} style={{ backgroundColor: '#8e44ad', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Upload this</button>
        </div>
      </div>
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
        <div className="edit-with-preview">
          <textarea
            className="preview-question-edit"
            value={question.question || question.questionText || ''}
            onChange={(e) => updateQuestion(index, question.question ? 'question' : 'questionText', e.target.value)}
            rows={3}
          />
          {(question.question || question.questionText) && (
            <div className="latex-preview-box">
              <strong>Preview:</strong>
              <LatexRenderer text={question.question || question.questionText || ''} />
            </div>
          )}
        </div>
        
        {question.options && question.options.length > 0 && (
          <div className="preview-options-edit">
            <label className="edit-label">Options:</label>
            {question.options.map((opt, i) => (
              <div key={i} className="option-edit-container">
                <div className="option-edit-row">
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
                {opt.text && (
                  <div className="latex-preview-box" style={{marginTop: '5px', marginLeft: '45px'}}>
                    <strong>Preview:</strong>
                    <LatexRenderer text={opt.text} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        <label className="edit-label">Explanation (Optional):</label>
        <div className="edit-with-preview">
          <textarea
            className="preview-explanation-edit"
            value={question.explanation || ''}
            onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
            rows={2}
            placeholder="Enter explanation..."
          />
          {question.explanation && (
            <div className="latex-preview-box">
              <strong>Preview:</strong>
              <LatexRenderer text={question.explanation} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderCQPreview = (question, index) => (
    <div key={index} className="question-preview-item" style={{
      border: selectedQuestions.has(index) ? '3px solid #3498db' : undefined,
      backgroundColor: selectedQuestions.has(index) ? '#f0f8ff' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Question {index + 1} - CQ</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={selectedQuestions.has(index)}
              onChange={() => toggleQuestionSelection(index)}
              style={{ marginRight: '5px', cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <span>Select</span>
          </label>
          <button type="button" onClick={() => uploadSingleQuestion(index)} style={{ backgroundColor: '#8e44ad', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Upload this</button>
        </div>
      </div>
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
        <div className="edit-with-preview">
          <textarea
            className="preview-question-edit"
            value={question.questionText || ''}
            onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
            rows={3}
          />
          {question.questionText && (
            <div className="latex-preview-box">
              <strong>Preview:</strong>
              <LatexRenderer text={question.questionText} />
            </div>
          )}
        </div>
        
        {question.parts && question.parts.length > 0 && (
          <div className="preview-parts-edit">
            <label className="edit-label">Parts:</label>
            {question.parts.map((part, i) => (
              <div key={i} className="preview-part-edit">
                <div className="part-header">
                  <strong>Part {part.letter})</strong>
                </div>
                <div className="edit-with-preview">
                  <textarea
                    value={part.text || ''}
                    onChange={(e) => updateQuestionPart(index, i, 'text', e.target.value)}
                    className="part-text-input"
                    rows={2}
                    placeholder="Part text..."
                  />
                  {part.text && (
                    <div className="latex-preview-box">
                      <strong>Question Preview:</strong>
                      <LatexRenderer text={part.text} />
                    </div>
                  )}
                </div>
                <div className="edit-with-preview">
                  <textarea
                    value={part.answer || ''}
                    onChange={(e) => updateQuestionPart(index, i, 'answer', e.target.value)}
                    className="part-answer-input"
                    rows={5}
                    placeholder="Answer..."
                  />
                  {part.answer && (
                    <div className="latex-preview-box">
                      <strong>Answer Preview:</strong>
                      <LatexRenderer text={part.answer} />
                    </div>
                  )}
                </div>

                {(part.letter?.toLowerCase() === 'c' || part.letter?.toLowerCase() === 'd') && (
                  <div style={{ marginTop: '10px' }}>
                    <label className="image-upload-label">
                      {part.letter?.toLowerCase() === 'c' ? 'Answer Image 1 (answerimage1)' : 'Answer Image 2 (answerimage2)'}
                    </label>
                    <div className="image-buttons-group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePartImageUpload(index, i, e.target.files[0])}
                        className="image-upload-input"
                        style={{ marginBottom: '10px' }}
                      />
                      {sourceDocument && (
                        <button 
                          type="button"
                          onClick={() => {
                            setCurrentCroppingIndex({ type: 'part', qIndex: index, partIndex: i });
                            setShowCropper(true);
                            setCropArea({ x: 10, y: 10, width: 200, height: 200 });
                            setZoomLevel(1);
                            setPanX(0);
                            setPanY(0);
                          }}
                          className="crop-from-source-btn"
                          style={{ marginBottom: '10px' }}
                        >
                          ✂️ Crop from Source
                        </button>
                      )}
                    </div>
                    {part.answerImage && (
                      <div className="image-preview-container">
                        <img src={part.answerImage} alt="Answer" className="preview-uploaded-image" />
                        <button 
                          className="remove-image-btn" 
                          onClick={() => removePartImage(index, i)}
                          type="button"
                        >
                          ✕ Remove Image
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderSQPreview = (question, index) => (
    <div key={index} className="question-preview-item" style={{
      border: selectedQuestions.has(index) ? '3px solid #3498db' : undefined,
      backgroundColor: selectedQuestions.has(index) ? '#f0f8ff' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Question {index + 1} - SQ</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={selectedQuestions.has(index)}
              onChange={() => toggleQuestionSelection(index)}
              style={{ marginRight: '5px', cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <span>Select</span>
          </label>
          <button type="button" onClick={() => uploadSingleQuestion(index)} style={{ backgroundColor: '#8e44ad', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Upload this</button>
        </div>
      </div>
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
        <div className="edit-with-preview">
          <textarea
            className="preview-question-edit"
            value={question.question || question.questionText || ''}
            onChange={(e) => updateQuestion(index, question.question ? 'question' : 'questionText', e.target.value)}
            rows={3}
          />
          {(question.question || question.questionText) && (
            <div className="latex-preview-box">
              <strong>Preview:</strong>
              <LatexRenderer text={question.question || question.questionText || ''} />
            </div>
          )}
        </div>
        
        <label className="edit-label">Answer:</label>
        <div className="edit-with-preview">
          <textarea
            className="preview-answer-edit"
            value={question.answer || ''}
            onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
            rows={3}
            placeholder="Enter answer..."
          />
          {question.answer && (
            <div className="latex-preview-box">
              <strong>Preview:</strong>
              <LatexRenderer text={question.answer} />
            </div>
          )}
        </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>{title || 'Preview & Edit Questions'}</h2>
            <button type="button" onClick={clearPreviewCache} style={{ backgroundColor: '#e67e22', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>🧹 Clear cache</button>
          </div>
          <p className="preview-count">
            {isEditMode 
              ? `Review and edit ${editableQuestions.length} question${editableQuestions.length !== 1 ? 's' : ''} from the batch.`
              : `Review and edit <strong>${editableQuestions.length}</strong> question${editableQuestions.length !== 1 ? 's' : ''} before adding to the question bank.`
            }
          </p>
          
          {/* Bulk Metadata Editor Section */}
          <div style={{
            backgroundColor: '#f8f9fa',
            padding: '15px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '2px solid #3498db'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, color: '#3498db' }}>📦 Bulk Metadata Editor</h3>
              <div>
                <button 
                  onClick={selectAllQuestions}
                  style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    marginRight: '5px',
                    fontSize: '14px'
                  }}
                >
                  Select All
                </button>
                <button 
                  onClick={deselectAllQuestions}
                  style={{
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Deselect All
                </button>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: '#666', margin: '5px 0 15px 0' }}>
              Select questions using the checkboxes, then update metadata for all selected questions at once. Selected: <strong>{selectedQuestions.size}</strong>
            </p>
            
            {showBulkEditor ? (
              <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '5px', border: '1px solid #ddd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                      Subject:
                      {uniqueSubjects.length > 0 && <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>({uniqueSubjects.length} from database)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        list="preview-subjects-list"
                        type="text"
                        placeholder="Type new or select existing"
                        value={bulkMetadata.subject}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                      />
                      <datalist id="preview-subjects-list">
                        {uniqueSubjects.map((subject, idx) => <option key={idx} value={subject} />)}
                      </datalist>
                      <select
                        value={bulkMetadata.subject}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', minWidth: '120px' }}
                      >
                        <option value="">-- Select --</option>
                        {uniqueSubjects.map((subject, idx) => <option key={idx} value={subject}>{subject}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                      Chapter:
                      {uniqueChapters.length > 0 && <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>({uniqueChapters.length} from database)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        list="preview-chapters-list"
                        type="text"
                        placeholder="Type new or select existing"
                        value={bulkMetadata.chapter}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                      />
                      <datalist id="preview-chapters-list">
                        {uniqueChapters.map((chapter, idx) => <option key={idx} value={chapter} />)}
                      </datalist>
                      <select
                        value={bulkMetadata.chapter}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', minWidth: '120px' }}
                      >
                        <option value="">-- Select --</option>
                        {uniqueChapters.map((chapter, idx) => <option key={idx} value={chapter}>{chapter}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                      Lesson:
                      {uniqueLessons.length > 0 && <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>({uniqueLessons.length} from database)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        list="preview-lessons-list"
                        type="text"
                        placeholder="Type new or select existing"
                        value={bulkMetadata.lesson}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                      />
                      <datalist id="preview-lessons-list">
                        {uniqueLessons.map((lesson, idx) => <option key={idx} value={lesson} />)}
                      </datalist>
                      <select
                        value={bulkMetadata.lesson}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', minWidth: '120px' }}
                      >
                        <option value="">-- Select --</option>
                        {uniqueLessons.map((lesson, idx) => <option key={idx} value={lesson}>{lesson}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                      Board:
                      {uniqueBoards.length > 0 && <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>({uniqueBoards.length} from database)</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        list="preview-boards-list"
                        type="text"
                        placeholder="Type new or select existing"
                        value={bulkMetadata.board}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                        style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                      />
                      <datalist id="preview-boards-list">
                        {uniqueBoards.map((board, idx) => <option key={idx} value={board} />)}
                      </datalist>
                      <select
                        value={bulkMetadata.board}
                        onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', minWidth: '120px' }}
                      >
                        <option value="">-- Select --</option>
                        {uniqueBoards.map((board, idx) => <option key={idx} value={board}>{board}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={applyBulkMetadata}
                    style={{
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  >
                    ✓ Apply to Selected ({selectedQuestions.size})
                  </button>
                  <button 
                    onClick={() => {
                      setShowBulkEditor(false);
                      setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
                    }}
                    style={{
                      backgroundColor: '#e74c3c',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowBulkEditor(true)}
                disabled={selectedQuestions.size === 0}
                style={{
                  backgroundColor: selectedQuestions.size === 0 ? '#bdc3c7' : '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  cursor: selectedQuestions.size === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ✏️ Edit Metadata for Selected Questions ({selectedQuestions.size})
              </button>
            )}
          </div>
          
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
            
            {/* PDF Page Selector */}
            {sourceDocType === 'pdf' && pdfPages.length > 0 && (
              <div className="pdf-page-selector">
                <label style={{fontWeight: '600', marginRight: '10px'}}>Select Page to Crop:</label>
                <select 
                  value={currentPdfPage} 
                  onChange={(e) => handlePdfPageChange(parseInt(e.target.value))}
                  style={{padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px'}}
                >
                  {pdfPages.map(pageNum => (
                    <option key={pageNum} value={pageNum}>Page {pageNum}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Source Document Viewer */}
            {sourceDocument && (
              <div className="source-document-viewer">
                {sourceDocType === 'image' && (
                  <img src={sourceDocument} alt="Source" className="source-document-image" />
                )}
                {sourceDocType === 'pdf' && pdfAsImage && (
                  <img src={pdfAsImage} alt="PDF Preview" className="source-document-image" />
                )}
              </div>
            )}
          </div>
          
          <div className="preview-questions-container">
            {editableQuestions.map((question, index) => renderQuestionPreview(question, index))}
          </div>
          <div className="preview-modal-actions">
            <button className="confirm-btn" onClick={() => onConfirm(editableQuestions)}>
              {isEditMode ? 'Save Changes' : 'Confirm & Add to Question Bank'}
            </button>
            <button className="cancel-btn" onClick={onCancel}>
              {isEditMode ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Image Cropper Modal */}
      {showCropper && sourceDocument && (
        <div 
          className="cropper-modal-overlay"
          onMouseEnter={() => console.log('🎬 Cropper modal overlay mounted')}
          style={{ display: showCropper ? 'flex' : 'none' }}
        >
          <div 
            className="cropper-modal" 
            style={{ position: 'relative' }}
            onMouseEnter={() => {
              console.log('📊 MODAL MEASUREMENTS:');
              const elem = document.querySelector('.cropper-modal');
              const overlay = document.querySelector('.cropper-modal-overlay');
              if (elem) {
                console.log('  Modal height:', elem.offsetHeight);
                console.log('  Modal scrollTop:', elem.scrollTop);
                console.log('  Modal clientHeight:', elem.clientHeight);
              }
              if (overlay) {
                console.log('  Overlay height:', overlay.offsetHeight);
                console.log('  Overlay scrollHeight:', overlay.scrollHeight);
                console.log('  Overlay scrollTop:', overlay.scrollTop);
                console.log('  Overlay clientHeight:', overlay.clientHeight);
              }
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>Crop Image from Source (Zoom: {Math.round(zoomLevel * 100)}%, Pan: {panX}x{panY})</h3>
            <p style={{fontSize: '12px', color: '#999', margin: '5px 0 15px 0', backgroundColor: '#f0f0f0', padding: '8px', borderRadius: '4px' }}>
              Drag the box to select the area you want to crop. <br/>
              💡 Overlay scrollHeight: <span id="scroll-height">loading...</span> | ScrollTop: <span id="scroll-top">0</span>
            </p>
            <script>{`
              document.addEventListener('scroll', function() {
                const overlay = document.querySelector('.cropper-modal-overlay');
                if (overlay) {
                  document.getElementById('scroll-height').textContent = overlay.scrollHeight;
                  document.getElementById('scroll-top').textContent = overlay.scrollTop;
                }
              }, true);
            `}</script>
            <p style={{fontSize: '14px', color: '#666', margin: '5px 0 15px 0'}}>
              Drag the box to select the area you want to crop
            </p>
            
            {/* PDF Page Selector in Cropper */}
            {sourceDocType === 'pdf' && pdfPages.length > 0 && (
              <div className="pdf-page-selector" style={{marginBottom: '15px'}}>
                <label style={{fontWeight: '600', marginRight: '10px'}}>Select Page:</label>
                <select 
                  value={currentPdfPage} 
                  onChange={(e) => handlePdfPageChange(parseInt(e.target.value))}
                  style={{padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px'}}
                >
                  {pdfPages.map(pageNum => (
                    <option key={pageNum} value={pageNum}>Page {pageNum}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="cropper-controls">
              <button type="button" onClick={() => adjustCropSize('width', -20)}>Width -</button>
              <button type="button" onClick={() => adjustCropSize('width', 20)}>Width +</button>
              <button type="button" onClick={() => adjustCropSize('height', -20)}>Height -</button>
              <button type="button" onClick={() => adjustCropSize('height', 20)}>Height +</button>
              <button type="button" onClick={() => adjustZoom(-0.25)}>Zoom -</button>
              <button type="button" onClick={() => adjustZoom(0.25)}>Zoom +</button>
              <div style={{ display: 'flex', gap: '5px', marginLeft: '10px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '3px' }}>Pan Image:</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" onClick={() => pan('up')} style={{ padding: '6px 10px' }}>↑</button>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button type="button" onClick={() => pan('left')} style={{ padding: '6px 10px' }}>←</button>
                      <button type="button" onClick={() => pan('down')} style={{ padding: '6px 10px' }}>↓</button>
                      <button type="button" onClick={() => pan('right')} style={{ padding: '6px 10px' }}>→</button>
                    </div>
                    <button type="button" onClick={resetPan} style={{ fontSize: '12px', padding: '6px 10px' }}>Reset</button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px', marginLeft: '10px', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#666', display: 'block', marginBottom: '3px' }}>Move Box:</label>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button type="button" onClick={() => moveCropBox('up')} style={{ padding: '6px 10px' }}>↑</button>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button type="button" onClick={() => moveCropBox('left')} style={{ padding: '6px 10px' }}>←</button>
                      <button type="button" onClick={() => moveCropBox('down')} style={{ padding: '6px 10px' }}>↓</button>
                      <button type="button" onClick={() => moveCropBox('right')} style={{ padding: '6px 10px' }}>→</button>
                    </div>
                  </div>
                </div>
              </div>
              <span style={{marginLeft: 'auto'}}>Zoom: {Math.round(zoomLevel * 100)}% • Pos: {Math.round(cropArea.x)}x{Math.round(cropArea.y)} • Size: {Math.round(cropArea.width)} × {Math.round(cropArea.height)}px</span>
            </div>
            
            <div 
              className="cropper-container"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img 
                ref={imageRef}
                src={sourceDocType === 'pdf' && pdfAsImage ? pdfAsImage : sourceDocument} 
                alt="Crop source" 
                className="cropper-image"
                style={{ transform: `translate(${-panX}px, ${-panY}px) scale(${zoomLevel})`, transformOrigin: 'top left' }}
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
