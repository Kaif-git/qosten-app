import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './QuestionPreview.css';
import LatexRenderer from '../LatexRenderer/LatexRenderer';
import { useQuestions } from '../../context/QuestionContext';
import { parseCQQuestions } from '../../utils/cqParser';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker using unpkg CDN with matching version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// --- EASY CROPPER COMPONENT (Isolated State) ---
const EasyCropper = ({ 
    sourceDocument, 
    sourceDocType, 
    pdfAsImage, 
    pdfPages, 
    currentPdfPage, 
    onPdfPageChange, 
    onRotate, 
    imageRef,     // MutableRefObject from parent
    cropAreaRef,  // MutableRefObject from parent
    isRenderingPage = false
}) => {
    // Local state for rendering - isolated from expensive parent
    const [cropArea, setCropArea] = useState({ x: 10, y: 10, width: 200, height: 200 });
    const [zoomLevel, setZoomLevel] = useState(1);
    
    // Internal refs for performance
    const cropBoxRef = useRef(null);
    const zoomContainerRef = useRef(null);
    const scrollContainerRef = useRef(null); // Ref for scrolling
    const debounceTimer = useRef(null);
    const zoomDebounceTimer = useRef(null);
    const zoomLevelRef = useRef(zoomLevel);
    
    // Dragging state
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    
    // Resizing state
    const isResizingRef = useRef(false);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    
    const frameId = useRef(null);

    // Sync zoom ref
    useEffect(() => {
        zoomLevelRef.current = zoomLevel;
    }, [zoomLevel]);

    // Initial sync with parent ref
    useEffect(() => {
        cropAreaRef.current = cropArea;
    }, []);

    const updateCropBoxDOM = useCallback((x, y, w, h) => {
        if (cropBoxRef.current) {
            cropBoxRef.current.style.left = `${x}px`;
            cropBoxRef.current.style.top = `${y}px`;
            cropBoxRef.current.style.width = `${w}px`;
            cropBoxRef.current.style.height = `${h}px`;
        }
    }, []);

    // Ensure DOM is synced when component mounts/updates normally
    useEffect(() => {
        updateCropBoxDOM(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }, [cropArea, updateCropBoxDOM]);

    const adjustCropSize = (dimension, delta) => {
        const prev = cropAreaRef.current || cropArea;
        
        let newWidth = prev.width;
        let newHeight = prev.height;

        if (dimension === 'width') {
            newWidth = Math.max(1, prev.width + delta);
        } else if (dimension === 'height') {
            newHeight = Math.max(1, prev.height + delta);
        }
        
        const newArea = { ...prev, width: newWidth, height: newHeight };
        
        // 1. Update Parent Ref immediately (critical for capture)
        cropAreaRef.current = newArea;

        // 2. Direct DOM update
        updateCropBoxDOM(newArea.x, newArea.y, newArea.width, newArea.height);

        // 3. Debounced State Update
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setCropArea(newArea);
        }, 300);
    };

    const scrollContainer = (direction, amount = 50) => {
        if (!scrollContainerRef.current) return;
        
        const container = scrollContainerRef.current;
        switch (direction) {
            case 'left':
                container.scrollLeft -= amount;
                break;
            case 'right':
                container.scrollLeft += amount;
                break;
            case 'up':
                container.scrollTop -= amount;
                break;
            case 'down':
                container.scrollTop += amount;
                break;
            default:
                break;
        }
    };

    const adjustZoom = (delta) => {
        const prevZoom = zoomLevelRef.current || zoomLevel;
        const next = prevZoom + delta;
        const result = Math.min(20, Math.max(0.1, next));
        
        zoomLevelRef.current = result;

        if (zoomContainerRef.current) {
            zoomContainerRef.current.style.width = `${result * 100}%`;
        }

        if (zoomDebounceTimer.current) clearTimeout(zoomDebounceTimer.current);
        zoomDebounceTimer.current = setTimeout(() => {
            setZoomLevel(result);
        }, 300);
    };

    // --- Mouse/Touch Event Handlers ---
    
    // Start Resizing
    const handleResizeStart = (e) => {
        e.stopPropagation(); // Prevent dragging
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        isResizingRef.current = true;
        resizeStartRef.current = {
            x: clientX,
            y: clientY,
            width: cropAreaRef.current?.width || 200,
            height: cropAreaRef.current?.height || 200
        };
    };

    // Start Dragging
    const handleMouseDown = (e) => {
        if (e.target.className.includes('crop-handle')) return; // Extra safety
        
        const rect = e.currentTarget.getBoundingClientRect();
        // Calculate click position relative to the box's top-left corner
        const clickX = e.clientX || (e.touches && e.touches[0].clientX);
        const clickY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clickX || !clickY) return;

        isDraggingRef.current = true;
        dragStartRef.current = { 
            x: (clickX - rect.left) - (cropAreaRef.current?.x || 0), 
            y: (clickY - rect.top) - (cropAreaRef.current?.y || 0) 
        };
    };
    
    const handleMouseMove = (e) => {
        if (!isDraggingRef.current && !isResizingRef.current) return;
        if (frameId.current) return;

        const container = e.currentTarget;
        const rect = container.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;

        frameId.current = requestAnimationFrame(() => {
            if (isResizingRef.current) {
                // RESIZING LOGIC
                const deltaX = clientX - resizeStartRef.current.x;
                const deltaY = clientY - resizeStartRef.current.y;
                
                const newWidth = Math.max(20, resizeStartRef.current.width + deltaX);
                const newHeight = Math.max(20, resizeStartRef.current.height + deltaY);
                
                // Update refs and DOM
                const newArea = { ...cropAreaRef.current, width: newWidth, height: newHeight };
                cropAreaRef.current = newArea;
                updateCropBoxDOM(newArea.x, newArea.y, newWidth, newHeight);
                
            } else if (isDraggingRef.current) {
                // DRAGGING LOGIC
                const x = clientX - rect.left;
                const y = clientY - rect.top;
                
                const currentW = cropAreaRef.current?.width || 200;
                const currentH = cropAreaRef.current?.height || 200;

                const newX = Math.max(0, Math.min(x - dragStartRef.current.x, rect.width - currentW));
                const newY = Math.max(0, Math.min(y - dragStartRef.current.y, rect.height - currentH));
                
                const newArea = { ...cropAreaRef.current, x: newX, y: newY, width: currentW, height: currentH };
                cropAreaRef.current = newArea;
                updateCropBoxDOM(newX, newY, currentW, currentH);
            }
            
            frameId.current = null;
        });
    };
    
    const handleMouseUp = () => {
        if (!isDraggingRef.current && !isResizingRef.current) return;
        
        isDraggingRef.current = false;
        isResizingRef.current = false;
        
        if (frameId.current) {
            cancelAnimationFrame(frameId.current);
            frameId.current = null;
        }
        if (cropAreaRef.current) {
            setCropArea({ ...cropAreaRef.current });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* --- CONTROLS BAR (Moved inside) --- */}
            <div style={{ padding: '5px', backgroundColor: '#ecf0f1', borderBottom: '1px solid #bdc3c7', display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                {sourceDocType === 'pdf' && pdfPages.length > 0 && (
                    <div className="pdf-page-selector" style={{margin: 0, padding: '2px 5px', border: '1px solid #ccc', backgroundColor: 'white'}}>
                        <label style={{marginRight: '5px', fontSize: '12px'}}>Pg:</label>
                        <select 
                            value={currentPdfPage} 
                            onChange={(e) => onPdfPageChange(parseInt(e.target.value))}
                            style={{padding: '2px', fontSize: '12px', border: 'none'}}
                        >
                            {pdfPages.map(pageNum => (
                                <option key={pageNum} value={pageNum}>{pageNum}</option>
                            ))}
                        </select>
                    </div>
                )}
                
                {sourceDocType === 'pdf' && (
                    <>
                        <button type="button" onClick={() => onRotate('left')} title="Rotate Left" style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>↶</button>
                        <button type="button" onClick={() => onRotate('right')} title="Rotate Right" style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>↷</button>
                    </>
                )}
                
                <div style={{height: '15px', width: '1px', backgroundColor: '#ccc', margin: '0 2px'}}></div>
                <button type="button" onClick={() => adjustZoom(-0.25)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>🔍-</button>
                <button type="button" onClick={() => adjustZoom(0.25)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>🔍+</button>
                
                <div style={{height: '15px', width: '1px', backgroundColor: '#ccc', margin: '0 2px'}}></div>
                {/* Width/Height Controls */}
                <button type="button" onClick={() => adjustCropSize('width', -20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }} title="Width -">W-</button>
                <button type="button" onClick={() => adjustCropSize('width', 20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }} title="Width +">W+</button>
                <button type="button" onClick={() => adjustCropSize('height', -20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }} title="Height -">H-</button>
                <button type="button" onClick={() => adjustCropSize('height', 20)} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }} title="Height +">H+</button>

                <div style={{height: '15px', width: '1px', backgroundColor: '#ccc', margin: '0 2px'}}></div>
                {/* Move Box Controls */}
                <div style={{display: 'flex', gap: '1px'}}>
                    <button type="button" onClick={() => scrollContainer('left')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>←</button>
                    <button type="button" onClick={() => scrollContainer('down')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>↓</button>
                    <button type="button" onClick={() => scrollContainer('up')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>↑</button>
                    <button type="button" onClick={() => scrollContainer('right')} style={{ padding: '4px 6px', fontSize: '12px', cursor: 'pointer' }}>→</button>
                </div>
            </div>

            {/* Cropper Area */}
            <div 
                ref={scrollContainerRef}
                className="cropper-container"
                style={{ flex: 1, backgroundColor: '#555', overflow: 'auto', position: 'relative', height: '100%', maxHeight: 'none', margin: 0, border: 'none', borderRadius: 0 }}
            >
                {isRenderingPage && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <div className="rendering-spinner" style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid #f3f3f3',
                            borderTop: '4px solid #3498db',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginBottom: '10px'
                        }}></div>
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                        <strong>Rendering PDF Page...</strong>
                    </div>
                )}
                <div 
                    ref={zoomContainerRef}
                    style={{ position: 'relative', width: `${zoomLevel * 100}%`, minWidth: '100%' }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleMouseDown}
                    onTouchMove={handleMouseMove}
                    onTouchEnd={handleMouseUp}
                >
                    <img 
                        ref={imageRef}
                        src={sourceDocType === 'pdf' && pdfAsImage ? pdfAsImage : sourceDocument} 
                        alt="Crop source" 
                        className="cropper-image"
                        style={{ width: '100%', display: 'block', userSelect: 'none' }}
                        draggable={false}
                    />
                    <div 
                        ref={cropBoxRef}
                        className="crop-box"
                        style={{
                            left: `${cropArea.x}px`,
                            top: `${cropArea.y}px`,
                            width: `${cropArea.width}px`,
                            height: `${cropArea.height}px`,
                            position: 'absolute',
                            border: '2px solid #3498db',
                            boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.5)',
                            willChange: 'left, top, width, height',
                            pointerEvents: 'none' // Important to let clicks pass to container if needed, but usually we want to drag box
                        }}
                    >   
                        {/* Interactive overlay for the box itself to allow dragging */}
                         <div style={{width: '100%', height: '100%', pointerEvents: 'auto', cursor: 'move'}}></div>
                         <div 
                            className="crop-handle" 
                            style={{ width: '20px', height: '20px', background: '#3498db', position: 'absolute', bottom: '-5px', right: '-5px', cursor: 'se-resize', pointerEvents: 'auto', borderRadius: '50%', border: '2px solid white', zIndex: 10 }} 
                            onMouseDown={handleResizeStart}
                            onTouchStart={handleResizeStart}
                         />
                    </div>
                </div>
            </div>
        </div>
    );
};

// Memoized item to prevent re-renders during cropper interaction
const CompactQuestionItem = React.memo(({ question, index, onCropAndAssign, onUpdate }) => {
  return (
    <div className="question-preview-item compact-view" style={{ padding: '10px', fontSize: '14px', backgroundColor: 'white', borderRadius: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
       <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px'}}>
          <strong style={{color: '#2c3e50'}}>
            Q{index + 1} ({question.type ? question.type.toUpperCase() : '?'})
            {question.board && <span style={{fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px'}}>- {question.board}</span>}
          </strong>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {question.image && <span style={{color: 'green', fontSize: '12px', fontWeight: 'bold'}}>✓ Stem Img</span>}
          </div>
       </div>
       <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#555', maxHeight: 'none', overflow: 'hidden' }}>
          {question.questionText || question.question || 'No text'}
       </p>

       {question.parts && Array.isArray(question.parts) && (
         <div style={{ marginBottom: '10px', paddingLeft: '8px', borderLeft: '2px solid #eee', fontSize: '11px', color: '#666' }}>
            {question.parts.map((part, pIdx) => (
              <div key={pIdx} style={{ marginBottom: '4px' }}>
                <strong style={{ color: '#444' }}>{part.letter?.toUpperCase()}.</strong> {part.text?.substring(0, 80)}{part.text?.length > 80 ? '...' : ''}
              </div>
            ))}
         </div>
       )}
       
       <div style={{display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
          <button 
              onClick={() => onCropAndAssign(index, 'stem')}
              style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', flex: 1}}
          >
             {question.image ? 'Replace Stem' : 'Set Stem Img'}
          </button>
          {question.image && (
            <button 
                onClick={() => onUpdate(index, 'image', null)}
                style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'}}
                title="Remove Stem Image"
            >
               ✕
            </button>
          )}
          <button 
              onClick={() => {
                  const newBoard = prompt(`Edit Board for Q${index + 1}:`, question.board || '');
                  if (newBoard !== null) onUpdate(index, 'board', newBoard);
              }}
              style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#7f8c8d', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'}}
          >
             Edit Board
          </button>
       </div>

       {question.type === 'cq' && ['a', 'b', 'c', 'd'].map((letter) => {
           const pIdx = question.parts?.findIndex(p => p.letter?.toLowerCase() === letter);
           const part = pIdx !== -1 ? question.parts[pIdx] : null;
           
           const hasImg = (letter === 'c' && question.answerimage1) || 
                         (letter === 'd' && question.answerimage2) || 
                         (letter === 'a' && question.answerimage3) || 
                         (letter === 'b' && question.answerimage4) || 
                         part?.answerImage;
           
           return (
               <div key={letter} style={{marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px'}}>
                     <span style={{fontSize: '12px', fontWeight: 'bold'}}>Part {letter.toUpperCase()})</span>
                     {hasImg && <span style={{color: 'green', fontSize: '10px', fontWeight: 'bold'}}>✓ Img</span>}
                  </div>
                  <div style={{display: 'flex', gap: '5px'}}>
                    <button 
                        onClick={() => onCropAndAssign(index, 'part', pIdx !== -1 ? pIdx : letter)}
                        style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', flex: 1}}
                    >
                       {hasImg ? `Replace ${letter.toUpperCase()}` : `Set ${letter.toUpperCase()} Image`}
                    </button>
                    {hasImg && (
                      <button 
                          onClick={() => {
                            onUpdate(index, 'part_image_remove', pIdx !== -1 ? pIdx : letter);
                          }}
                          style={{fontSize: '11px', padding: '6px 10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'}}
                          title={`Remove ${letter.toUpperCase()} Image`}
                      >
                         ✕
                      </button>
                    )}
                  </div>
               </div>
           );
       })}
    </div>
  );
});

export default function QuestionPreview({ questions, onConfirm, onCancel, title, isEditMode = false, isUploading = false }) {
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
  const cropAreaRef = useRef(cropArea);
  
  // Keep ref in sync with state for use in stable callbacks
  useEffect(() => {
    cropAreaRef.current = cropArea;
  }, [cropArea]);

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
  const [isRenderingPage, setIsRenderingPage] = useState(false); // PDF render loading state
  const pdfDocumentRef = useRef(null); // Cache for PDF document object
  const imageRef = useRef(null);
  const cropBoxRef = useRef(null); // Ref for the crop box DOM element
  const frameId = useRef(null);
  const isDraggingRef = useRef(false); // Use ref for dragging state to avoid re-renders
  const dragStartRef = useRef({ x: 0, y: 0 }); // Use ref for drag start to avoid re-renders
  
  // Performance Optimization Refs
  const debounceTimer = useRef(null);
  const zoomDebounceTimer = useRef(null);
  const zoomLevelRef = useRef(zoomLevel);
  const zoomContainerRef = useRef(null);

  // Sync zoom ref with state
  useEffect(() => {
      zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const updateCropBoxDOM = useCallback((x, y, w, h) => {
    if (cropBoxRef.current) {
      cropBoxRef.current.style.left = `${x}px`;
      cropBoxRef.current.style.top = `${y}px`;
      cropBoxRef.current.style.width = `${w}px`;
      cropBoxRef.current.style.height = `${h}px`;
    }
  }, []);

  // Synchronize DOM with state when state changes (e.g. from buttons)
  useEffect(() => {
    updateCropBoxDOM(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
  }, [cropArea, updateCropBoxDOM]);
  
  // Get unique metadata values - MEMOIZED for performance
  const getUniqueValues = useCallback((field, questionsList, dbList = []) => {
    const combined = [...questionsList, ...dbList];
    const seen = new Set();
    const result = [];
    
    for (const q of combined) {
        const val = q[field];
        if (val && typeof val === 'string' && val.trim() !== '' && val !== 'N/A' && val !== '(N/A)') {
            const trimmed = val.trim();
            if (!seen.has(trimmed)) {
                seen.add(trimmed);
                result.push(trimmed);
            }
        }
    }
    return result.sort();
  }, []);

  const uniqueSubjects = useMemo(() => getUniqueValues('subject', editableQuestions, dbQuestions), [editableQuestions, dbQuestions, getUniqueValues]);
  const uniqueChapters = useMemo(() => getUniqueValues('chapter', editableQuestions, dbQuestions), [editableQuestions, dbQuestions, getUniqueValues]);
  const uniqueLessons = useMemo(() => getUniqueValues('lesson', editableQuestions, dbQuestions), [editableQuestions, dbQuestions, getUniqueValues]);
  const uniqueBoards = useMemo(() => getUniqueValues('board', editableQuestions, dbQuestions), [editableQuestions, dbQuestions, getUniqueValues]);

  const uniqueBanglaSubjects = useMemo(() => getUniqueValues('subject', banglaQuestions), [banglaQuestions, getUniqueValues]);
  const uniqueBanglaChapters = useMemo(() => getUniqueValues('chapter', banglaQuestions), [banglaQuestions, getUniqueValues]);
  const uniqueBanglaLessons = useMemo(() => getUniqueValues('lesson', banglaQuestions), [banglaQuestions, getUniqueValues]);
  const uniqueBanglaBoards = useMemo(() => getUniqueValues('board', banglaQuestions), [banglaQuestions, getUniqueValues]);

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

  const [visibleCount, setVisibleCount] = useState(20);

  const renderQuestionList = () => {
    const enVisible = editableQuestions.slice(0, visibleCount);
    const hasMore = visibleCount < Math.max(editableQuestions.length, banglaQuestions.length);

    if (banglaQuestions.length > 0) {
        return (
            <div className="split-view-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {Array.from({ length: Math.min(visibleCount, Math.max(editableQuestions.length, banglaQuestions.length)) }).map((_, index) => (
                    <React.Fragment key={index}>
                        <div className="english-column" style={{ minWidth: 0 }}>
                            {editableQuestions[index] ? renderQuestionPreview(editableQuestions[index], index, 'english') : <div style={{ padding: '20px', textAlign: 'center', color: '#999', border: '1px dashed #ccc' }}>No English Question</div>}
                        </div>
                        <div className="bangla-column" style={{ minWidth: 0 }}>
                            {banglaQuestions[index] ? renderQuestionPreview(banglaQuestions[index], index, 'bangla') : <div style={{ padding: '20px', textAlign: 'center', color: '#999', border: '1px dashed #ccc' }}>No Bangla Question</div>}
                        </div>
                    </React.Fragment>
                ))}
                {hasMore && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                        <button 
                            type="button" 
                            onClick={() => setVisibleCount(prev => prev + 20)}
                            className="confirm-btn"
                            style={{ backgroundColor: '#3498db', padding: '12px 40px' }}
                        >
                            Load More Questions ({Math.max(editableQuestions.length, banglaQuestions.length) - visibleCount} remaining)
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="preview-questions-container">
            {enVisible.map((question, index) => renderQuestionPreview(question, index))}
            {hasMore && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                    <button 
                        type="button" 
                        onClick={() => setVisibleCount(prev => prev + 20)}
                        className="confirm-btn"
                        style={{ backgroundColor: '#3498db', padding: '12px 40px' }}
                    >
                        Load More Questions ({editableQuestions.length - visibleCount} remaining)
                    </button>
                </div>
            )}
        </div>
    );
  };
  
  const updateQuestionPart = useCallback((qIndex, partIndex, field, value, listType = 'english') => {
    console.log(`[QuestionPreview] updateQuestionPart: Q#${qIndex}, Part: ${partIndex}, Field: ${field}, Value type: ${typeof value}`);
    const setter = listType === 'english' ? setEditableQuestions : setBanglaQuestions;
    setter(prev => {
      if (qIndex >= prev.length) return prev;
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      const parts = [...(q.parts || [])];
      
      let actualIdx = partIndex;
      // If partIndex is a letter (e.g. 'a', 'b'), find or create that part
      if (typeof partIndex === 'string') {
          actualIdx = parts.findIndex(p => p.letter?.toLowerCase() === partIndex.toLowerCase());
          if (actualIdx === -1) {
              console.log(`[QuestionPreview] Creating new part object for letter: ${partIndex}`);
              // Add a placeholder part if it doesn't exist
              parts.push({ letter: partIndex.toLowerCase(), text: '', marks: 0, answer: '' });
              actualIdx = parts.length - 1;
          }
      }
      
      if (actualIdx >= 0 && actualIdx < parts.length) {
          parts[actualIdx] = { ...parts[actualIdx], [field]: value };
          
          // Auto-map legacy image fields for the current list
          if (field === 'answerImage') {
              const partLetter = parts[actualIdx]?.letter?.toLowerCase();
              console.log(`[QuestionPreview] Syncing part ${partLetter} image to legacy column...`);
              if (partLetter === 'c') { q.answerimage1 = value; console.log(' -> answerimage1 updated'); }
              else if (partLetter === 'd') { q.answerimage2 = value; console.log(' -> answerimage2 updated'); }
              else if (partLetter === 'a') { q.answerimage3 = value; console.log(' -> answerimage3 updated'); }
              else if (partLetter === 'b') { q.answerimage4 = value; console.log(' -> answerimage4 updated'); }
          }
      }
      
      q.parts = parts;
      updated[qIndex] = q;
      return updated;
    });

    // Auto-sync to Bangla version if setting an image in English
    if (listType === 'english' && field === 'answerImage') {
      setBanglaQuestions(prev => {
        if (qIndex >= prev.length) return prev;
        const updated = [...prev];
        const q = { ...updated[qIndex] };
        const parts = [...(q.parts || [])];
        
        let actualIdx = partIndex;
        if (typeof partIndex === 'string') {
            actualIdx = parts.findIndex(p => p.letter?.toLowerCase() === partIndex.toLowerCase());
            if (actualIdx === -1) {
                parts.push({ letter: partIndex.toLowerCase(), text: '', marks: 0, answer: '' });
                actualIdx = parts.length - 1;
            }
        }

        if (actualIdx >= 0 && actualIdx < parts.length) {
            parts[actualIdx] = { ...parts[actualIdx], [field]: value };
            
            // Sync legacy fields too
            const partLetter = parts[actualIdx]?.letter?.toLowerCase();
            if (partLetter === 'c') q.answerimage1 = value;
            else if (partLetter === 'd') q.answerimage2 = value;
            else if (partLetter === 'a') q.answerimage3 = value;
            else if (partLetter === 'b') q.answerimage4 = value;
        }
        
        q.parts = parts;
        updated[qIndex] = q;
        return updated;
      });
    }
  }, []);

  const updateQuestion = useCallback((index, field, value, listType = 'english') => {
    console.log(`📝 [QuestionPreview] updateQuestion: Index ${index}, Field ${field}, Value type: ${typeof value}`);
    if (typeof value === 'string' && value.startsWith('http')) {
        console.log(`   -> URL: ${value.substring(0, 60)}...`);
    }
    
    if (field === 'part_image_remove') {
        const partIndex = value;
        console.log(`   -> Removing part image for Q#${index}, Part: ${partIndex}`);
        updateQuestionPart(index, partIndex, 'answerImage', null);
        
        const setter = listType === 'english' ? setEditableQuestions : setBanglaQuestions;
        setter(prev => {
            if (index >= prev.length) return prev;
            const updated = [...prev];
            const q = { ...updated[index] };
            
            let partLetter = null;
            if (typeof partIndex === 'number') {
                partLetter = q.parts?.[partIndex]?.letter?.toLowerCase();
            } else if (typeof partIndex === 'string') {
                partLetter = partIndex.toLowerCase();
            }

            console.log(`   -> Syncing removal to legacy column for letter: ${partLetter}`);
            if (partLetter === 'c') q.answerimage1 = null;
            else if (partLetter === 'd') q.answerimage2 = null;
            else if (partLetter === 'a') q.answerimage3 = null;
            else if (partLetter === 'b') q.answerimage4 = null;
            
            updated[index] = q;
            return updated;
        });

        if (listType === 'english') {
            setBanglaQuestions(prev => {
                if (index >= prev.length) return prev;
                const updated = [...prev];
                const q = { ...updated[index] };
                
                let partLetter = null;
                if (typeof partIndex === 'number') {
                    partLetter = q.parts?.[partIndex]?.letter?.toLowerCase();
                } else if (typeof partIndex === 'string') {
                    partLetter = partIndex.toLowerCase();
                }

                if (partLetter === 'c') q.answerimage1 = null;
                else if (partLetter === 'd') q.answerimage2 = null;
                else if (partLetter === 'a') q.answerimage3 = null;
                else if (partLetter === 'b') q.answerimage4 = null;
                
                updated[index] = q;
                return updated;
            });
        }
        return;
    }

    const setter = listType === 'english' ? setEditableQuestions : setBanglaQuestions;
    setter(prev => {
      const updated = [...prev];
      const q = { ...updated[index], [field]: value };
      
      // Sync top-level answerimage columns back to parts
      if (q.parts && Array.isArray(q.parts)) {
          const mapping = {
              'answerimage1': 'c',
              'answerimage2': 'd',
              'answerimage3': 'a',
              'answerimage4': 'b'
          };
          const targetLetter = mapping[field];
          if (targetLetter) {
              console.log(`   -> Syncing legacy ${field} update back to part ${targetLetter}`);
              q.parts = q.parts.map(p => 
                  p.letter?.toLowerCase() === targetLetter 
                  ? { ...p, image: value, answerImage: value } 
                  : p
              );
          }
      }
      
      updated[index] = q;
      return updated;
    });

    if (listType === 'english' && (field === 'image' || field === 'answerimage1' || field === 'answerimage2' || field === 'answerimage3' || field === 'answerimage4')) {
      console.log(`   -> Auto-syncing image field ${field} to Bangla list`);
      setBanglaQuestions(prev => {
        if (index >= prev.length) return prev;
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    }
  }, [updateQuestionPart]);

  const handlePartImageUpload = useCallback((qIndex, partIndex, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateQuestionPart(qIndex, partIndex, 'answerImage', reader.result);
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
      } else if (partLetter === 'a') {
        updated[qIndex] = { ...updated[qIndex], answerimage3: null };
      } else if (partLetter === 'b') {
        updated[qIndex] = { ...updated[qIndex], answerimage4: null };
      }
      return updated;
    });
  }, [updateQuestionPart]);

  const clearAllImages = () => {
    if (!window.confirm('Are you sure you want to clear ALL images from ALL questions in this batch? This cannot be undone.')) {
      return;
    }

    setEditableQuestions(prev => prev.map(q => {
      const updated = { ...q, image: null, answerimage1: null, answerimage2: null, answerimage3: null, answerimage4: null };
      if (updated.parts) {
        updated.parts = updated.parts.map(p => ({ ...p, answerImage: null }));
      }
      return updated;
    }));

    setBanglaQuestions(prev => prev.map(q => {
      const updated = { ...q, image: null, answerimage1: null, answerimage2: null, answerimage3: null, answerimage4: null };
      if (updated.parts) {
        updated.parts = updated.parts.map(p => ({ ...p, answerImage: null }));
      }
      return updated;
    }));
    
    alert('✓ All images cleared from current batch.');
  };

  // Track object URLs for cleanup
  const objectUrlsRef = useRef([]);
  const trackObjectUrl = (url) => {
    if (url && url.startsWith('blob:')) {
      objectUrlsRef.current.push(url);
    }
    return url;
  };

  useEffect(() => {
    const currentUrls = objectUrlsRef.current;
    return () => {
      // Cleanup all object URLs when component unmounts
      currentUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleCropAndAssign = useCallback((qIndex, targetType, partIndex = null) => {
    if (!imageRef.current) return;
    
    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const displayedWidth = rect.width;
    const displayedHeight = rect.height;
    
    if (displayedWidth === 0 || displayedHeight === 0) return;

    const scaleX = img.naturalWidth / displayedWidth;
    const scaleY = img.naturalHeight / displayedHeight;
    const currentCropArea = cropAreaRef.current;
    
    const canvas = document.createElement('canvas');
    const actualWidth = currentCropArea.width * scaleX;
    const actualHeight = currentCropArea.height * scaleY;

    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      currentCropArea.x * scaleX,
      currentCropArea.y * scaleY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    );
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedImageUrl = trackObjectUrl(URL.createObjectURL(blob));
      console.log(`📸 handleCropAndAssign: Generated blob for Q#${qIndex + 1}, target: ${targetType}${partIndex !== null ? ', part: ' + partIndex : ''}`);

      if (targetType === 'stem') {
          updateQuestion(qIndex, 'image', croppedImageUrl);
      } else if (targetType === 'part' && partIndex !== null) {
          updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImageUrl);
      }
    }, 'image/jpeg', 0.8);
  }, [updateQuestion, updateQuestionPart]);

  console.log('[Performance] QuestionPreview Render Start');
  const prevDeps = useRef({ editableQuestions, handleCropAndAssign, updateQuestion, easyVisibleCount: 20 });

  const [easyVisibleCount, setEasyVisibleCount] = useState(20);

  const memoizedQuestionList = useMemo(() => {
    const changed = [];
    if (prevDeps.current.editableQuestions !== editableQuestions) changed.push('editableQuestions');
    if (prevDeps.current.handleCropAndAssign !== handleCropAndAssign) changed.push('handleCropAndAssign');
    if (prevDeps.current.updateQuestion !== updateQuestion) changed.push('updateQuestion');
    if (prevDeps.current.easyVisibleCount !== easyVisibleCount) changed.push('easyVisibleCount');
    
    console.log('[Performance] Recalculating memoizedQuestionList due to:', changed.join(', '));
    
    prevDeps.current = { editableQuestions, handleCropAndAssign, updateQuestion, easyVisibleCount };

    const displayList = editableQuestions.slice(0, easyVisibleCount);
    const hasMore = editableQuestions.length > easyVisibleCount;

    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
            {displayList.map((q, idx) => (
                <CompactQuestionItem 
                    key={idx} 
                    question={q} 
                    index={idx} 
                    onCropAndAssign={handleCropAndAssign} 
                    onUpdate={updateQuestion}
                />
            ))}
        </div>
        {hasMore && (
            <div style={{ textAlign: 'center', padding: '10px' }}>
                <button 
                    type="button" 
                    onClick={() => setEasyVisibleCount(prev => prev + 20)}
                    style={{ padding: '8px 20px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                    Load More ({editableQuestions.length - easyVisibleCount} remaining)
                </button>
            </div>
        )}
    </div>
  )}, [editableQuestions, handleCropAndAssign, updateQuestion, easyVisibleCount]);

  if (!questions || questions.length === 0) return null;
  
  const convertPdfPageToImage = async (pdfDocument, pageNumber, rot = 0) => {
    try {
      if (!pdfDocument) return null;
      const page = await pdfDocument.getPage(pageNumber);
      
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
        }, 'image/jpeg', 0.8); // Use JPEG for smaller blobs and faster processing
      });
    } catch (error) {
      console.error('Error converting PDF to image:', error);
      return null;
    }
  };

  const rotateSource = async (direction) => {
    console.log(`[Performance] rotateSource triggered: ${direction}`);
    const start = performance.now();
    if (sourceDocType !== 'pdf' || !pdfDocumentRef.current) return;
    
    let newRotation = (rotation + (direction === 'left' ? -90 : 90)) % 360;
    if (newRotation < 0) newRotation += 360;
    
    setIsRenderingPage(true);
    setRotation(newRotation);
    
    if (sourceDocument && sourceDocument.startsWith('blob:')) {
        URL.revokeObjectURL(sourceDocument);
    }
    
    console.log(`[Performance] Generating rotated PDF page...`);
    const imageData = await convertPdfPageToImage(pdfDocumentRef.current, currentPdfPage, newRotation);
    setPdfAsImage(imageData);
    setSourceDocument(imageData);
    setIsRenderingPage(false);
    console.log(`[Performance] rotateSource completed in ${performance.now() - start}ms`);
  };

  const handleSourceDocumentUpload = async (file) => {
    if (!file) return;
    
    const fileType = file.type;
    setRotation(0);
    setIsRenderingPage(true);
    
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
          pdfDocumentRef.current = pdf; // Cache the document
          
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
          
          const imageData = await convertPdfPageToImage(pdf, 1, 0);
          setPdfAsImage(imageData);
          setSourceDocument(imageData);
        } catch (error) {
          console.error('Error processing PDF:', error);
          alert('Error processing PDF file. Please try again.');
        } finally {
          setIsRenderingPage(false);
        }
      };
      
      reader.readAsArrayBuffer(file);
    } else if (fileType.includes('image')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceDocument(reader.result);
        setIsRenderingPage(false);
      };
      reader.readAsDataURL(file);
      
      setSourceDocType('image');
      setPdfAsImage(null);
      setPdfPages([]);
      setPdfArrayBuffer(null);
      pdfDocumentRef.current = null;
    }
  };
  
  const handlePdfPageChange = async (pageNumber) => {
    console.log(`[Performance] handlePdfPageChange triggered: Page ${pageNumber}`);
    const start = performance.now();
    if (!pdfDocumentRef.current) {
      console.error('PDF document not loaded');
      return;
    }
    
    setIsRenderingPage(true);
    setCurrentPdfPage(pageNumber);
    if (sourceDocument && sourceDocument.startsWith('blob:')) {
        URL.revokeObjectURL(sourceDocument);
    }
    const imageData = await convertPdfPageToImage(pdfDocumentRef.current, pageNumber, rotation);
    setPdfAsImage(imageData);
    setSourceDocument(imageData);
    setIsRenderingPage(false);
    console.log(`[Performance] handlePdfPageChange completed in ${performance.now() - start}ms`);
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
    const currentCropArea = cropAreaRef.current;
    
    const canvas = document.createElement('canvas');
    const actualWidth = currentCropArea.width * scaleX;
    const actualHeight = currentCropArea.height * scaleY;

    canvas.width = actualWidth;
    canvas.height = actualHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      currentCropArea.x * scaleX,
      currentCropArea.y * scaleY,
      actualWidth,
      actualHeight,
      0,
      0,
      actualWidth,
      actualHeight
    );
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedImageUrl = trackObjectUrl(URL.createObjectURL(blob));

      if (typeof currentCroppingIndex === 'object' && currentCroppingIndex !== null && currentCroppingIndex.type === 'part') {
        const { qIndex, partIndex } = currentCroppingIndex;
        updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImageUrl);
      } else {
        updateQuestion(currentCroppingIndex, 'image', croppedImageUrl);
      }

      setShowCropper(false);
      setCurrentCroppingIndex(null);
    }, 'image/jpeg', 0.8);
  };
  
  const handleMouseDown = (e) => {
    if (e.target.className === 'crop-handle') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isDraggingRef.current = true;
    dragStartRef.current = { x: x - cropAreaRef.current.x, y: y - cropAreaRef.current.y };
    setIsDragging(true);
  };
  
  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    
    if (frameId.current) return;

    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    frameId.current = requestAnimationFrame(() => {
      const newX = Math.max(0, Math.min(x - dragStartRef.current.x, rect.width - cropAreaRef.current.width));
      const newY = Math.max(0, Math.min(y - dragStartRef.current.y, rect.height - cropAreaRef.current.height));
      
      // Update the Ref immediately for logic
      cropAreaRef.current = { ...cropAreaRef.current, x: newX, y: newY };
      
      // Update the DOM directly for smoothness (no re-render!)
      updateCropBoxDOM(newX, newY, cropAreaRef.current.width, cropAreaRef.current.height);
      
      frameId.current = null;
    });
  };
  
  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    
    isDraggingRef.current = false;
    setIsDragging(false);
    
    if (frameId.current) {
      cancelAnimationFrame(frameId.current);
      frameId.current = null;
    }
    
    // FINALLY update state once drag is done to keep React in sync
    setCropArea({ ...cropAreaRef.current });
  };
  
  const handleTouchStart = (e) => {
    if (e.target.className === 'crop-handle') return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    isDraggingRef.current = true;
    dragStartRef.current = { x: x - cropAreaRef.current.x, y: y - cropAreaRef.current.y };
    setIsDragging(true);
  };
  
  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    
    if (frameId.current) return;

    const touch = e.touches[0];
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    frameId.current = requestAnimationFrame(() => {
      const newX = Math.max(0, Math.min(x - dragStartRef.current.x, rect.width - cropAreaRef.current.width));
      const newY = Math.max(0, Math.min(y - dragStartRef.current.y, rect.height - cropAreaRef.current.height));
      
      cropAreaRef.current = { ...cropAreaRef.current, x: newX, y: newY };
      updateCropBoxDOM(newX, newY, cropAreaRef.current.width, cropAreaRef.current.height);
      
      frameId.current = null;
    });
  };
  
  const handleTouchEnd = () => {
    handleMouseUp();
  };
  
  const adjustCropSize = (dimension, delta) => {
    console.log(`[Performance] adjustCropSize triggered: ${dimension} ${delta}`);
    const start = performance.now();

    // 1. Calculate new values based on REF (current truth) to allow rapid updates
    const prev = cropAreaRef.current;
    let newWidth = prev.width;
    let newHeight = prev.height;

    if (dimension === 'width') {
      newWidth = Math.max(1, prev.width + delta);
    } else if (dimension === 'height') {
      newHeight = Math.max(1, prev.height + delta);
    }
    
    // 2. Update Ref immediately
    const newArea = { ...prev, width: newWidth, height: newHeight };
    cropAreaRef.current = newArea;

    // 3. Direct DOM update for instant feedback (bypassing React render lag)
    updateCropBoxDOM(newArea.x, newArea.y, newArea.width, newArea.height);

    // 4. Schedule Debounced React State Update
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
        console.log('[Performance] Syncing cropArea state after debounce');
        setCropArea(newArea);
    }, 300);
    
    console.log(`[Performance] adjustCropSize calculation took ${performance.now() - start}ms`);
  };

  const adjustZoom = (delta) => {
    console.log(`[Performance] adjustZoom triggered: delta ${delta}`);
    
    // 1. Calculate new zoom based on Ref
    const prevZoom = zoomLevelRef.current || zoomLevel;
    const next = prevZoom + delta;
    const result = Math.min(20, Math.max(0.1, next));
    
    // 2. Update Ref immediately
    zoomLevelRef.current = result;
    console.log(`[Performance] New Zoom Level (Ref): ${result}`);

    // 3. Direct DOM Update
    if (zoomContainerRef.current) {
        zoomContainerRef.current.style.width = `${result * 100}%`;
    }

    // 4. Schedule Debounced React State Update
    if (zoomDebounceTimer.current) clearTimeout(zoomDebounceTimer.current);
    zoomDebounceTimer.current = setTimeout(() => {
        console.log('[Performance] Syncing zoomLevel state after debounce');
        setZoomLevel(result);
    }, 300);
  };

  const moveCropBox = (direction, amount = 10) => {
    if (!imageRef.current) return;
    console.log(`[Performance] moveCropBox triggered: ${direction}`);
    const start = performance.now();

    const img = imageRef.current;
    // Use Ref for current state
    const prev = cropAreaRef.current;
    const maxX = Math.max(0, img.width - prev.width);
    const maxY = Math.max(0, img.height - prev.height);
    
    let newX = prev.x;
    let newY = prev.y;

    switch (direction) {
      case 'left':
        newX = Math.max(0, prev.x - amount);
        break;
      case 'right':
        newX = Math.min(maxX, prev.x + amount);
        break;
      case 'up':
        newY = Math.max(0, prev.y - amount);
        break;
      case 'down':
        newY = Math.min(maxY, prev.y + amount);
        break;
      default:
        break;
    }

    // 1. Update Ref
    const newArea = { ...prev, x: newX, y: newY };
    cropAreaRef.current = newArea;

    // 2. Direct DOM update
    updateCropBoxDOM(newArea.x, newArea.y, newArea.width, newArea.height);

    // 3. Schedule Debounced React State Update
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
        console.log('[Performance] Syncing cropArea state after debounce');
        setCropArea(newArea);
    }, 300);
    
    console.log(`[Performance] moveCropBox took ${performance.now() - start}ms`);
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
             if (engQ.answerimage3) newQ.answerimage3 = engQ.answerimage3;
             if (engQ.answerimage4) newQ.answerimage4 = engQ.answerimage4;

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
                 if (bnPart.letter === 'a' && newQ.answerimage3) {
                     return { ...bnPart, answerImage: newQ.answerimage3 };
                 }
                 if (bnPart.letter === 'b' && newQ.answerimage4) {
                     return { ...bnPart, answerImage: newQ.answerimage4 };
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

                {(part.letter?.toLowerCase() === 'a' || part.letter?.toLowerCase() === 'b' || part.letter?.toLowerCase() === 'c' || part.letter?.toLowerCase() === 'd') && (
                  <div style={{ marginTop: '10px' }}>
                    <label className="image-upload-label">
                      {part.letter?.toLowerCase() === 'c' ? 'Answer Image 1 (answerimage1)' : 
                       part.letter?.toLowerCase() === 'd' ? 'Answer Image 2 (answerimage2)' : 
                       part.letter?.toLowerCase() === 'a' ? 'Answer Image 3 (answerimage3)' : 
                       'Answer Image 4 (answerimage4)'}
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
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                        onClick={clearAllImages}
                        style={{ padding: '6px 12px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
                    >
                        🗑️ Clear All Images
                    </button>
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
                        <EasyCropper 
                            sourceDocument={sourceDocument}
                            sourceDocType={sourceDocType}
                            pdfAsImage={pdfAsImage}
                            pdfPages={pdfPages}
                            currentPdfPage={currentPdfPage}
                            onPdfPageChange={handlePdfPageChange}
                            onRotate={rotateSource}
                            imageRef={imageRef}
                            cropAreaRef={cropAreaRef}
                            isRenderingPage={isRenderingPage}
                        />
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
                    {memoizedQuestionList}
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
          <p className="preview-count" dangerouslySetInnerHTML={{ __html: isEditMode 
              ? `Review and edit ${editableQuestions.length} question${editableQuestions.length !== 1 ? 's' : ''} from the batch.`
              : `Review and edit <strong>${editableQuestions.length}</strong> question${editableQuestions.length !== 1 ? 's' : ''} before adding to the question bank.`
          }} />
          
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
              zIndex: 11000
            }}>
              <div className="panel" style={{ width: '600px', backgroundColor: 'white', padding: '25px', borderRadius: '10px' }}>
                <h3>Add Bangla Version</h3>
                <p style={{ fontSize: '14px', color: '#666' }}>
                  Paste the Bangla version of the questions here. They will be mapped sequentially to the current English list, and images will be copied automatically.
                </p>
                <textarea
                  value={banglaInputText}
                  onChange={(e) => setBanglaInputText(e.target.value)}
                  placeholder="Paste Bangla questions here..."
                  style={{ width: '100%', minHeight: '300px', marginBottom: '15px' }}
                />
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => setShowBanglaUpload(false)} className="danger">Cancel</button>
                  <button type="button" onClick={handleBanglaUpload} className="confirm">Process & Sync Bangla</button>
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
                    type="button"
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
                    type="button"
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
                    <button type="button" onClick={applyBulkMetadata} style={{ flex: 1, backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
                    <button type="button" onClick={() => setShowBulkEditor(false)} style={{ flex: 1, backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
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
                      type="button"
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
                      type="button"
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
                      <button type="button" onClick={applyBanglaBulkMetadata} style={{ flex: 1, backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Apply</button>
                      <button type="button" onClick={() => setShowBanglaBulkEditor(false)} style={{ flex: 1, backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button 
                    type="button"
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
            {renderQuestionList()}
          </div>

          <div className="preview-modal-actions">
            <button 
              className="confirm-btn" 
              onClick={() => onConfirm([...editableQuestions, ...banglaQuestions])}
              disabled={isUploading}
              style={{ opacity: isUploading ? 0.7 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
            >
              {isUploading ? 'Uploading...' : (isEditMode ? 'Save Changes' : `Confirm & Add ${editableQuestions.length + banglaQuestions.length} Questions`)}
            </button>
            <button className="cancel-btn" onClick={onCancel} disabled={isUploading}>
              {isEditMode ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Image Cropper Modal */}
      {showCropper && sourceDocument && (
        <div 
          className="cropper-modal-overlay"
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
                  ref={cropBoxRef}
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
