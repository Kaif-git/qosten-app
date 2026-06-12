import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './QuestionPreview.css';
import LatexRenderer from '../LatexRenderer/LatexRenderer';
import { useQuestions } from '../../context/QuestionContext';
import { parseCQQuestions } from '../../utils/cqParser';
import { parseMCQQuestions } from '../../utils/mcqQuestionParser';
import * as pdfjsLib from 'pdfjs-dist';
import { processImage } from '../../utils/imageProcessor';
import { renderMarkdownHTML } from '../../utils/markdownRenderer';
import { questionApi } from '../../services/questionApi';
import { areBoardsEquivalent } from '../../utils/latexUtils';
import 'katex/dist/katex.min.css';

// Set up PDF.js worker using unpkg CDN with matching version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Check if text contains math expressions that are missing LaTeX delimiters.
 * Flags patterns like a^2b + abc, sqrt(2), etc. that lack \(...\) or $$...$$ wrapping.
 */
function hasMissingLatex(text) {
  if (!text || typeof text !== 'string') return false;
  // If already wrapped in LaTeX delimiters, assume it's fine
  if (/\\\(.*\\\)|\$\$.*\$\$/.test(text)) return false;
  // Pattern: letter/digit followed by ^ followed by digit/letter (exponents like a^2, x^2)
  if (/[a-zA-Z0-9]\^[a-zA-Z0-9]/.test(text)) return true;
  // Pattern: standalone \sqrt, \frac, etc. without surrounding \(...\)
  if (/\\frac\{|\\sqrt\{/.test(text)) return true;
  // Pattern: algebraic expression with ^ and = (e.g. a^2b + abc = c^2a)
  if (/[a-zA-Z]\^[a-zA-Z0-9]\s*[+\-*/]\s*[a-zA-Z]/.test(text)) return true;
  // Pattern: multi-term algebra with = and exponents
  if (/[a-zA-Z]\^[a-zA-Z0-9].*=.*[a-zA-Z]/.test(text)) return true;
  return false;
}

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
    }, [cropArea, cropAreaRef]);

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
           <LatexRenderer text={question.questionText || question.question || 'No text'} />
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

const CompactQuestionPair = React.memo(({ enQuestion, bnQuestion, index, onCropAndAssign, onUpdate }) => {
  return (
    <div className="question-preview-item compact-view" style={{
      padding: '10px', fontSize: '14px', backgroundColor: 'white',
      borderRadius: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {/* English Column */}
        <div style={{ borderRight: '1px solid #eee', paddingRight: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <strong style={{ color: '#2c3e50', fontSize: '13px' }}>
              🇬🇧 EN Q{index + 1}
              {enQuestion.board && (
                <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  - {enQuestion.board}
                </span>
              )}
            </strong>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {enQuestion.type && <span style={{ fontSize: '10px', color: '#999' }}>{enQuestion.type.toUpperCase()}</span>}
              {enQuestion.image && <span style={{ color: 'green', fontSize: '12px', fontWeight: 'bold' }}>✓ Img</span>}
            </div>
          </div>
           <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#555', maxHeight: 'none', overflow: 'hidden' }}>
             <LatexRenderer text={enQuestion.questionText || enQuestion.question || 'No text'} />
           </p>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => onCropAndAssign(index, 'stem', null, 'english')}
              style={{ fontSize: '11px', padding: '6px 10px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', flex: 1 }}
            >
              {enQuestion.image ? 'Replace EN Stem' : 'Set EN Stem Img'}
            </button>
            {enQuestion.image && (
              <button
                onClick={() => onUpdate(index, 'image', null, 'english')}
                style={{ fontSize: '11px', padding: '6px 10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                title="Remove English Stem Image"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {/* Bangla Column */}
        <div style={{ backgroundColor: '#f8f4ff', borderRadius: '4px', padding: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <strong style={{ color: '#8e44ad', fontSize: '13px' }}>
              🇧🇩 BN Q{index + 1}
              {bnQuestion.board && (
                <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                  - {bnQuestion.board}
                </span>
              )}
            </strong>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              {bnQuestion.type && <span style={{ fontSize: '10px', color: '#999' }}>{bnQuestion.type.toUpperCase()}</span>}
              {bnQuestion.image && <span style={{ color: 'green', fontSize: '12px', fontWeight: 'bold' }}>✓ Img</span>}
            </div>
          </div>
           <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#555', maxHeight: 'none', overflow: 'hidden' }}>
             <LatexRenderer text={bnQuestion.questionText || bnQuestion.question || 'No text'} />
           </p>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={() => onCropAndAssign(index, 'stem', null, 'bangla')}
              style={{ fontSize: '11px', padding: '6px 10px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', flex: 1 }}
            >
              {bnQuestion.image ? 'Replace BN Stem' : 'Set BN Stem Img'}
            </button>
            {bnQuestion.image && (
              <button
                onClick={() => onUpdate(index, 'image', null, 'bangla')}
                style={{ fontSize: '11px', padding: '6px 10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                title="Remove Bangla Stem Image"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function QuestionPreview({ questions, onConfirm, onCancel, title, isEditMode = false, isUploading = false, bnContent }) {
  const { questions: dbQuestions, addQuestion } = useQuestions();

  const [editableQuestions, setEditableQuestions] = useState(questions);

  // Refs to avoid stale closures in callbacks
  const editableQuestionsRef = useRef(editableQuestions);
  useEffect(() => { editableQuestionsRef.current = editableQuestions; }, [editableQuestions]);

  useEffect(() => {
    setEditableQuestions(questions);
  }, [questions]);

  const [banglaQuestions, setBanglaQuestions] = useState([]);
  const banglaQuestionsRef = useRef(banglaQuestions);
  useEffect(() => { banglaQuestionsRef.current = banglaQuestions; }, [banglaQuestions]);

  const [unmatchedBanglaQuestions, setUnmatchedBanglaQuestions] = useState([]);
  const [isMatchingMode, setIsMatchingMode] = useState(false);
  const [matchingIndex, setMatchingIndex] = useState(0);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [selectedReviewEngIdx, setSelectedReviewEngIdx] = useState(null);
  const [selectedReviewBnIdx, setSelectedReviewBnIdx] = useState(null);
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
  const [easySourceMode, setEasySourceMode] = useState('cropper'); // 'cropper' | 'markdown'
  const [mdInput, setMdInput] = useState('');
   const [selectedMdImages, setSelectedMdImages] = useState(new Set());
   const [mergedImageUrl, setMergedImageUrl] = useState(null);
   const [mergerImages, setMergerImages] = useState([]);
   const [showAllBanglaCandidates, setShowAllBanglaCandidates] = useState(false);
   const [boardSearchText, setBoardSearchText] = useState('');
   const [textSearchText, setTextSearchText] = useState('');
   const pdfDocumentRef = useRef(null); // Cache for PDF document object
  const imageRef = useRef(null);
  const cropBoxRef = useRef(null); // Ref for the crop box DOM element
  const frameId = useRef(null);
  const isDraggingRef = useRef(false); // Use ref for dragging state to avoid re-renders
  const dragStartRef = useRef({ x: 0, y: 0 }); // Use ref for drag start to avoid re-renders
  const mdContainerRef = useRef(null);
  
  // Performance Optimization Refs
  const debounceTimer = useRef(null);
  const zoomDebounceTimer = useRef(null);
  const zoomLevelRef = useRef(zoomLevel);
  const zoomContainerRef = useRef(null);
  const loadFileInputRef = useRef(null);

  // Sync zoom ref with state
  useEffect(() => {
      zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const handleMergeImages = useCallback(async () => {
    const urls = [...selectedMdImages];
    if (urls.length < 2) return;

    const fetchAsBlob = async (url) => {
      try {
        const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
        if (resp.ok) return await resp.blob();
      } catch (_) {}
      // Fallback: proxy through our own API (bypasses CORS + signed URL restrictions)
      return await questionApi.proxyImage(url);
    };

    try {
      const blobs = await Promise.all(urls.map(fetchAsBlob));
      const loaded = await Promise.all(blobs.map(blob => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      })));
      const maxWidth = Math.max(...loaded.map(img => img.width));
      const totalHeight = loaded.reduce((sum, img) => sum + img.height, 0);
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      let y = 0;
      for (const img of loaded) {
        ctx.drawImage(img, Math.floor((maxWidth - img.width) / 2), y);
        y += img.height;
      }
      setMergedImageUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Merge failed:', err);
      alert('Failed to merge images. Try downloading them first and uploading through the Upload tab.');
    }
  }, [selectedMdImages]);

  useEffect(() => {
    if (!mdContainerRef.current) return;
    const imgs = mdContainerRef.current.querySelectorAll('img');
    imgs.forEach(img => {
      if (selectedMdImages.has(img.src)) {
        img.style.outline = '3px solid #3498db';
        img.style.outlineOffset = '2px';
        img.style.borderRadius = '4px';
      } else {
        img.style.outline = 'none';
        img.style.outlineOffset = '0';
      }
    });
  }, [selectedMdImages, mdInput]);

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
        if (!q) continue;
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

  const matchBanglaQuestion = (bnIndex) => {
    const engQ = editableQuestions[matchingIndex];
    const bnQ = unmatchedBanglaQuestions[bnIndex];
    const syncedBnQ = syncImagesToBangla(engQ, bnQ);
    
    setBanglaQuestions(prev => {
      const updated = [...prev];
      updated[matchingIndex] = syncedBnQ;
      return updated;
    });
    
    const remainingBangla = unmatchedBanglaQuestions.filter((_, i) => i !== bnIndex);
    setUnmatchedBanglaQuestions(remainingBangla);
    
    const nextQuestionWithImage = editableQuestions.slice(matchingIndex + 1).findIndex(q => 
      q.image || q.imageUrl || q.questionImage || 
      q.answerimage1 || q.answerimage2 || q.answerimage3 || q.answerimage4 || 
      (q.parts && q.parts.some(p => p.answerImage))
    );

    if (nextQuestionWithImage !== -1) {
      setMatchingIndex(matchingIndex + 1 + nextQuestionWithImage);
    } else {
      setIsMatchingMode(false);
      if (remainingBangla.length > 0) {
        if (window.confirm(`Some Bangla questions (${remainingBangla.length}) remain unmatched. Would you like to enter Manual Review mode to match them?`)) {
          setIsReviewMode(true);
        } else {
          setUnmatchedBanglaQuestions([]);
        }
      } else {
        alert('✅ All questions matched!');
      }
    }
  };

  const reviewMatchBanglaQuestion = (engIdx, bnIdx) => {
    const engQ = editableQuestions[engIdx];
    const bnQ = unmatchedBanglaQuestions[bnIdx];
    const syncedBnQ = syncImagesToBangla(engQ, bnQ);
    
    setBanglaQuestions(prev => {
      const updated = [...prev];
      updated[engIdx] = syncedBnQ;
      return updated;
    });
    
    setUnmatchedBanglaQuestions(prev => prev.filter((_, i) => i !== bnIdx));
  };

  const renderReviewView = () => {
    const unmatchedEnglish = editableQuestions
      .map((q, i) => (!banglaQuestions[i] ? { q, i } : null))
      .filter(Boolean);
    
    const unmatchedBangla = unmatchedBanglaQuestions;

    if (unmatchedEnglish.length === 0 && unmatchedBangla.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #ddd' }}>
          <h3 style={{ color: '#27ae60' }}>✅ All questions matched!</h3>
          <button onClick={() => setIsReviewMode(false)} style={{ marginTop: '15px', padding: '8px 16px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Back to Preview</button>
        </div>
      );
    }

    return (
      <div className="review-mode-container" style={{ padding: '20px', backgroundColor: '#fdfdfd', borderRadius: '10px', border: '2px solid #e67e22' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, color: '#d35400' }}>Manual Sync Review</h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>Select one English and one Bangla question, then link them.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={() => {
                if (selectedReviewEngIdx !== null && selectedReviewBnIdx !== null) {
                  reviewMatchBanglaQuestion(selectedReviewEngIdx, selectedReviewBnIdx);
                  setSelectedReviewEngIdx(null);
                  setSelectedReviewBnIdx(null);
                } else {
                  alert('Please select both an English and a Bangla question.');
                }
              }}
              style={{ padding: '10px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              🔗 Link Selected
            </button>
            <button onClick={() => {
              setIsReviewMode(false);
              setUnmatchedBanglaQuestions([]);
            }} style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Exit & Discard Unmatched</button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          <div className="unmatched-english-list">
            <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Unmatched English</span>
              <span style={{ fontSize: '14px', color: '#666' }}>{unmatchedEnglish.length} left</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {unmatchedEnglish.map(({ q, i }) => (
                <div 
                  key={i} 
                  className="review-item" 
                  onClick={() => setSelectedReviewEngIdx(i)}
                  style={{ 
                    padding: '12px', 
                    border: selectedReviewEngIdx === i ? '2px solid #3498db' : '1px solid #ddd', 
                    borderRadius: '6px', 
                    backgroundColor: selectedReviewEngIdx === i ? '#e3f2fd' : 'white', 
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Q{i + 1} - {q.board || 'No Board'}</span>
                    <span style={{ color: '#3498db', fontSize: '11px' }}>ID: {q.id || i}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>{q.questionText || q.question || 'No text'}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="unmatched-bangla-list">
            <h3 style={{ color: '#8e44ad', borderBottom: '2px solid #8e44ad', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Unmatched Bangla</span>
              <span style={{ fontSize: '14px', color: '#666' }}>{unmatchedBangla.length} left</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
              {unmatchedBangla.map((bnQ, bnIdx) => (
                <div 
                  key={bnIdx} 
                  className="review-item" 
                  onClick={() => setSelectedReviewBnIdx(bnIdx)}
                  style={{ 
                    padding: '12px', 
                    border: selectedReviewBnIdx === bnIdx ? '2px solid #8e44ad' : '1px solid #ddd', 
                    borderRadius: '6px', 
                    backgroundColor: selectedReviewBnIdx === bnIdx ? '#f3e5f5' : 'white', 
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>BN {bnIdx + 1} - {bnQ.board || 'No Board'}</span>
                    <span style={{ color: '#8e44ad', fontSize: '11px' }}>ID: {bnQ.id || bnIdx}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', lineHeight: '1.4' }}>{bnQ.questionText || bnQ.question || 'No text'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMatchingView = () => {
    const questionsWithImages = editableQuestions.map((q, idx) => ({
      ...q,
      originalIndex: idx,
      hasImage: q.image || q.imageUrl || q.questionImage || 
                q.answerimage1 || q.answerimage2 || q.answerimage3 || q.answerimage4 || 
                (q.parts && q.parts.some(p => p.answerImage))
    })).filter(q => q.hasImage);

    if (questionsWithImages.length === 0) {
      return (
        <div className="matching-mode-container" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>No English questions with images found.</h2>
          <p>Please upload images to your English questions first.</p>
          <button onClick={() => setIsMatchingMode(false)} style={{ padding: '10px 20px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Return to Preview</button>
        </div>
      );
    }

    const activeEngQ = editableQuestions[matchingIndex];
    const isActiveValid = activeEngQ && (
      activeEngQ.image || activeEngQ.imageUrl || activeEngQ.questionImage || 
      activeEngQ.answerimage1 || activeEngQ.answerimage2 || activeEngQ.answerimage3 || activeEngQ.answerimage4 || 
      (activeEngQ.parts && activeEngQ.parts.some(p => p.answerImage))
    );

    if (!isActiveValid) {
      return (
        <div className="matching-mode-container" style={{ padding: '40px', textAlign: 'center' }}>
          <h2>Please select a question from the left list.</h2>
          <p>Select an English question that has images to start matching.</p>
        </div>
      );
    }

    const candidates = unmatchedBanglaQuestions.filter(bnQ => {
      const qText = (bnQ.questionText || bnQ.question || '').toLowerCase();
      const matchesText = !textSearchText || qText.includes(textSearchText.toLowerCase());
      
      if (showAllBanglaCandidates) {
        const matchesBoard = !boardSearchText || !bnQ.board || bnQ.board.toLowerCase().includes(boardSearchText.toLowerCase());
        return matchesText && matchesBoard;
      } else {
        const matchesBoard = !bnQ.board || !activeEngQ.board || bnQ.board === activeEngQ.board;
        return matchesText && matchesBoard;
      }
    });

    return (
      <div className="matching-mode-container" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 200px)', 
        backgroundColor: '#f0f4f8', 
        borderRadius: '10px', 
        border: '2px solid #3498db', 
        overflow: 'hidden' 
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '15px 20px', 
          backgroundColor: '#fff', 
          borderBottom: '1px solid #ddd' 
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#2c3e50' }}>Image Matching Mode</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              onClick={() => setShowAllBanglaCandidates(!showAllBanglaCandidates)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: showAllBanglaCandidates ? '#27ae60' : '#7f8c8d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showAllBanglaCandidates ? 'Showing All' : 'Filter by Board'}
            </button>
            <button 
              onClick={() => setShowAllBanglaCandidates(!showAllBanglaCandidates)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: showAllBanglaCandidates ? '#27ae60' : '#7f8c8d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {showAllBanglaCandidates ? 'Showing All' : 'Filter by Board'}
            </button>
            {showAllBanglaCandidates && (
              <input 
                type="text" 
                placeholder="Search board..." 
                value={boardSearchText} 
                onChange={(e) => setBoardSearchText(e.target.value)} 
                style={{ 
                  padding: '6px 12px', 
                  fontSize: '12px', 
                  borderRadius: '4px', 
                  border: '1px solid #ddd',
                  width: '150px',
                  marginLeft: '10px'
                }} 
              />
            )}
            <input 
              type="text" 
              placeholder="Search text..." 
              value={textSearchText} 
              onChange={(e) => setTextSearchText(e.target.value)} 
              style={{ 
                padding: '6px 12px', 
                fontSize: '12px', 
                borderRadius: '4px', 
                border: '1px solid #ddd',
                width: '200px',
                marginLeft: '10px'
              }} 
            />
            <button onClick={() => setIsMatchingMode(false)} style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancel Matching</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', flex: 1, overflow: 'hidden' }}>
          <div style={{ 
            borderRight: '1px solid #ddd', 
            display: 'flex', 
            flexDirection: 'column', 
            backgroundColor: '#fff',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd', fontWeight: 'bold', fontSize: '14px' }}>
              English Questions with Images ({questionsWithImages.length})
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {questionsWithImages.map((q) => (
                <div 
                  key={q.originalIndex} 
                  onClick={() => setMatchingIndex(q.originalIndex)}
                  style={{ 
                    padding: '12px', 
                    borderBottom: '1px solid #eee', 
                    cursor: 'pointer', 
                    backgroundColor: matchingIndex === q.originalIndex ? '#e3f2fd' : 'transparent',
                    transition: 'background 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => { if (matchingIndex !== q.originalIndex) e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                  onMouseLeave={(e) => { if (matchingIndex !== q.originalIndex) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Question {q.originalIndex + 1}</span>
                    <span style={{ fontSize: '11px', color: '#666' }}>{q.board || 'N/A'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.questionText || q.question || 'No text'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: '20px', backgroundColor: '#fdfdfd' }}>
            {activeEngQ ? (
              <>
                <div className="english-q-box" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px', border: '1px solid #eee' }}>
                  <strong style={{ color: '#2c3e50', fontSize: '16px' }}>English Question {matchingIndex + 1}</strong>
                  <div style={{ marginTop: '10px', fontSize: '14px', color: '#555' }}>
                    <p><strong>Board:</strong> {activeEngQ.board || 'N/A'}</p>
                    <p><strong>Text:</strong> {activeEngQ.questionText || activeEngQ.question || 'No text'}</p>
                    {activeEngQ.image && (
                      <div style={{ marginTop: '15px' }}>
                        <img src={activeEngQ.image} alt="Stem" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '5px', border: '1px solid #ddd' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="bangla-candidates-box">
                  <strong style={{ color: '#8e44ad', fontSize: '16px', display: 'block', marginBottom: '15px' }}>
                    {showAllBanglaCandidates ? 'All Unmatched Bangla Questions' : `Bangla Candidates for ${activeEngQ.board || 'this board'}`}
                  </strong>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                    {candidates.length > 0 ? candidates.map((bnQ) => {
                      const actualIdx = unmatchedBanglaQuestions.indexOf(bnQ);
                      return (
                        <div key={actualIdx} style={{ 
                          padding: '15px', 
                          border: '1px solid #ddd', 
                          borderRadius: '8px', 
                          backgroundColor: 'white', 
                          cursor: 'pointer', 
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '100px'
                        }}
                        onClick={() => matchBanglaQuestion(actualIdx)}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3498db'; e.currentTarget.style.backgroundColor = '#f8faff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.backgroundColor = 'white'; }}>
                          
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>{bnQ.questionText || bnQ.question || 'No text'}</div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#8e44ad' }}>Board: {bnQ.board || 'N/A'}</span>
                            <span style={{ fontSize: '12px', color: '#3498db', fontWeight: 'bold' }}>Match ✓</span>
                          </div>
                        </div>
                      );
                    }) : <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: '#999', fontStyle: 'italic' }}>No matching Bangla questions found.</div>}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionList = () => {
    console.log('[Debug] renderQuestionList: isMatchingMode=', isMatchingMode, 'isReviewMode=', isReviewMode, 'editableQuestions.length=', editableQuestions.length, 'banglaQuestions.length=', banglaQuestions.length);
    if (isMatchingMode) return renderMatchingView();
    if (isReviewMode) return renderReviewView();
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
                {unmatchedBanglaQuestions.length > 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px', borderTop: '2px dashed #e67e22', marginTop: '20px' }}>
                    <p style={{ color: '#d35400', fontWeight: 'bold', marginBottom: '10px' }}>
                      ⚠️ {unmatchedBanglaQuestions.length} Bangla questions are not yet synced.
                    </p>
                    <button 
                      onClick={() => setIsReviewMode(true)}
                      style={{ padding: '10px 20px', backgroundColor: '#e67e22', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Enter Manual Review Mode
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
  
  const syncImagesToBangla = useCallback((engQ, bnQ) => {
    const newBnQ = { ...bnQ };
    if (engQ.image) newBnQ.image = engQ.image;
    
    if (engQ.parts && newBnQ.parts) {
      // Legacy fields sync
      if (engQ.answerimage1) newBnQ.answerimage1 = engQ.answerimage1;
      if (engQ.answerimage2) newBnQ.answerimage2 = engQ.answerimage2;
      if (engQ.answerimage3) newBnQ.answerimage3 = engQ.answerimage3;
      if (engQ.answerimage4) newBnQ.answerimage4 = engQ.answerimage4;

      newBnQ.parts = newBnQ.parts.map(bnPart => {
        const engPart = engQ.parts?.find(p => p.letter === bnPart.letter);
        if (engPart && engPart.answerImage) {
          return { ...bnPart, answerImage: engPart.answerImage };
        }
        // Fallback to legacy fields
        if (bnPart.letter === 'c' && newBnQ.answerimage1) return { ...bnPart, answerImage: newBnQ.answerimage1 };
        if (bnPart.letter === 'd' && newBnQ.answerimage2) return { ...bnPart, answerImage: newBnQ.answerimage2 };
        if (bnPart.letter === 'a' && newBnQ.answerimage3) return { ...bnPart, answerImage: newBnQ.answerimage3 };
        if (bnPart.letter === 'b' && newBnQ.answerimage4) return { ...bnPart, answerImage: newBnQ.answerimage4 };
        return bnPart;
      });
    }
    
    // Metadata sync
    if (!newBnQ.subject && engQ.subject) newBnQ.subject = engQ.subject;
    if (!newBnQ.chapter && engQ.chapter) newBnQ.chapter = engQ.chapter;
    if (!newBnQ.lesson && engQ.lesson) newBnQ.lesson = engQ.lesson;
    if (!newBnQ.board && engQ.board) newBnQ.board = engQ.board;
 
    return newBnQ;
  }, []);

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

    // Auto-sync to Bangla version only if boards match
    if (listType === 'english' && field === 'answerImage') {
      const enQ = editableQuestionsRef.current?.[qIndex];
      const bnQ = banglaQuestionsRef.current?.[qIndex];
      const boardsDiffer = enQ && bnQ && enQ.board && bnQ.board && enQ.board !== bnQ.board;
      if (boardsDiffer) { console.log(`   -> Skipping Bangla sync: board mismatch (EN: "${enQ.board}" vs BN: "${bnQ.board}")`); } else {
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
          const enQ = editableQuestionsRef.current?.[index];
          const bnQ = banglaQuestionsRef.current?.[index];
          const boardsDiffer = enQ && bnQ && enQ.board && bnQ.board && enQ.board !== bnQ.board;
          if (boardsDiffer) {
            console.log(`   -> Skipping Bangla sync (part_image_remove): board mismatch (EN: "${enQ.board}" vs BN: "${bnQ.board}")`);
          } else {
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
      const enQ = editableQuestionsRef.current?.[index];
      const bnQ = banglaQuestionsRef.current?.[index];
      const boardsDiffer = enQ && bnQ && enQ.board && bnQ.board && enQ.board !== bnQ.board;
      if (boardsDiffer) {
        console.log(`   -> Skipping Bangla sync: board mismatch (EN: "${enQ.board}" vs BN: "${bnQ.board}")`);
      } else {
        console.log(`   -> Auto-syncing image field ${field} to Bangla list`);
        setBanglaQuestions(prev => {
          if (index >= prev.length) return prev;
          const updated = [...prev];
          updated[index] = { ...updated[index], [field]: value };
          return updated;
        });
      }
    }
  }, [updateQuestionPart]);

  const handlePartImageUpload = useCallback((qIndex, partIndex, file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        let imageData = reader.result;
        try {
          imageData = await processImage(imageData);
        } catch (e) {
          console.error('Image processing failed:', e);
        }
        updateQuestionPart(qIndex, partIndex, 'answerImage', imageData);
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

  const handleCropAndAssign = useCallback((qIndex, targetType, partIndex = null, listType = 'english') => {
    if (easySourceMode === 'markdown') {
      const imgUrl = mergedImageUrl || (selectedMdImages.size === 1 ? [...selectedMdImages][0] : null);
      if (!imgUrl) { alert('Select one image (or merge multiple) first.'); return; }
      if (targetType === 'stem') {
        updateQuestion(qIndex, 'image', imgUrl, listType);
      } else if (targetType === 'part' && partIndex !== null) {
        updateQuestionPart(qIndex, partIndex, 'answerImage', imgUrl, listType);
      }
      setMergedImageUrl(null);
      setSelectedMdImages(new Set());
      return;
    }

    if (easySourceMode === 'merger') {
      if (!mergedImageUrl) { alert('Merge images first, then assign.'); return; }
      if (targetType === 'stem') {
        updateQuestion(qIndex, 'image', mergedImageUrl, listType);
      } else if (targetType === 'part' && partIndex !== null) {
        updateQuestionPart(qIndex, partIndex, 'answerImage', mergedImageUrl, listType);
      }
      setMergedImageUrl(null);
      return;
    }

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
    
    // Process image to remove white background and trim
    const dataUrl = canvas.toDataURL('image/png');
    processImage(dataUrl).then(processedUrl => {
      const croppedImageUrl = processedUrl;
      console.log(`📸 handleCropAndAssign: Processed image for Q#${qIndex + 1}, target: ${targetType}${partIndex !== null ? ', part: ' + partIndex : ''}${listType !== 'english' ? ', listType: ' + listType : ''}`);

      if (targetType === 'stem') {
          updateQuestion(qIndex, 'image', croppedImageUrl, listType);
      } else if (targetType === 'part' && partIndex !== null) {
          updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImageUrl, listType);
      }
    }).catch(err => {
      console.error('Error processing cropped image:', err);
      // Fallback to original crop if processing fails
      const croppedImageUrl = dataUrl;
      if (targetType === 'stem') {
          updateQuestion(qIndex, 'image', croppedImageUrl, listType);
      } else if (targetType === 'part' && partIndex !== null) {
          updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImageUrl, listType);
      }
    });
  }, [updateQuestion, updateQuestionPart, easySourceMode, selectedMdImages, mergedImageUrl]);

  console.log('[Performance] QuestionPreview Render Start');
  const prevDeps = useRef({ editableQuestions, handleCropAndAssign, updateQuestion, easyVisibleCount: 20 });

  const [easyVisibleCount, setEasyVisibleCount] = useState(20);
  const [boardSearch, setBoardSearch] = useState('');
  const [textSearch, setTextSearch] = useState('');

  const handleSaveProgress = useCallback(() => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      questions: editableQuestions,
      banglaQuestions: banglaQuestions.length > 0 ? banglaQuestions : undefined
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [editableQuestions, banglaQuestions]);

  const handleLoadProgress = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.questions || !Array.isArray(data.questions)) {
          alert('Invalid progress file: missing questions array.');
          return;
        }
        setEditableQuestions(data.questions);
        if (data.banglaQuestions) setBanglaQuestions(data.banglaQuestions);
        alert(`Loaded ${data.questions.length} questions from progress file.`);
      } catch (err) {
        alert('Failed to load progress file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setEditableQuestions]);

  const memoizedQuestionList = useMemo(() => {
    const changed = [];
    if (prevDeps.current.editableQuestions !== editableQuestions) changed.push('editableQuestions');
    if (prevDeps.current.banglaQuestions !== banglaQuestions) changed.push('banglaQuestions');
    if (prevDeps.current.handleCropAndAssign !== handleCropAndAssign) changed.push('handleCropAndAssign');
    if (prevDeps.current.updateQuestion !== updateQuestion) changed.push('updateQuestion');
    if (prevDeps.current.easyVisibleCount !== easyVisibleCount) changed.push('easyVisibleCount');
    if (prevDeps.current.boardSearch !== boardSearch) changed.push('boardSearch');
    if (prevDeps.current.textSearch !== textSearch) changed.push('textSearch');
    
    console.log('[Performance] Recalculating memoizedQuestionList due to:', changed.join(', '));
    
    prevDeps.current = { editableQuestions, banglaQuestions, handleCropAndAssign, updateQuestion, easyVisibleCount, boardSearch, textSearch };

    const hasBangla = banglaQuestions.length > 0;
    const boardLower = boardSearch.toLowerCase().trim();
    const textLower = textSearch.toLowerCase().trim();

    const filteredQuestions = editableQuestions.filter((q, i) => {
      if (boardLower) {
        const enBoard = q.board && q.board.toLowerCase().includes(boardLower);
        const bnBoard = hasBangla && banglaQuestions[i]?.board && banglaQuestions[i].board.toLowerCase().includes(boardLower);
        if (!enBoard && !bnBoard) return false;
      }
      if (textLower) {
        const enText = (q.questionText || q.question || q.stem || '').toLowerCase();
        if (!enText.includes(textLower)) return false;
      }
      return true;
    });
    const displayList = filteredQuestions.slice(0, easyVisibleCount).map(q => ({
      question: q,
      originalIndex: editableQuestions.indexOf(q)
    }));
    const hasMore = filteredQuestions.length > easyVisibleCount;

    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
            {displayList.map(({ question: q, originalIndex }) =>
              hasBangla && banglaQuestions[originalIndex] ? (
                <CompactQuestionPair
                  key={`pair-${originalIndex}`}
                  enQuestion={q}
                  bnQuestion={banglaQuestions[originalIndex]}
                  index={originalIndex}
                  onCropAndAssign={handleCropAndAssign}
                  onUpdate={updateQuestion}
                />
              ) : (
                <CompactQuestionItem
                  key={originalIndex}
                  question={q}
                  index={originalIndex}
                  onCropAndAssign={handleCropAndAssign}
                  onUpdate={updateQuestion}
                />
              )
            )}
        </div>
        {hasMore && (
            <div style={{ textAlign: 'center', padding: '10px' }}>
                <button
                    type="button"
                    onClick={() => setEasyVisibleCount(prev => prev + 20)}
                    style={{ padding: '8px 20px', backgroundColor: '#3498db', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                    Load More ({filteredQuestions.length - easyVisibleCount} remaining)
                </button>
            </div>
        )}
    </div>
  )}, [editableQuestions, banglaQuestions, handleCropAndAssign, updateQuestion, easyVisibleCount, boardSearch, textSearch]);

   const removeQuestion = useCallback((index) => {
     if (window.confirm(`Remove question #${index + 1} from the list?`)) {
       setEditableQuestions(prev => prev.filter((_, i) => i !== index));
       setBanglaQuestions(prev => prev.filter((_, i) => i !== index));
     }
   }, [setBanglaQuestions, setEditableQuestions]);

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
      reader.onloadend = async () => {
        let imageData = reader.result;
        try {
          imageData = await processImage(imageData);
        } catch (e) {
          console.error('Image processing failed:', e);
        }
        updateQuestion(index, 'image', imageData);
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
    
    // Process image to remove white background and trim
    const dataUrl = canvas.toDataURL('image/png');
    processImage(dataUrl).then(processedUrl => {
      const croppedImageUrl = processedUrl;

      if (typeof currentCroppingIndex === 'object' && currentCroppingIndex !== null && currentCroppingIndex.type === 'part') {
        const { qIndex, partIndex } = currentCroppingIndex;
        updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImageUrl);
      } else {
        updateQuestion(currentCroppingIndex, 'image', croppedImageUrl);
      }

      setShowCropper(false);
      setCurrentCroppingIndex(null);
    }).catch(err => {
      console.error('Error processing cropped image:', err);
      // Fallback
      const croppedImageUrl = dataUrl;
      if (typeof currentCroppingIndex === 'object' && currentCroppingIndex !== null && currentCroppingIndex.type === 'part') {
        const { qIndex, partIndex } = currentCroppingIndex;
        updateQuestionPart(qIndex, partIndex, 'answerImage', croppedImageUrl);
      } else {
        updateQuestion(currentCroppingIndex, 'image', croppedImageUrl);
      }
      setShowCropper(false);
      setCurrentCroppingIndex(null);
    });
  };
  
  const handleMouseDown = (e) => {
    if (e.target.className === 'crop-handle') return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    isDraggingRef.current = true;
    dragStartRef.current = { x: x - cropAreaRef.current.x, y: y - cropAreaRef.current.y };
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

  const handleBanglaUpload = (content) => {
    const text = (typeof content === 'string' ? content : banglaInputText).trim();
    if (!text) {
      alert('Please enter some Bangla questions.');
      return;
    }
 
    try {
      const isMCQ = editableQuestions.some(q => q.type === 'mcq');
      const parsedBanglaQuestions = isMCQ ? parseMCQQuestions(text) : parseCQQuestions(text, 'bn');
      
      if (parsedBanglaQuestions.length === 0) {
        alert('❌ No questions could be parsed. Please check the format.');
        return;
      }
 
      setUnmatchedBanglaQuestions(parsedBanglaQuestions);
       setIsMatchingMode(true);
       const firstWithImageIdx = editableQuestions.findIndex(q => 
         q.image || q.imageUrl || q.questionImage || 
         q.answerimage1 || q.answerimage2 || q.answerimage3 || q.answerimage4 || 
         (q.parts && q.parts.some(p => p.answerImage))
       );
       setMatchingIndex(firstWithImageIdx !== -1 ? firstWithImageIdx : 0);
      setBanglaInputText('');
      setShowBanglaUpload(false);
      alert(`✅ Parsed ${parsedBanglaQuestions.length} Bangla questions. Entering Matching Mode to sync images.`);
      
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
          <button type="button" onClick={() => removeQuestion(index)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>✕ Remove</button>
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
          <button type="button" onClick={() => removeQuestion(index)} style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>✕ Remove</button>
        </div>
      </div>
      {(() => {
        const missingLatexFields = [];
        if (hasMissingLatex(question.questionText)) missingLatexFields.push('Stem');
        if (question.parts) {
          question.parts.forEach((p, i) => {
            if (hasMissingLatex(p.text)) missingLatexFields.push(`Part ${p.letter} text`);
            if (hasMissingLatex(p.answer)) missingLatexFields.push(`Part ${p.letter} answer`);
          });
        }
        if (missingLatexFields.length > 0) {
          return (
            <div style={{ margin: '8px 0', padding: '8px 12px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: 6, fontSize: 12, color: '#856404' }}>
              <strong>⚠️ Missing LaTeX formatting in:</strong> {missingLatexFields.join(', ')}<br />
              <span style={{ fontSize: 11 }}>Math expressions like <code>a^2b + abc</code> should be wrapped in <code>\(...\)</code> or <code>$$...$$</code>.</span>
            </div>
          );
        }
        return null;
      })()}
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

  const renderMarkdownContent = () => {
    if (!mdInput.trim()) return null;
    const html = renderMarkdownHTML(mdInput);
    return (
      <div
        ref={mdContainerRef}
        onClick={(e) => {
          const img = e.target.closest('img');
          if (!img) return;
          setSelectedMdImages(prev => {
            const next = new Set(prev);
            if (next.has(img.src)) next.delete(img.src);
            else next.add(img.src);
            return next;
          });
          setMergedImageUrl(null);
        }}
        dangerouslySetInnerHTML={{ __html: html }}
        className="md-rendered-content"
      />
    );
  };

  if (isEasyImageMode) {
      return (
        <div className="preview-modal-overlay">
          <div className="preview-modal" style={{ width: '95vw', maxWidth: '95vw', height: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
             {/* Header with Merged Controls */}
             <div style={{ padding: '10px 15px', borderBottom: '1px solid #ddd', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', gap: '10px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{margin: 0, fontSize: '1.1rem', whiteSpace: 'nowrap'}}>
                        {easySourceMode === 'merger' ? '🗃️ Image Merger' : easySourceMode === 'markdown' ? '📝 Markdown Assign' : '📷 Easy Upload'}
                    </h2>
                     {easySourceMode === 'cropper' ? (
                       <span style={{ 
                           fontSize: '12px', 
                           backgroundColor: '#e3f2fd', 
                           color: '#1976d2', 
                           padding: '4px 10px', 
                           borderRadius: '12px',
                           fontWeight: '600',
                           border: '1px solid #90caf9'
                       }}>
                           ✨ Auto-Cut White Parts Active
                       </span>
                      ) : easySourceMode === 'merger' ? (
                        <span style={{ 
                            fontSize: '12px', 
                            backgroundColor: '#eafaf1', 
                            color: '#27ae60', 
                            padding: '4px 10px', 
                            borderRadius: '12px',
                            fontWeight: '600',
                            border: '1px solid #a9dfbf'
                        }}>
                          {mergedImageUrl ? '🖼️ Merged' : mergerImages.length > 0 ? `📎 ${mergerImages.length} Files` : '🗂️ Drop Images'}
                        </span>
                      ) : (
                        <span style={{ 
                            fontSize: '12px', 
                            backgroundColor: '#f3e5f5', 
                            color: '#7b1fa2', 
                            padding: '4px 10px', 
                            borderRadius: '12px',
                            fontWeight: '600',
                            border: '1px solid #ce93d8'
                        }}>
                          {mergedImageUrl ? '🖼️ Merged' : selectedMdImages.size > 0 ? `🔵 ${selectedMdImages.size} Selected` : '⚪ Click Images'}
                        </span>
                     )}
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
                 {/* Left Side: Cropper / Markdown */}
                 <div className="easy-mode-cropper-section" style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Source Mode Tabs */}
                    <div style={{ display: 'flex', borderBottom: '2px solid #ddd', marginBottom: '6px', flexShrink: 0 }}>
                      <button onClick={() => setEasySourceMode('cropper')}
                        style={{
                          flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                          backgroundColor: easySourceMode === 'cropper' ? '#3498db' : '#ecf0f1',
                          color: easySourceMode === 'cropper' ? 'white' : '#555',
                          borderTopLeftRadius: '4px', borderTopRightRadius: '4px'
                        }}>
                        🖼️ Cropper
                      </button>
                      <button onClick={() => setEasySourceMode('markdown')}
                        style={{
                          flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                          backgroundColor: easySourceMode === 'markdown' ? '#8e44ad' : '#ecf0f1',
                          color: easySourceMode === 'markdown' ? 'white' : '#555',
                          borderTopLeftRadius: '4px', borderTopRightRadius: '4px'
                        }}>
                        📝 Markdown
                      </button>
                      <button onClick={() => setEasySourceMode('merger')}
                        style={{
                          flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                          backgroundColor: easySourceMode === 'merger' ? '#27ae60' : '#ecf0f1',
                          color: easySourceMode === 'merger' ? 'white' : '#555',
                          borderTopLeftRadius: '4px', borderTopRightRadius: '4px'
                        }}>
                        🗃️ Merger
                      </button>
                    </div>

                    {easySourceMode === 'cropper' ? (
                      !sourceDocument ? (
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
                      )
                    ) : easySourceMode === 'merger' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
                            if (files.length === 0) return;
                            setMergerImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name }))]);
                            setMergedImageUrl(null);
                          }}
                          style={{
                            flex: mergerImages.length === 0 ? 1 : '0 0 auto',
                            minHeight: mergerImages.length === 0 ? '120px' : '60px',
                            border: '2px dashed #27ae60',
                            borderRadius: '8px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', backgroundColor: '#eafaf1', color: '#27ae60',
                            fontSize: '14px', fontWeight: 600, marginBottom: '6px',
                            transition: 'background-color 0.2s'
                          }}
                          onClick={() => document.getElementById('merger-file-input').click()}
                          onDragOverCapture={e => e.currentTarget.style.backgroundColor = '#d5f5e3'}
                          onDragLeaveCapture={e => e.currentTarget.style.backgroundColor = '#eafaf1'}
                        >
                          {mergerImages.length === 0
                            ? '🗂️ Drop images here or click to select'
                            : `📎 ${mergerImages.length} image${mergerImages.length > 1 ? 's' : ''} added (drop more)`}
                        </div>
                        <input
                          id="merger-file-input"
                          type="file"
                          accept="image/*"
                          multiple
                          style={{ display: 'none' }}
                          onChange={e => {
                            const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
                            if (files.length === 0) return;
                            setMergerImages(prev => [...prev, ...files.map(f => ({ file: f, url: URL.createObjectURL(f), name: f.name }))]);
                            setMergedImageUrl(null);
                          }}
                        />
                        {mergerImages.length > 0 && (
                          <>
                            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', flexShrink: 0, padding: '4px 0', minHeight: '50px' }}>
                              {mergerImages.map((img, i) => (
                                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                                  <img src={img.url} alt={img.name}
                                    style={{ height: '48px', width: '48px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ccc' }}
                                  />
                                  <button
                                    onClick={() => {
                                      URL.revokeObjectURL(img.url);
                                      setMergerImages(prev => prev.filter((_, j) => j !== i));
                                    }}
                                    style={{
                                      position: 'absolute', top: '-4px', right: '-4px',
                                      width: '16px', height: '16px', fontSize: '10px',
                                      backgroundColor: '#e74c3c', color: 'white', border: 'none',
                                      borderRadius: '50%', cursor: 'pointer', lineHeight: '16px',
                                      padding: 0
                                    }}
                                  >✕</button>
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', margin: '4px 0', flexShrink: 0 }}>
                              <button onClick={async () => {
                                if (mergerImages.length < 2) { alert('Drop at least 2 images to merge.'); return; }
                                try {
                                  const loaded = await Promise.all(mergerImages.map(({ url }) => new Promise((resolve, reject) => {
                                    const img = new Image();
                                    img.onload = () => resolve(img);
                                    img.onerror = reject;
                                    img.src = url;
                                  })));
                                  const maxWidth = Math.max(...loaded.map(img => img.width));
                                  const totalHeight = loaded.reduce((sum, img) => sum + img.height, 0);
                                  const canvas = document.createElement('canvas');
                                  canvas.width = maxWidth;
                                  canvas.height = totalHeight;
                                  const ctx = canvas.getContext('2d');
                                  let y = 0;
                                  for (const img of loaded) {
                                    ctx.drawImage(img, Math.floor((maxWidth - img.width) / 2), y);
                                    y += img.height;
                                  }
                                  setMergedImageUrl(canvas.toDataURL('image/png'));
                                } catch (err) {
                                  console.error('Merge failed:', err);
                                  alert('Failed to merge images.');
                                }
                              }} style={{
                                fontSize: '11px', padding: '4px 10px', backgroundColor: '#27ae60',
                                color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'
                              }}>
                                🖇️ Merge {mergerImages.length} Images
                              </button>
                              <button onClick={() => {
                                mergerImages.forEach(({ url }) => URL.revokeObjectURL(url));
                                setMergerImages([]);
                                setMergedImageUrl(null);
                              }} style={{
                                fontSize: '11px', padding: '4px 10px', backgroundColor: '#7f8c8d',
                                color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'
                              }}>
                                ✕ Clear
                              </button>
                            </div>
                            {mergedImageUrl && (
                              <div style={{
                                textAlign: 'center', margin: '4px 0', padding: '6px',
                                border: '2px solid #27ae60', borderRadius: '6px', backgroundColor: '#eafaf1',
                                flexShrink: 0
                              }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#27ae60', marginBottom: '4px' }}>
                                  🖼️ Merged Image (click a slot to assign)
                                </div>
                                <img src={mergedImageUrl} alt="Merged" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '4px' }} />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <textarea
                          value={mdInput}
                          onChange={e => setMdInput(e.target.value)}
                          placeholder="Paste markdown content with images here..."
                          style={{
                            width: '100%', minHeight: '60px', maxHeight: '80px',
                            padding: '6px 8px', fontSize: '13px', fontFamily: 'monospace',
                            border: '1px solid #ccc', borderRadius: '4px',
                            resize: 'vertical', boxSizing: 'border-box', flexShrink: 0
                          }}
                        />
                        {(selectedMdImages.size > 0 || mergedImageUrl) && (
                          <div style={{ display: 'flex', gap: '6px', margin: '4px 0', flexShrink: 0 }}>
                            {selectedMdImages.size >= 2 && (
                              <button onClick={handleMergeImages} style={{
                                fontSize: '11px', padding: '4px 10px', backgroundColor: '#8e44ad',
                                color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'
                              }}>
                                🖇️ Merge {selectedMdImages.size} Images
                              </button>
                            )}
                            <button onClick={() => { setSelectedMdImages(new Set()); setMergedImageUrl(null); }} style={{
                              fontSize: '11px', padding: '4px 10px', backgroundColor: '#7f8c8d',
                              color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer'
                            }}>
                              ✕ Clear Selection
                            </button>
                          </div>
                        )}
                        {mergedImageUrl && (
                          <div style={{
                            textAlign: 'center', margin: '4px 0', padding: '6px',
                            border: '2px solid #8e44ad', borderRadius: '6px', backgroundColor: '#faf5ff',
                            flexShrink: 0
                          }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#8e44ad', marginBottom: '4px' }}>
                              🖼️ Merged Image (click a slot to assign)
                            </div>
                            <img src={mergedImageUrl} alt="Merged" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '4px' }} />
                          </div>
                        )}
                        <div style={{ flex: 1, overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '8px', backgroundColor: '#fafafa' }}>
                          {mdInput.trim() ? renderMarkdownContent() : (
                            <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
                              Paste markdown above to see rendered images
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                 </div>

                {/* Right Side: Question List */}
                <div className="easy-mode-list-section" style={{ minWidth: '300px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{marginBottom: '10px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', flexWrap: 'wrap'}}>
                          <h3 style={{ margin: 0, color: '#2c3e50' }}>Questions List</h3>
                          <div style={{display: 'flex', gap: '5px'}}>
                            <button onClick={handleSaveProgress} title="Save progress (download JSON)"
                              style={{fontSize: '11px', padding: '4px 8px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap'}}>
                              💾 Save
                            </button>
                            <button onClick={() => loadFileInputRef.current?.click()} title="Load progress from JSON file"
                              style={{fontSize: '11px', padding: '4px 8px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap'}}>
                              📂 Load
                            </button>
                            <input ref={loadFileInputRef} type="file" accept=".json" style={{display: 'none'}} onChange={handleLoadProgress} />
                          </div>
                        </div>
                        <p style={{fontSize: '12px', color: '#7f8c8d', margin: '5px 0 0 0'}}>
                          {easySourceMode === 'merger'
                            ? 'Drop images into the merger tab, click "Merge", then click a slot button below to assign.'
                            : easySourceMode === 'markdown'
                            ? 'Click an image in the markdown panel, then click a button below to assign it.'
                            : 'Align the crop box on the left, then click the corresponding button below to assign the image.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Search by board..."
                        value={boardSearch}
                        onChange={e => { setBoardSearch(e.target.value); setEasyVisibleCount(20); }}
                        style={{
                          flex: 1, padding: '8px 10px',
                          border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search EN text..."
                        value={textSearch}
                        onChange={e => { setTextSearch(e.target.value); setEasyVisibleCount(20); }}
                        style={{
                          flex: 1, padding: '8px 10px',
                          border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px',
                          boxSizing: 'border-box'
                        }}
                      />
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
                    setEasySourceMode('cropper');
                    setSelectedMdImages(new Set());
                    setMergedImageUrl(null);
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
                onClick={() => {
                    if (bnContent) {
                        handleBanglaUpload(bnContent);
                    } else {
                        setShowBanglaUpload(true);
                    }
                }}
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
              onClick={() => {
                const allQuestions = [...editableQuestions, ...banglaQuestions, ...unmatchedBanglaQuestions].filter(q => q && q.type);
                const errors = [];
                allQuestions.forEach((q, i) => {
                  if (q.type === 'cq') {
                    if (!q.questionText || !q.questionText.trim()) {
                      errors.push(`Question ${i + 1} (CQ): Question stem is empty`);
                    }
                    if (!q.parts || q.parts.length === 0) {
                      errors.push(`Question ${i + 1} (CQ): No parts found`);
                    } else {
                      q.parts.forEach((part, pIdx) => {
                        if (!part.text || !part.text.trim()) {
                          errors.push(`Question ${i + 1} (CQ) - Part ${part.letter || pIdx + 1}: Part question text is empty`);
                        }
                        if (!part.answer || !part.answer.trim()) {
                          errors.push(`Question ${i + 1} (CQ) - Part ${part.letter || pIdx + 1}: Answer is empty`);
                        }
                      });
                    }
                  }
                });
                if (errors.length > 0) {
                  alert('❌ Cannot upload - some questions have missing data:\n\n' + errors.join('\n') + '\n\nPlease fix them in the editor above before confirming.');
                  return;
                }
                onConfirm(allQuestions);
              }}
              disabled={isUploading}
              style={{ opacity: isUploading ? 0.7 : 1, cursor: isUploading ? 'not-allowed' : 'pointer' }}
            >
              {isUploading ? 'Uploading...' : (isEditMode ? 'Save Changes' : `Confirm & Add ${editableQuestions.length + banglaQuestions.filter(Boolean).length + unmatchedBanglaQuestions.length} Questions`)}
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
