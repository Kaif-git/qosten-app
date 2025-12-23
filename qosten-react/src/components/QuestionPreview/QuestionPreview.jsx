import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './QuestionPreview.css';
import LatexRenderer from '../LatexRenderer/LatexRenderer';
import { useQuestions } from '../../context/QuestionContext';
import { parseCQQuestions } from '../../utils/cqParser';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using unpkg CDN with matching version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Memoized item to prevent re-renders during cropper interaction
const CompactQuestionItem = React.memo(({ question, index, onCropAndAssign }) => {
  return (
    <div className="question-preview-item compact-view" style={{ padding: '10px', fontSize: '14px', backgroundColor: 'white', borderRadius: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
       <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px'}}>
          <strong style={{color: '#2c3e50'}}>
            Q{index + 1} ({question.type ? question.type.toUpperCase() : '?'})
            {question.board && <span style={{fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px'}}>- {question.board}</span>}
          </strong>
          {question.image && <span style={{color: 'green', fontSize: '12px', fontWeight: 'bold'}}>✓ Stem Img</span>}
       </div>
       <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#555', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.questionText || question.question || 'No text'}
       </p>
       
       <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
          <button 
              onClick={() => onCropAndAssign(index, 'stem')}
              style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', flex: 1}}
          >
             Set Stem Img
          </button>
       </div>

       {question.parts && question.parts.map((part, pIdx) => {
           const letter = part.letter?.toLowerCase();
           if (letter === 'c' || letter === 'd') {
               const hasImg = (letter === 'c' && question.answerimage1) || (letter === 'd' && question.answerimage2);
               return (
                   <div key={pIdx} style={{marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px'}}>
                         <span style={{fontSize: '12px', fontWeight: 'bold'}}>Part {part.letter.toUpperCase()})</span>
                         {hasImg && <span style={{color: 'green', fontSize: '10px', fontWeight: 'bold'}}>✓ Img</span>}
                      </div>
                      <button 
                          onClick={() => onCropAndAssign(index, 'part', pIdx)}
                          style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', marginTop: '2px', width: '100%'}}
                      >
                         Set {part.letter.toUpperCase()} Image
                      </button>
                   </div>
               );
           }
           return null;
       })}
    </div>
  );
});

export default function QuestionPreview({ questions, onConfirm, onCancel, title, isEditMode = false }) {
  const { questions: dbQuestions, addQuestion } = useQuestions();

  const [editableQuestions, setEditableQuestions] = useState(questions);
  const [banglaQuestions, setBanglaQuestions] = useState([]);
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
  const [selectedBanglaQuestions, setSelectedBanglaQuestions] = useState(new Set());
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  const [showBanglaBulkEditor, setShowBanglaBulkEditor] = useState(false);
  const [showBanglaUpload, setShowBanglaUpload] = useState(false);
  const [banglaInputText, setBanglaInputText] = useState('');
  const [bulkMetadata, setBulkMetadata] = useState({ subject: '', chapter: '', lesson: '', board: '' });
  const [banglaBulkMetadata, setBanglaBulkMetadata] = useState({ subject: '', chapter: '', lesson: '', board: '' });
  const [zoomLevel, setZoomLevel] = useState(1); // Zoom level for cropper display
  const [rotation, setRotation] = useState(0); // Rotation in degrees (0, 90, 180, 270)
  const [isEasyImageMode, setIsEasyImageMode] = useState(false); // New Easy Image Mode
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const cropperContainerRef = useRef(null);
  
  // Get unique metadata values
  const getUniqueValues = (field, listType = 'english') => {
    const list = listType === 'english' ? editableQuestions : banglaQuestions;
    // For English, we also include DB questions for suggestions
    const allQuestions = listType === 'english' ? [...list, ...dbQuestions] : list;
    
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

  const uniqueBanglaSubjects = getUniqueValues('subject', 'bangla');
  const uniqueBanglaChapters = getUniqueValues('chapter', 'bangla');
  const uniqueBanglaLessons = getUniqueValues('lesson', 'bangla');
  const uniqueBanglaBoards = getUniqueValues('board', 'bangla');

  const updateQuestion = useCallback((index, field, value, listType = 'english') => {
    const setter = listType === 'english' ? setEditableQuestions : setBanglaQuestions;
    setter(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Auto-sync images from English to Bangla
    if (listType === 'english' && (field === 'image' || field === 'answerimage1' || field === 'answerimage2')) {
      setBanglaQuestions(prev => {
        if (index >= prev.length) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    }
  }, []);
  
  const updateQuestionOption = useCallback((qIndex, optIndex, field, value, listType = 'english') => {
    const setter = listType === 'english' ? setEditableQuestions : setBanglaQuestions;
    setter(prev => {
      const updated = [...prev];
      const options = [...updated[qIndex].options];
      options[optIndex] = { ...options[optIndex], [field]: value };
      updated[qIndex] = { ...updated[qIndex], options };
      return updated;
    });
  }, []);
  
  const updateQuestionPart = useCallback((qIndex, partIndex, field, value, listType = 'english') => {
    const setter = listType === 'english' ? setEditableQuestions : setBanglaQuestions;
    setter(prev => {
      const updated = [...prev];
      const parts = [...updated[qIndex].parts];
      parts[partIndex] = { ...parts[partIndex], [field]: value };
      updated[qIndex] = { ...updated[qIndex], parts };
      return updated;
    });

    // Auto-sync part images from English to Bangla
    if (listType === 'english' && field === 'answerImage') {
      setBanglaQuestions(prev => {
        if (qIndex >= prev.length) return prev;
        const updated = [...prev];
        const parts = [...updated[qIndex].parts];
        
        if (partIndex < parts.length) {
            parts[partIndex] = { ...parts[partIndex], [field]: value };
            updated[qIndex] = { ...updated[qIndex], parts };
            
            // Also sync legacy properties if applicable
            const partLetter = parts[partIndex]?.letter?.toLowerCase();
            if (partLetter === 'c') {
                updated[qIndex] = { ...updated[qIndex], answerimage1: value };
            } else if (partLetter === 'd') {
                updated[qIndex] = { ...updated[qIndex], answerimage2: value };
            }
        }
        return updated;
      });
    }
  }, []);

  const handlePartImageUpload = useCallback((qIndex, partIndex, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        updateQuestionPart(qIndex, partIndex, 'answerImage', dataUrl);
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
  }, [updateQuestionPart]);

  const removePartImage = useCallback((qIndex, partIndex) => {
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
  }, [updateQuestionPart]);

  const handleCropAndAssign = useCallback((qIndex, targetType, partIndex = null) => {
    if (!imageRef.current) return;
    
    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const displayedWidth = rect.width;
    const displayedHeight = rect.height;
    
    // Safety check to avoid division by zero
    if (displayedWidth === 0 || displayedHeight === 0) return;

    const scaleX = img.naturalWidth / displayedWidth;
    const scaleY = img.naturalHeight / displayedHeight;
    
    console.log(`✂️ Cropping: Displayed ${displayedWidth}x${displayedHeight}, Natural ${img.naturalWidth}x${img.naturalHeight}, Scale ${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`);
    
    const canvas = document.createElement('canvas');
    
    // Calculate actual crop coordinates on the natural image
    const actualX = cropArea.x * scaleX;
    const actualY = cropArea.y * scaleY;
    const actualWidth = cropArea.width * scaleX;
    const actualHeight = cropArea.height * scaleY;

    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    );
    
    const croppedImage = canvas.toDataURL('image/png');

    if (targetType === 'stem') {
        updateQuestion(qIndex, 'image', croppedImage);
    } else if (targetType === 'part' && partIndex !== null) {
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
    }
  }, [cropArea, updateQuestion, updateQuestionPart]);
  
  if (!questions || questions.length === 0) return null;
  
  const convertPdfPageToImage = async (pdfData, pageNumber, rot = 0) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNumber);
      
      const viewport = page.getViewport({ scale: 1.5, rotation: rot });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(URL.createObjectURL(blob));
        }, 'image/png');
      });
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      return null;
    }
  };

  const rotateSource = async (direction) => {
    if (sourceDocType !== 'pdf' || !pdfArrayBuffer) return;
    
    let newRotation = (rotation + (direction === 'left' ? -90 : 90)) % 360;
    if (newRotation < 0) newRotation += 360;
    
    setRotation(newRotation);
    
    if (sourceDocument && sourceDocument.startsWith('blob:')) {
        URL.revokeObjectURL(sourceDocument);
    }
    
    const imageData = await convertPdfPageToImage(pdfArrayBuffer.slice(), currentPdfPage, newRotation);
    setPdfAsImage(imageData);
    setSourceDocument(imageData);
  };

  const handleSourceDocumentUpload = async (file) => {
    if (!file) return;
    
    const fileType = file.type;
    setRotation(0);
    
    if (fileType.includes('pdf')) {
      setSourceDocType('pdf');
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const arrayBuffer = reader.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          setPdfArrayBuffer(uint8Array.slice());
          
          const loadingTask = pdfjsLib.getDocument({ data: uint8Array.slice() });
          const pdf = await loadingTask.promise;
          const numPages = pdf.numPages;
          
          const pages = [];
          for (let i = 1; i <= numPages; i++) {
            pages.push(i);
          }
          setPdfPages(pages);
          setCurrentPdfPage(1);
          
          if (sourceDocument && sourceDocument.startsWith('blob:')) {
              URL.revokeObjectURL(sourceDocument);
          }
          
          const imageData = await convertPdfPageToImage(uint8Array.slice(), 1, 0);
          setPdfAsImage(imageData);
          setSourceDocument(imageData);
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
    if (sourceDocument && sourceDocument.startsWith('blob:')) {
        URL.revokeObjectURL(sourceDocument);
    }
    const imageData = await convertPdfPageToImage(pdfArrayBuffer.slice(), pageNumber, rotation);
    setPdfAsImage(imageData);
    setSourceDocument(imageData);
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
    setCurrentCroppingIndex(index);
    setShowCropper(true);
    setCropArea({ x: 10, y: 10, width: 200, height: 200 });
    setZoomLevel(1);
    
    setTimeout(() => {
      const overlay = document.querySelector('.cropper-modal-overlay');
      if (overlay) {
        overlay.scrollTop = 0;
      }
    }, 100);
  };
  
  const handleCropImage = () => {
    if (!imageRef.current || currentCroppingIndex === null) return;
    
    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const displayedWidth = rect.width;
    const displayedHeight = rect.height;
    
    if (displayedWidth === 0 || displayedHeight === 0) return;

    const scaleX = img.naturalWidth / displayedWidth;
    const scaleY = img.naturalHeight / displayedHeight;
    
    const canvas = document.createElement('canvas');
    
    const actualX = cropArea.x * scaleX;
    const actualY = cropArea.y * scaleY;
    const actualWidth = cropArea.width * scaleX;
    const actualHeight = cropArea.height * scaleY;

    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      actualX,
      actualY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    );
    
    const croppedImage = canvas.toDataURL('image/png');

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
      return Math.min(20, Math.max(0.1, next));
    });
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
      setEditableQuestions(prev => prev.filter((_, i) => i !== index));
    } catch (e) {
      console.error('Error uploading single question', e);
      alert('❌ Failed to upload this question: ' + e.message);
    }
  };

  const toggleQuestionSelection = (index, listType = 'english') => {
    const setSelected = listType === 'english' ? setSelectedQuestions : setSelectedBanglaQuestions;
    setSelected(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAllQuestions = (listType = 'english') => {
    const list = listType === 'english' ? editableQuestions : banglaQuestions;
    const setSelected = listType === 'english' ? setSelectedQuestions : setSelectedBanglaQuestions;
    const allIndices = list.map((_, idx) => idx);
    setSelected(new Set(allIndices));
  };

  const deselectAllQuestions = (listType = 'english') => {
    const setSelected = listType === 'english' ? setSelectedQuestions : setSelectedBanglaQuestions;
    setSelected(new Set());
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

    setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
    setShowBulkEditor(false);
    setSelectedQuestions(new Set());
    alert(`✅ Metadata updated for ${selectedQuestions.size} question(s)!`);
  };

  const applyBanglaBulkMetadata = () => {
    if (selectedBanglaQuestions.size === 0) {
      alert('Please select at least one Bangla question.');
      return;
    }

    setBanglaQuestions(prev => {
      const updated = [...prev];
      selectedBanglaQuestions.forEach(index => {
        if (banglaBulkMetadata.subject) {
          updated[index] = { ...updated[index], subject: banglaBulkMetadata.subject };
        }
        if (banglaBulkMetadata.chapter) {
          updated[index] = { ...updated[index], chapter: banglaBulkMetadata.chapter };
        }
        if (banglaBulkMetadata.lesson) {
          updated[index] = { ...updated[index], lesson: banglaBulkMetadata.lesson };
        }
        if (banglaBulkMetadata.board) {
          updated[index] = { ...updated[index], board: banglaBulkMetadata.board };
        }
      });
      return updated;
    });

    setBanglaBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
    setShowBanglaBulkEditor(false);
    setSelectedBanglaQuestions(new Set());
    alert(`✅ Metadata updated for ${selectedBanglaQuestions.size} Bangla question(s)!`);
  };

  const handleBanglaUpload = () => {
    if (!banglaInputText.trim()) {
      alert('Please enter some Bangla questions.');
      return;
    }

    try {
      // Parse the Bangla text using the shared parser
      const parsedBanglaQuestions = parseCQQuestions(banglaInputText, 'bn');
      
      if (parsedBanglaQuestions.length === 0) {
        alert('❌ No questions could be parsed. Please check the format.');
        return;
      }

      // Filter current editable questions to find English CQs
      // Assuming existing questions are English ones we want to map from
      const englishQuestions = editableQuestions.filter(q => q.language !== 'bn');
      
      // We expect the number of Bangla questions to match the number of English questions
      // OR we just map them sequentially.
      // The user prompt says: "if I parse 10cqs ... give me the option to import bangla ... put the same images ... into the same serial"
      
      if (parsedBanglaQuestions.length !== englishQuestions.length) {
         const confirmMismatch = window.confirm(
             `⚠️ Count Mismatch:\n` +
             `Found ${englishQuestions.length} English questions but parsed ${parsedBanglaQuestions.length} Bangla questions.\n\n` +
             `Do you want to proceed anyway? Images will be mapped sequentially as far as possible.`
         );
         if (!confirmMismatch) return;
      }

      const questionsToAdd = parsedBanglaQuestions.map((bnQ, index) => {
          // Find corresponding English question
          const engQ = englishQuestions[index];
          
          if (!engQ) return bnQ; // No matching English question, return as is

          // Copy images
          const newQ = { ...bnQ };
          
          if (engQ.image) newQ.image = engQ.image;
          
          // Copy part images
          if (engQ.parts && newQ.parts) {
             // Map answer images based on part letter or index? 
             // Usually c and d have images.
             // We'll check for answerimage1/2 properties on the question object first
             if (engQ.answerimage1) newQ.answerimage1 = engQ.answerimage1;
             if (engQ.answerimage2) newQ.answerimage2 = engQ.answerimage2;

             // Also map individual part 'answerImage' if present
             newQ.parts = newQ.parts.map(bnPart => {
                 const engPart = engQ.parts.find(p => p.letter === bnPart.letter);
                 if (engPart && engPart.answerImage) {
                     return { ...bnPart, answerImage: engPart.answerImage };
                 }
                 // Fallback: check if this is part c or d and we have mapped images
                 if (bnPart.letter === 'c' && newQ.answerimage1) {
                     return { ...bnPart, answerImage: newQ.answerimage1 };
                 }
                 if (bnPart.letter === 'd' && newQ.answerimage2) {
                     return { ...bnPart, answerImage: newQ.answerimage2 };
                 }
                 return bnPart;
             });
          }
          
          // Also inherit metadata if missing in Bangla version
          if (!newQ.subject && engQ.subject) newQ.subject = engQ.subject;
          if (!newQ.chapter && engQ.chapter) newQ.chapter = engQ.chapter;
          if (!newQ.lesson && engQ.lesson) newQ.lesson = engQ.lesson;
          if (!newQ.board && engQ.board) newQ.board = engQ.board;

          return newQ;
      });

      // Set Bangla questions state
      setBanglaQuestions(questionsToAdd);
      
      setBanglaInputText('');
      setShowBanglaUpload(false);
      alert(`✅ Successfully processed ${questionsToAdd.length} Bangla questions!`);
      
    } catch (e) {
      console.error('Error processing Bangla questions:', e);
      alert('Error processing Bangla questions: ' + e.message);
    }
  };

  const renderMCQPreview = (question, index, listType = 'english') => {
    const isSelected = listType === 'english' ? selectedQuestions.has(index) : selectedBanglaQuestions.has(index);
    
    return (
    <div key={`${listType}-${index}`} className="question-preview-item" style={{
      border: isSelected ? '3px solid #3498db' : undefined,
      backgroundColor: isSelected ? '#f0f8ff' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Question {index + 1} - MCQ ({listType === 'english' ? 'EN' : 'BN'})</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleQuestionSelection(index, listType)}
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
          onChange={(e) => updateQuestion(index, 'subject', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Chapter"
          value={question.chapter || ''}
          onChange={(e) => updateQuestion(index, 'chapter', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Lesson"
          value={question.lesson || ''}
          onChange={(e) => updateQuestion(index, 'lesson', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Board"
          value={question.board || ''}
          onChange={(e) => updateQuestion(index, 'board', e.target.value, listType)}
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
            onChange={(e) => updateQuestion(index, question.question ? 'question' : 'questionText', e.target.value, listType)}
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
                    name={`correct-${listType}-${index}`}
                    checked={opt.label === question.correctAnswer}
                    onChange={() => updateQuestion(index, 'correctAnswer', opt.label, listType)}
                  />
                  <strong>{opt.label.toUpperCase()})</strong>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateQuestionOption(index, i, 'text', e.target.value, listType)}
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
            onChange={(e) => updateQuestion(index, 'explanation', e.target.value, listType)}
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
  };

  const renderCQPreview = (question, index, listType = 'english') => {
    const isSelected = listType === 'english' ? selectedQuestions.has(index) : selectedBanglaQuestions.has(index);
    
    return (
    <div key={`${listType}-${index}`} className="question-preview-item" style={{
      border: isSelected ? '3px solid #3498db' : undefined,
      backgroundColor: isSelected ? '#f0f8ff' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Question {index + 1} - CQ ({listType === 'english' ? 'EN' : 'BN'})</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleQuestionSelection(index, listType)}
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
          onChange={(e) => updateQuestion(index, 'subject', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Chapter"
          value={question.chapter || ''}
          onChange={(e) => updateQuestion(index, 'chapter', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Lesson"
          value={question.lesson || ''}
          onChange={(e) => updateQuestion(index, 'lesson', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Board"
          value={question.board || ''}
          onChange={(e) => updateQuestion(index, 'board', e.target.value, listType)}
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
            onChange={(e) => updateQuestion(index, 'questionText', e.target.value, listType)}
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
                    onChange={(e) => updateQuestionPart(index, i, 'text', e.target.value, listType)}
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
                    onChange={(e) => updateQuestionPart(index, i, 'answer', e.target.value, listType)}
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
  };

  const renderSQPreview = (question, index, listType = 'english') => {
    const isSelected = listType === 'english' ? selectedQuestions.has(index) : selectedBanglaQuestions.has(index);
    
    return (
    <div key={`${listType}-${index}`} className="question-preview-item" style={{
      border: isSelected ? '3px solid #3498db' : undefined,
      backgroundColor: isSelected ? '#f0f8ff' : undefined
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
        <h4 style={{ margin: 0 }}>Question {index + 1} - SQ ({listType === 'english' ? 'EN' : 'BN'})</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', fontWeight: 'normal' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleQuestionSelection(index, listType)}
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
          onChange={(e) => updateQuestion(index, 'subject', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Chapter"
          value={question.chapter || ''}
          onChange={(e) => updateQuestion(index, 'chapter', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Lesson"
          value={question.lesson || ''}
          onChange={(e) => updateQuestion(index, 'lesson', e.target.value, listType)}
        />
        <input
          type="text"
          placeholder="Board"
          value={question.board || ''}
          onChange={(e) => updateQuestion(index, 'board', e.target.value, listType)}
        />
      </div>
      <div className="preview-content">
        <label className="edit-label">Question Text:</label>
        <div className="edit-with-preview">
          <textarea
            className="preview-question-edit"
            value={question.question || question.questionText || ''}
            onChange={(e) => updateQuestion(index, question.question ? 'question' : 'questionText', e.target.value, listType)}
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
            onChange={(e) => updateQuestion(index, 'answer', e.target.value, listType)}
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
  };

  const renderQuestionPreview = (question, index, listType = 'english') => {
    switch (question.type) {
      case 'mcq':
        return renderMCQPreview(question, index, listType);
      case 'cq':
        return renderCQPreview(question, index, listType);
      case 'sq':
        return renderSQPreview(question, index, listType);
      default:
        return renderMCQPreview(question, index, listType);
    }
  };

  if (isEasyImageMode) {
      return (
        <div className="preview-modal-overlay">
          <div className="preview-modal" style={{ width: '95vw', maxWidth: '95vw', height: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
             {/* Header with Merged Controls */}
             <div style={{ padding: '10px 15px', borderBottom: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{margin: 0, fontSize: '1.1rem', whiteSpace: 'nowrap'}}>📷 Easy Upload</h2>
                    
                    {/* Compact Controls in Header */}
                    {sourceDocument && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                            {sourceDocType === 'pdf' && pdfPages.length > 0 && (
                                <div className="pdf-page-selector" style={{margin: 0, padding: '2px 5px', border: '1px solid #ccc'}}>
                                    <label style={{marginRight: '5px', fontSize: '12px'}}>Pg:</label>
                                    <select 
                                      value={currentPdfPage} 
                                      onChange={(e) => handlePdfPageChange(parseInt(e.target.value))}
                                      style={{padding: '2px', fontSize: '12px'}}
                                    >
                                      {pdfPages.map(pageNum => (
                                        <option key={pageNum} value={pageNum}>{pageNum}</option>
                                      ))}
                                    </select>
                                </div>
                            )}
                            
                            {sourceDocType === 'pdf' && (
                                <>
                                    <button type="button" onClick={() => rotateSource('left')} title="Rotate Left" style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>↶</button>
                                    <button type="button" onClick={() => rotateSource('right')} title="Rotate Right" style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>↷</button>
                                </>
                            )}
                            
                            <div style={{height: '15px', width: '1px', backgroundColor: '#ccc', margin: '0 2px'}}></div>
                            <button type="button" onClick={() => adjustZoom(-0.25)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>🔍-</button>
                            <button type="button" onClick={() => adjustZoom(0.25)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>🔍+</button>
                            
                            <div style={{height: '15px', width: '1px', backgroundColor: '#ccc', margin: '0 2px'}}></div>
                            {/* Width/Height Controls */}
                            <button type="button" onClick={() => adjustCropSize('width', -20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }} title="Width -">W-</button>
                            <button type="button" onClick={() => adjustCropSize('width', 20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }} title="Width +">W+</button>
                            <button type="button" onClick={() => adjustCropSize('height', -20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }} title="Height -">H-</button>
                            <button type="button" onClick={() => adjustCropSize('height', 20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }} title="Height +">H+</button>

                            <div style={{height: '15px', width: '1px', backgroundColor: '#ccc', margin: '0 2px'}}></div>
                            {/* Move Box Controls */}
                            <div style={{display: 'flex', gap: '1px'}}>
                                <button type="button" onClick={() => moveCropBox('left')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>←</button>
                                <button type="button" onClick={() => moveCropBox('down')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>↓</button>
                                <button type="button" onClick={() => moveCropBox('up')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>↑</button>
                                <button type="button" onClick={() => moveCropBox('right')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>→</button>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={() => setIsEasyImageMode(false)}
                        style={{ padding: '6px 12px', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                    >
                        Exit
                    </button>
                    <button 
                        className="confirm-btn" 
                        onClick={() => setIsEasyImageMode(false)}
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                        Review Questions
                    </button>
                </div>
             </div>
             
             <div className="easy-mode-container">
                {/* Left Side: Cropper */}
                <div className="easy-mode-cropper-section">
                    {!sourceDocument ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
                            <h3>Start by Uploading a Source Document</h3>
                            <p style={{color: '#ccc'}}>Upload a PDF or Image to start cropping questions.</p>
                             <div className="source-upload-buttons" style={{marginTop: '20px'}}>
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
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                           {/* Cropper Area - Takes full remaining height */}
                           <div 
                              ref={cropperContainerRef}
                              className="cropper-container"
                              style={{ flex: 1, backgroundColor: '#555', overflow: 'auto', position: 'relative', height: '100%', maxHeight: 'none', margin: 0, border: 'none', borderRadius: 0 }}
                            >
                              <div 
                                style={{ position: 'relative', width: `${zoomLevel * 100}%`, minWidth: '100%' }}
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
                                  style={{ width: '100%', display: 'block', userSelect: 'none' }}
                                />
                                <div 
                                  className="crop-box"
                                  style={{
                                    left: `${cropArea.x}px`,
                                    top: `${cropArea.y}px`,
                                    width: `${cropArea.width}px`,
                                    height: `${cropArea.height}px`,
                                    position: 'absolute',
                                    border: '2px solid #3498db',
                                    boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
                                    willChange: 'left, top, width, height'
                                  }}
                                >
                                  <div className="crop-handle" style={{ width: '10px', height: '10px', background: '#3498db', position: 'absolute', bottom: '0', right: '0', cursor: 'se-resize' }} />
                                </div>
                              </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Question List */}
                <div className="easy-mode-list-section" style={{ minWidth: '300px' }}>
                    <div style={{marginBottom: '10px'}}>
                        <h3 style={{ margin: 0, color: '#2c3e50' }}>Questions List</h3>
                        <p style={{fontSize: '12px', color: '#7f8c8d', margin: '5px 0 0 0'}}>
                            Align the crop box on the left, then click the corresponding button below to assign the image.
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
                        {editableQuestions.map((q, idx) => (
                            <CompactQuestionItem key={idx} question={q} index={idx} onCropAndAssign={handleCropAndAssign} />
                        ))}
                    </div>
                </div>
             </div>
          </div>
        </div>
      );
  }

  return (
    <>
      <div className="preview-modal-overlay">
        <div className="preview-modal">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>{title || 'Preview & Edit Questions'}</h2>
            <button 
                onClick={() => {
                    setIsEasyImageMode(true);
                    // Initialize crop area if not set
                    if (!sourceDocument) {
                        // Optional: could prompt to upload here
                    }
                    if (cropArea.width === 0) {
                         setCropArea({ x: 10, y: 10, width: 200, height: 200 });
                    }
                }}
                style={{
                    backgroundColor: '#e67e22',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    marginRight: '10px'
                }}
            >
                📷 Switch to Easy Image Upload Mode
            </button>
            <button 
                onClick={() => setShowBanglaUpload(true)}
                style={{
                    backgroundColor: '#8e44ad',
                    color: 'white',
                    border: 'none',
                    padding: '8px 15px',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
            >
                🇧🇩 Add Bangla Version
            </button>
          </div>
          <p className="preview-count">
            {isEditMode 
              ? `Review and edit ${editableQuestions.length} question${editableQuestions.length !== 1 ? 's' : ''} from the batch.`
              : `Review and edit <strong>${editableQuestions.length}</strong> question${editableQuestions.length !== 1 ? 's' : ''} before adding to the question bank.`
            }
          </p>
          
          {/* Bangla Upload Modal */}
          {showBanglaUpload && (
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
                width: '80%',
                maxWidth: '800px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <h3 style={{ marginTop: 0, color: '#8e44ad' }}>🇧🇩 Import Bangla Version</h3>
                <p style={{ color: '#666', marginBottom: '15px' }}>
                  Paste your Bangla questions here. They will be parsed and automatically linked with the images from the existing English questions based on their order.
                </p>
                <textarea
                  value={banglaInputText}
                  onChange={(e) => setBanglaInputText(e.target.value)}
                  placeholder="Paste Bangla questions (Creative Questions format)..."
                  style={{
                    flex: 1,
                    minHeight: '300px',
                    padding: '15px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    fontFamily: 'monospace',
                    resize: 'none',
                    marginBottom: '20px'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button 
                    onClick={() => setShowBanglaUpload(false)}
                    style={{
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBanglaUpload}
                    style={{
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Parse & Link Images
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Bulk Metadata Editor Section */}
          <div style={{ display: banglaQuestions.length > 0 ? 'grid' : 'block', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* English Bulk Editor */}
            <div style={{
              backgroundColor: '#f8f9fa',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '2px solid #3498db'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#3498db' }}>📦 Bulk Metadata (EN)</h3>
                <div>
                  <button 
                    onClick={() => selectAllQuestions('english')}
                    style={{
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      marginRight: '5px',
                      fontSize: '12px'
                    }}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => deselectAllQuestions('english')}
                    style={{
                      backgroundColor: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      padding: '5px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    None
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 10px 0' }}>
                Selected: <strong>{selectedQuestions.size}</strong>
              </p>
              
              {showBulkEditor ? (
                <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '10px' }}>
                    {/* ... Inputs for English ... */}
                    <input
                      list="preview-subjects-list"
                      placeholder="Subject"
                      value={bulkMetadata.subject}
                      onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                      style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                    />
                    <datalist id="preview-subjects-list">
                      {uniqueSubjects.map((subject, idx) => <option key={idx} value={subject} />)}
                    </datalist>

                    <input
                      list="preview-chapters-list"
                      placeholder="Chapter"
                      value={bulkMetadata.chapter}
                      onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                      style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                    />
                    <datalist id="preview-chapters-list">
                      {uniqueChapters.map((chapter, idx) => <option key={idx} value={chapter} />)}
                    </datalist>

                    <input
                      list="preview-lessons-list"
                      placeholder="Lesson"
                      value={bulkMetadata.lesson}
                      onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                      style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                    />
                    <datalist id="preview-lessons-list">
                      {uniqueLessons.map((lesson, idx) => <option key={idx} value={lesson} />)}
                    </datalist>

                    <input
                      list="preview-boards-list"
                      placeholder="Board"
                      value={bulkMetadata.board}
                      onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                      style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                    />
                    <datalist id="preview-boards-list">
                      {uniqueBoards.map((board, idx) => <option key={idx} value={board} />)}
                    </datalist>
                  </div>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={applyBulkMetadata} style={{ flex: 1, backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
                    <button onClick={() => setShowBulkEditor(false)} style={{ flex: 1, backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setShowBulkEditor(true)}
                  disabled={selectedQuestions.size === 0}
                  style={{ width: '100%', padding: '8px', backgroundColor: selectedQuestions.size === 0 ? '#bdc3c7' : '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedQuestions.size === 0 ? 'not-allowed' : 'pointer' }}
                >
                  Edit Metadata
                </button>
              )}
            </div>

            {/* Bangla Bulk Editor (Conditional) */}
            {banglaQuestions.length > 0 && (
              <div style={{
                backgroundColor: '#fff0f0',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #e74c3c'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, color: '#e74c3c' }}>📦 Bulk Metadata (BN)</h3>
                  <div>
                    <button 
                      onClick={() => selectAllQuestions('bangla')}
                      style={{
                        backgroundColor: '#e74c3c',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        marginRight: '5px',
                        fontSize: '12px'
                      }}
                    >
                      All
                    </button>
                    <button 
                      onClick={() => deselectAllQuestions('bangla')}
                      style={{
                        backgroundColor: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      None
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 10px 0' }}>
                  Selected: <strong>{selectedBanglaQuestions.size}</strong>
                </p>
                
                {showBanglaBulkEditor ? (
                  <div style={{ backgroundColor: 'white', padding: '10px', borderRadius: '5px', border: '1px solid #ddd' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '10px' }}>
                      <input
                        list="preview-bn-subjects-list"
                        placeholder="Subject"
                        value={banglaBulkMetadata.subject}
                        onChange={(e) => setBanglaBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                        style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                      />
                      <datalist id="preview-bn-subjects-list">
                        {uniqueBanglaSubjects.map((subject, idx) => <option key={idx} value={subject} />)}
                      </datalist>

                      <input
                        list="preview-bn-chapters-list"
                        placeholder="Chapter"
                        value={banglaBulkMetadata.chapter}
                        onChange={(e) => setBanglaBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                        style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                      />
                      <datalist id="preview-bn-chapters-list">
                        {uniqueBanglaChapters.map((chapter, idx) => <option key={idx} value={chapter} />)}
                      </datalist>

                      <input
                        list="preview-bn-lessons-list"
                        placeholder="Lesson"
                        value={banglaBulkMetadata.lesson}
                        onChange={(e) => setBanglaBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                        style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                      />
                      <datalist id="preview-bn-lessons-list">
                        {uniqueBanglaLessons.map((lesson, idx) => <option key={idx} value={lesson} />)}
                      </datalist>

                      <input
                        list="preview-bn-boards-list"
                        placeholder="Board"
                        value={banglaBulkMetadata.board}
                        onChange={(e) => setBanglaBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                        style={{ width: '100%', padding: '6px', fontSize: '13px' }}
                      />
                      <datalist id="preview-bn-boards-list">
                        {uniqueBanglaBoards.map((board, idx) => <option key={idx} value={board} />)}
                      </datalist>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={applyBanglaBulkMetadata} style={{ flex: 1, backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
                      <button onClick={() => setShowBanglaBulkEditor(false)} style={{ flex: 1, backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setShowBanglaBulkEditor(true)}
                    disabled={selectedBanglaQuestions.size === 0}
                    style={{ width: '100%', padding: '8px', backgroundColor: selectedBanglaQuestions.size === 0 ? '#bdc3c7' : '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: selectedBanglaQuestions.size === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    Edit Metadata (BN)
                  </button>
                )}
              </div>
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
            {banglaQuestions.length > 0 ? (
                <div className="split-view-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {Array.from({ length: Math.max(editableQuestions.length, banglaQuestions.length) }).map((_, index) => (
                        <React.Fragment key={index}>
                            <div className="english-column" style={{ minWidth: 0 }}>
                                {editableQuestions[index] ? renderQuestionPreview(editableQuestions[index], index, 'english') : <div style={{ padding: '20px', textAlign: 'center', color: '#999', border: '1px dashed #ccc' }}>No English Question</div>}
                            </div>
                            <div className="bangla-column" style={{ minWidth: 0 }}>
                                {banglaQuestions[index] ? renderQuestionPreview(banglaQuestions[index], index, 'bangla') : <div style={{ padding: '20px', textAlign: 'center', color: '#999', border: '1px dashed #ccc' }}>No Bangla Question</div>}
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            ) : (
                editableQuestions.map((question, index) => renderQuestionPreview(question, index))
            )}
          </div>
          <div className="preview-modal-actions">
            <button className="confirm-btn" onClick={() => onConfirm([...editableQuestions, ...banglaQuestions])}>
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
          >
            <h3 style={{ marginBottom: '15px' }}>Crop Image from Source (Zoom: {Math.round(zoomLevel * 100)}%)</h3>
            <p style={{fontSize: '12px', color: '#999', margin: '5px 0 15px 0', backgroundColor: '#f0f0f0', padding: '8px', borderRadius: '4px' }}>
              Drag the box to select the area you want to crop. Scroll to pan.
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
              style={{ flex: 1, backgroundColor: '#555', overflow: 'auto', position: 'relative', height: '400px', maxHeight: '50vh', margin: '10px 0', border: 'none', borderRadius: 4 }}
            >
              <div 
                style={{ position: 'relative', width: 'fit-content', minWidth: '100%' }}
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
                  style={{ width: `${zoomLevel * 100}%`, maxWidth: 'none', display: 'block', userSelect: 'none' }}
                />
                <div 
                  className="crop-box"
                  style={{
                    left: `${cropArea.x}px`,
                    top: `${cropArea.y}px`,
                    width: `${cropArea.width}px`,
                    height: `${cropArea.height}px`,
                    position: 'absolute',
                    border: '2px solid #3498db',
                    boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
                    willChange: 'left, top, width, height'
                  }}
                >
                  <div className="crop-handle" />
                </div>
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