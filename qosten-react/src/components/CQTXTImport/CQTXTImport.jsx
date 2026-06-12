import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestions } from '../../context/QuestionContext';
import QuestionPreview from '../QuestionPreview/QuestionPreview';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const ACCENT = '#e17055';
const imagePartMapping = {
  'question': 'image',
  'a': 'answerimage3',
  'b': 'answerimage4',
  'c': 'answerimage1',
  'd': 'answerimage2'
};
const partLetterIndex = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
const colOptions = [
  { value: 'question', label: 'Stem' },
  { value: 'a', label: 'Part A' },
  { value: 'b', label: 'Part B' },
  { value: 'c', label: 'Part C' },
  { value: 'd', label: 'Part D' }
];

/**
 * Validate parsed CQ questions and log missing/lacking fields.
 * @returns {{ valid: number, total: number, issues: Array }} Summary
 */
function validateCQQuestions(questions, label = '') {
  const prefix = label ? `[${label}] ` : '';
  console.log(`\n${prefix}🔍 VALIDATION REPORT (${questions.length} questions):`);
  let totalIssues = 0;
  const issueDetails = [];

  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const issues = [];

    if (!q.questionText || !q.questionText.trim()) issues.push('missing stem');
    if (!q.subject) issues.push('missing subject');
    if (!q.chapter || q.chapter === 'Skipped') issues.push('missing chapter');
    if (!q.board) issues.push('missing board');

    for (const p of q.parts) {
      if (!p.text || !p.text.trim()) issues.push(`part ${p.letter}: empty text`);
      if (!p.answer || !p.answer.trim()) issues.push(`part ${p.letter}: empty answer`);
    }

    if (issues.length > 0) {
      totalIssues++;
      const detail = `Q${qi + 1} (board: ${q.board || 'N/A'}): ${issues.join(', ')}`;
      issueDetails.push(detail);
      console.log(`  ${prefix}⚠️ ${detail}`);
    }
  }

  if (totalIssues === 0) {
    console.log(`  ${prefix}✅ All questions passed validation.`);
  } else {
    console.log(`  ${prefix}⚠️ ${totalIssues}/${questions.length} questions have issues.`);
  }

  return { valid: questions.length - totalIssues, total: questions.length, issues: issueDetails };
}

function parseAnswers(text) {
  const result = [];
  const lines = text.split('\n');
  let inAnswers = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^\$1$/.test(t)) { inAnswers = true; continue; }
    if (inAnswers) {
      if (/^Question\s+\d+/i.test(t)) break;
      result.push(t);
    }
  }
  const parts = {};
  for (const line of result) {
    const m = line.match(/^([A-Da-d])[.)]\s*(.+)/);
    if (m) parts[m[1].toLowerCase()] = m[2];
    else if (Object.keys(parts).length > 0) {
      const last = Object.keys(parts).pop();
      parts[last] += '\n' + line;
    }
  }
  return parts;
}

function parseTXTQuestions(text) {
  const sections = text.split(/(?=Question\s+\d+[:.]?\s*)/i).filter(s => s.trim());
  const questions = [];
  for (const section of sections) {
    if (!section.trim()) continue;
    const q = { type: 'cq', language: 'en', questionText: '', subject: '', chapter: '', lesson: '', board: '', image: null, parts: [], imageRefs: [], answers: {} };
    const lines = section.split('\n').map(l => l.trim()).filter(l => l);
    
    let inStem = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^Question\s+\d+/i.test(line)) continue;
      const mm = line.match(/^\[(Subject|Chapter|Lesson|Board|Topic)\s*:\s*(.*?)\]$/i);
      if (mm) { q[mm[1].toLowerCase()] = mm[2].trim(); continue; }
      const im = line.match(/^\[(.+?)\s+Image\s*:\s*(.+?)\]$/i);
      if (im) { q.imageRefs.push({ label: im[1].trim(), filename: im[2].trim().split('/').pop() }); continue; }
      if (/^Stem\s*[:ঃ]/i.test(line)) { 
        q.questionText = line.replace(/^Stem\s*[:ঃ]\s*/i, '').trim(); 
        inStem = true; 
        continue; 
      }
      if (/^\$1$/.test(line)) { inStem = false; break; }
      const pm = line.match(/^([A-Da-d])[.)]\s*(.+?)(?:\s*\((\d+)\))?\s*$/);
      if (pm) { 
        inStem = false;
        const letter = pm[1].toLowerCase();
        const text = pm[2].trim();
        const marks = pm[3] ? parseInt(pm[3]) : 0;
        q.parts.push({ letter, text, marks, answer: '' });
        continue; 
      }
      if (inStem) {
        q.questionText += '\n' + line;
      } else if (!q.questionText) {
        q.questionText = line;
        inStem = true;
      }
    }
    q.answers = parseAnswers(section);
    for (const p of q.parts) if (q.answers[p.letter]) p.answer = q.answers[p.letter];
    if (q.parts.length > 0 && (q.board || q.subject)) questions.push(q);
  }
  return questions;
}

function loadImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result); reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function readAllEntries(reader) {
  const all = [];
  let batch;
  while ((batch = await new Promise((resolve) => reader.readEntries(resolve))).length > 0) all.push(...batch);
  return all;
}

async function readDroppedFolder(items) {
  const files = [];
  const entries = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
  }
  async function traverseDir(entry) {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const childEntries = await readAllEntries(reader);
      for (const child of childEntries) await traverseDir(child);
    }
  }
  for (const entry of entries) await traverseDir(entry);
  const map = new Map();
  for (const file of files) if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)) map.set(file.name.toLowerCase(), file);
  return map;
}

function mergeImagesBase64(base64Array) {
  return new Promise((resolve, reject) => {
    const imgs = [];
    let loaded = 0;
    const total = base64Array.length;

    base64Array.forEach((src, idx) => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === total) {
          const gap = 4;
          const totalW = imgs.reduce((s, img) => s + img.width, 0) + gap * (imgs.length - 1);
          const maxH = Math.max(...imgs.map(img => img.height));
          const canvas = document.createElement('canvas');
          canvas.width = totalW; canvas.height = maxH;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, totalW, maxH);
          let x = 0;
          for (const img of imgs) { ctx.drawImage(img, x, 0, img.width, img.height); x += img.width + gap; }
          resolve(canvas.toDataURL('image/png'));
        }
      };
      img.onerror = () => reject(new Error(`Failed to load image at index ${idx}`));
      img.src = src;
      imgs[idx] = img;
    });
  });
}

function ImageMergeModal({ images, onMerge, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const toggle = (idx) => { const next = new Set(selected); if (next.has(idx)) next.delete(idx); else next.add(idx); setSelected(next); };
  const handleMerge = async () => {
    if (selected.size < 2) return;
    const sorted = [...selected].sort((a, b) => a - b);
    try {
      const merged = await mergeImagesBase64(sorted.map(i => images[i].data));
      onMerge(merged, sorted);
    } catch (err) {
      alert('Error merging images: ' + err.message);
    }
  };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10001 }}>
      <div style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, maxWidth: 700, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Merge Images</h3>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px 0' }}>Select 2+ images to merge side by side into one.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 15 }}>
          {images.map((img, i) => (
            <div key={i} onClick={() => toggle(i)} style={{ border: `3px solid ${selected.has(i) ? ACCENT : '#ddd'}`, borderRadius: 8, padding: 4, cursor: 'pointer', backgroundColor: selected.has(i) ? '#fff5f0' : '#fff' }}>
              <img src={img.data} alt={img.label} style={{ maxHeight: 120, maxWidth: 160, display: 'block' }} />
              <div style={{ fontSize: 11, textAlign: 'center', marginTop: 4, color: '#888' }}>{img.label} {selected.has(i) ? '✓' : ''}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={handleMerge} disabled={selected.size < 2} style={{ backgroundColor: ACCENT, color: 'white', fontWeight: 'bold' }}>Merge {selected.size} Image{selected.size > 1 ? 's' : ''}</button>
          <button className="danger" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function CQTXTImport() {
  const { batchAddQuestions, bulkAddQuestions } = useQuestions();
  const navigate = useNavigate();

  const [txtFileName, setTxtFileName] = useState('');
  const [txtContent, setTxtContent] = useState(null);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [imageMap, setImageMap] = useState(new Map());
  const [imageFolderName, setImageFolderName] = useState('');
  const [imageFileCount, setImageFileCount] = useState(0);
  const [resolvedQuestions, setResolvedQuestions] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [folderDragOver, setFolderDragOver] = useState(false);
  const [expandedSet, setExpandedSet] = useState(new Set());
  const [mergeModal, setMergeModal] = useState(null);
  const [removedSet, setRemovedSet] = useState(new Map());
  const [mergeHistory, setMergeHistory] = useState(new Map());
  const [columnOverrides, setColumnOverrides] = useState(new Map());
  const [dupReport, setDupReport] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // PDF state
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [pdfPageImages, setPdfPageImages] = useState({});
  const [showPdf, setShowPdf] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const [compiledDragOver, setCompiledDragOver] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOverQi, setDragOverQi] = useState(null);
  const [bnContent, setBnContent] = useState(null);
  const pdfDocRef = useRef(null);

  const txtInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  const applyColumn = useCallback((rq, refLabel, base64, targetCol) => {
    const col = imagePartMapping[targetCol];
    if (col === 'image') rq.image = base64;
    else if (col) {
      rq[col] = base64;
      const partIdx = partLetterIndex[targetCol];
      if (partIdx !== undefined && rq.parts[partIdx]) { rq.parts[partIdx].answerImage = base64; rq.parts[partIdx].image = base64; }
    }
  }, []);

  const handleTXTFile = useCallback(async (file) => {
    if (!file) return;
    setTxtFileName(file.name);
    setResolvedQuestions(null);
    setExpandedSet(new Set());
    setRemovedSet(new Map());
    setMergeHistory(new Map());
    setColumnOverrides(new Map());
    setDupReport(null);
    setShowPreview(false);
    const text = await file.text();
    const qs = parseTXTQuestions(text);
    validateCQQuestions(qs, 'TXT Import');
    setTxtContent(text);
    setParsedQuestions(qs);
    setExpandedSet(new Set(qs.map((_, i) => i)));
  }, []);

  const convertPdfPageToImage = useCallback(async (pdfDocument, pageNumber) => {
    try {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement('canvas');
      canvas.height = viewport.height; canvas.width = viewport.width;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      return new Promise((resolve) => canvas.toBlob((blob) => resolve(URL.createObjectURL(blob)), 'image/jpeg', 0.7));
    } catch { return null; }
  }, []);

  const handlePDFFile = useCallback(async (file) => {
    if (!file) return;
    setPdfFileName(file.name);
    setIsPdfLoading(true);
    setShowPdf(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const uint8Array = new Uint8Array(reader.result);
        const pdf = await pdfjsLib.getDocument({ data: uint8Array.slice() }).promise;
        pdfDocRef.current = pdf;
        setPdfDoc(pdf);
        const pages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
        setPdfPages(pages);
        const images = {};
        for (const p of pages) images[p] = await convertPdfPageToImage(pdf, p);
        setPdfPageImages(images);
        setIsPdfLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('PDF load error:', err);
      setIsPdfLoading(false);
    }
  }, [convertPdfPageToImage]);

  const loadImagesForQuestions = useCallback(async () => {
    if (!parsedQuestions.length || !imageMap.size) {
      alert('Please load both a TXT file and an image folder first.');
      return;
    }

    const fileRefMap = new Map();
    for (let qi = 0; qi < parsedQuestions.length; qi++) {
      for (const ref of parsedQuestions[qi].imageRefs) {
        const fname = ref.filename.toLowerCase();
        if (!fileRefMap.has(fname)) fileRefMap.set(fname, []);
        fileRefMap.get(fname).push({ qi, label: ref.label });
      }
    }
    const dups = [];
    for (const [fname, refs] of fileRefMap) if (refs.length > 1) dups.push({ filename: fname, refs, keepIdx: refs[0].qi });

    const assignedFilenames = new Set();
    const autoRemoved = new Map();
    const resolved = [];

    for (let qi = 0; qi < parsedQuestions.length; qi++) {
      const q = parsedQuestions[qi];
      const rq = {
        ...q, image: null, answerimage1: null, answerimage2: null, answerimage3: null, answerimage4: null,
        parts: q.parts.map(p => ({ ...p, answerImage: null, image: null })), _loadedImages: {}
      };
      for (const ref of q.imageRefs) {
        const fname = ref.filename.toLowerCase();
        const file = imageMap.get(fname);
        if (!file) continue;
        if (assignedFilenames.has(fname)) {
          if (!autoRemoved.has(qi)) autoRemoved.set(qi, []);
          autoRemoved.get(qi).push({ label: ref.label, filename: ref.filename, reason: 'duplicate of earlier Q' });
          continue;
        }
        assignedFilenames.add(fname);
        const base64 = await loadImageFile(file);
        if (!base64) continue;
        rq._loadedImages[ref.label] = base64;
        applyColumn(rq, ref.label, base64, ref.label.toLowerCase().replace(/\d+$/, '').trim());
      }
      resolved.push(rq);
    }

    setResolvedQuestions(resolved);
    setRemovedSet(new Map());
    setColumnOverrides(new Map());
    setDupReport({ dups, autoRemoved: autoRemoved.size > 0 ? autoRemoved : null });
  }, [parsedQuestions, imageMap, applyColumn]);

  const resolveImagesInline = useCallback(async (questions, imgMap) => {
    const fileRefMap = new Map();
    for (let qi = 0; qi < questions.length; qi++) {
      for (const ref of questions[qi].imageRefs) {
        const fname = ref.filename.toLowerCase();
        if (!fileRefMap.has(fname)) fileRefMap.set(fname, []);
        fileRefMap.get(fname).push({ qi, label: ref.label });
      }
    }
    const dups = [];
    for (const [fname, refs] of fileRefMap) if (refs.length > 1) dups.push({ filename: fname, refs, keepIdx: refs[0].qi });

    const assignedFilenames = new Set();
    const autoRemoved = new Map();
    const resolved = [];

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      const rq = {
        ...q, image: null, answerimage1: null, answerimage2: null, answerimage3: null, answerimage4: null,
        parts: q.parts.map(p => ({ ...p, answerImage: null, image: null })), _loadedImages: {}
      };
      for (const ref of q.imageRefs) {
        const fname = ref.filename.toLowerCase();
        const file = imgMap.get(fname);
        if (!file) continue;
        if (assignedFilenames.has(fname)) {
          if (!autoRemoved.has(qi)) autoRemoved.set(qi, []);
          autoRemoved.get(qi).push({ label: ref.label, filename: ref.filename, reason: 'duplicate of earlier Q' });
          continue;
        }
        assignedFilenames.add(fname);
        const base64 = await loadImageFile(file);
        if (!base64) continue;
        rq._loadedImages[ref.label] = base64;
        const targetCol = ref.label.toLowerCase().replace(/\d+$/, '').trim();
        const col = imagePartMapping[targetCol];
        if (col === 'image') rq.image = base64;
        else if (col) {
          rq[col] = base64;
          const partIdx = partLetterIndex[targetCol];
          if (partIdx !== undefined && rq.parts[partIdx]) { rq.parts[partIdx].answerImage = base64; rq.parts[partIdx].image = base64; }
        }
      }
      resolved.push(rq);
    }
    return { resolved, dupReport: { dups, autoRemoved: autoRemoved.size > 0 ? autoRemoved : null } };
  }, []);

  const handleCompiledFolder = useCallback(async (items) => {
    const allFiles = [];
    const entries = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) entries.push(entry);
    }
    async function traverseDir(entry) {
      if (entry.isFile) {
        const file = await new Promise((resolve) => entry.file(resolve));
        allFiles.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const batch = await readAllEntries(reader);
        for (const child of batch) await traverseDir(child);
      }
    }
    for (const entry of entries) await traverseDir(entry);

    // Categorize files
    let txtFile = null, bnFile = null, pdfFile = null;
    const imgFiles = [];
    for (const f of allFiles) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('_bn.txt')) { bnFile = f; }
      else if (lower.endsWith('.txt')) { txtFile = f; }
      else if (lower.endsWith('.pdf')) { pdfFile = f; }
      else if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(lower)) { imgFiles.push(f); }
    }

    if (!txtFile) { alert('No TXT file found in the compiled folder.'); return; }

    // Read TXT
    const text = await txtFile.text();
    const questions = parseTXTQuestions(text);
    validateCQQuestions(questions, 'Compiled Folder');

    // Read BN TXT (optional)
    if (bnFile) {
      const bnText = await bnFile.text();
      setBnContent(bnText);
    } else {
      setBnContent(null);
    }

    // Build image map
    const imgMap = new Map();
    for (const f of imgFiles) imgMap.set(f.name.toLowerCase(), f);

    // Resolve images inline
    const { resolved, dupReport: report } = await resolveImagesInline(questions, imgMap);

    // Set all states
    setTxtFileName(txtFile.name);
    setTxtContent(text);
    setParsedQuestions(questions);
    setImageMap(imgMap);
    setImageFileCount(imgFiles.length);
    setImageFolderName('Compiled batch');
    setResolvedQuestions(resolved);
    setExpandedSet(new Set(questions.map((_, i) => i)));
    setRemovedSet(new Map());
    setMergeHistory(new Map());
    setColumnOverrides(new Map());
    setDupReport(report);

    // Load PDF (optional)
    if (pdfFile) {
      setPdfFileName(pdfFile.name);
      setIsPdfLoading(true);
      setShowPdf(true);
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const uint8Array = new Uint8Array(reader.result);
          const pdf = await pdfjsLib.getDocument({ data: uint8Array.slice() }).promise;
          pdfDocRef.current = pdf;
          setPdfDoc(pdf);
          const pages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
          setPdfPages(pages);
          const images = {};
          for (const p of pages) images[p] = await convertPdfPageToImage(pdf, p);
          setPdfPageImages(images);
          setIsPdfLoading(false);
        };
        reader.readAsArrayBuffer(pdfFile);
      } catch (err) {
        console.error('PDF load error:', err);
        setIsPdfLoading(false);
      }
    } else {
      setPdfFileName(''); setPdfDoc(null); setPdfPages([]); setPdfPageImages({}); setShowPdf(false);
    }
  }, [resolveImagesInline, convertPdfPageToImage]);

  const recalcColumns = useCallback((qi) => {
    if (!resolvedQuestions) return;
    const next = [...resolvedQuestions];
    const q = { ...next[qi], _loadedImages: { ...next[qi]._loadedImages } };
    q.image = null; q.answerimage1 = null; q.answerimage2 = null; q.answerimage3 = null; q.answerimage4 = null;
    for (const p of q.parts) { p.answerImage = null; p.image = null; }
    const overrides = columnOverrides;
    for (const ref of q.imageRefs) {
      if (removedSet.get(qi)?.has(ref.label)) continue;
      const key = `${qi}-${ref.label}`;
      const targetCol = overrides.has(key) ? overrides.get(key) : ref.label.toLowerCase().replace(/\d+$/, '').trim();
      const base64 = q._loadedImages[ref.label];
      if (!base64) continue;
      const col = imagePartMapping[targetCol];
      if (col === 'image') q.image = base64;
      else if (col) {
        q[col] = base64;
        const partIdx = partLetterIndex[targetCol];
        if (partIdx !== undefined && q.parts[partIdx]) { q.parts[partIdx].answerImage = base64; q.parts[partIdx].image = base64; }
      }
    }
    next[qi] = q;
    setResolvedQuestions(next);
  }, [resolvedQuestions, columnOverrides, removedSet]);

  const setColumnForRef = useCallback((qi, refLabel, targetCol) => {
    const next = new Map(columnOverrides);
    const key = `${qi}-${refLabel}`;
    if (targetCol === refLabel.toLowerCase().replace(/\d+$/, '').trim()) next.delete(key);
    else next.set(key, targetCol);
    setColumnOverrides(next);
  }, [columnOverrides]);

  const removeImage = (qi, refLabel) => {
    const next = new Map(removedSet);
    const s = new Set(next.get(qi) || []);
    s.add(refLabel);
    next.set(qi, s);
    setRemovedSet(next);
  };

  const undoRemoveImage = (qi, refLabel) => {
    const next = new Map(removedSet);
    const s = new Set(next.get(qi) || []);
    s.delete(refLabel);
    if (s.size === 0) next.delete(qi); else next.set(qi, s);
    setRemovedSet(next);
  };

  const applyMergeToQuestion = (qi, mergedData, mergedIndices, partColumn) => {
    const next = [...resolvedQuestions];
    const q = { ...next[qi], _loadedImages: { ...next[qi]._loadedImages } };
    const refs = [...q.imageRefs];
    const baseLabel = refs[mergedIndices[0]].label;
    const mergedLabel = baseLabel + '_merged';
    for (const idx of mergedIndices) refs[idx] = null;
    refs.push({ label: mergedLabel, filename: mergedLabel + '.png', baseLabel: baseLabel });
    q.imageRefs = refs.filter(Boolean);
    q._loadedImages[mergedLabel] = mergedData;
    const label = mergedLabel.toLowerCase().replace(/\d+$/, '').trim();
    const col = imagePartMapping[label] || partColumn;
    if (col === 'image') q.image = mergedData;
    else if (col) {
      q[col] = mergedData;
      const partIdx = partLetterIndex[label];
      if (partIdx !== undefined && q.parts[partIdx]) { q.parts[partIdx].answerImage = mergedData; q.parts[partIdx].image = mergedData; }
    }
    next[qi] = q;
    setResolvedQuestions(next);
    const mh = new Map(mergeHistory);
    mh.set(`${qi}-${mergedLabel}`, mergedIndices);
    setMergeHistory(mh);
  };

  const buildUploadPayload = useCallback(() => {
    if (!resolvedQuestions) return [];
    return resolvedQuestions.map((q, qi) => {
      const removed = removedSet.get(qi);
      const filtered = { ...q }; // Keep _loadedImages for the preview component
      filtered.image = null; filtered.answerimage1 = null; filtered.answerimage2 = null; filtered.answerimage3 = null; filtered.answerimage4 = null;
      for (const p of filtered.parts) { p.answerImage = null; p.image = null; }
      for (const ref of q.imageRefs) {
        if (removed?.has(ref.label)) continue;
        const key = `${qi}-${ref.label}`;
        const labelForCol = ref.baseLabel || ref.label;
        const targetCol = columnOverrides.has(key) ? columnOverrides.get(key) : labelForCol.toLowerCase().replace(/\d+$/, '').trim();
        const base64 = q._loadedImages?.[ref.label];
        if (!base64) continue;
        const col = imagePartMapping[targetCol];
        if (col === 'image') filtered.image = base64;
        else if (col) {
          filtered[col] = base64;
          const partIdx = partLetterIndex[targetCol];
          if (partIdx !== undefined && filtered.parts[partIdx]) { filtered.parts[partIdx].answerImage = base64; filtered.parts[partIdx].image = base64; }
        }
      }
      return filtered;
    });
  }, [resolvedQuestions, removedSet, columnOverrides]);

  const openPreview = useCallback(() => {
    const payload = buildUploadPayload();
    if (!payload.length) { alert('No questions to preview.'); return; }
    setShowPreview(true);
  }, [buildUploadPayload]);

  const confirmPreview = useCallback(async (editedQuestions) => {
    // Final validation before upload
    const v = validateCQQuestions(editedQuestions, 'Pre-upload');
    if (v.total > 0 && v.issues.length > 0) {
      console.log(`  ⚠️ ${v.issues.length} question(s) with issues will still be uploaded.`);
    }

    setIsUploading(true);
    setProgress({ current: 0, total: editedQuestions.length });
    try {
      const results = await bulkAddQuestions(editedQuestions, (current, total) => setProgress({ current, total }));
      let msg = `Import Complete!\n\n✅ Successfully added: ${results.successCount}`;
      if (results.failedCount > 0) msg += `\n❌ Failed to add: ${results.failedCount}`;
      alert(msg);
      setShowPreview(false);
      if (results.successCount > 0) navigate('/bank');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  }, [bulkAddQuestions, navigate]);

  const cancelPreview = useCallback(() => setShowPreview(false), []);

  const handleFolderDrop = useCallback(async (items) => {
    const map = await readDroppedFolder(items);
    setImageMap(map); setImageFileCount(map.size); setImageFolderName('Dropped folder');
  }, []);

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) await handleTXTFile(file);
    if (e.target) e.target.value = '';
  }, [handleTXTFile]);

  const handleFolderSelect = useCallback(async (e) => {
    const files = e.target.files;
    if (!files) return;
    const map = new Map();
    for (const file of files) if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(file.name)) map.set(file.name.toLowerCase(), file);
    setImageMap(map); setImageFileCount(map.size);
    setImageFolderName(files[0]?.webkitRelativePath?.split('/')[0] || 'Selected folder');
    if (e.target) e.target.value = '';
  }, []);

  const handlePDFSelect = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) await handlePDFFile(file);
    if (e.target) e.target.value = '';
  }, [handlePDFFile]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await handleTXTFile(file);
  }, [handleTXTFile]);

  const handleFolderDropEvent = useCallback(async (e) => {
    e.preventDefault(); setFolderDragOver(false);
    if (e.dataTransfer?.items) await handleFolderDrop(e.dataTransfer.items);
  }, [handleFolderDrop]);

  const handlePDFDrop = useCallback(async (e) => {
    e.preventDefault(); setPdfDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) await handlePDFFile(file);
  }, [handlePDFFile]);

  const handleCompiledDrop = useCallback(async (e) => {
    e.preventDefault(); setCompiledDragOver(false);
    if (e.dataTransfer?.items) await handleCompiledFolder(e.dataTransfer.items);
  }, [handleCompiledFolder]);

  const handleImageDragStart = useCallback((e, qi, refLabel, base64) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', refLabel);
    setDragFrom({ qi, refLabel, base64 });
  }, []);

  const handleImageDragEnd = useCallback(() => {
    setDragFrom(null);
    setDragOverQi(null);
  }, []);

  const handleImageDropOnQuestion = useCallback((e, targetQi) => {
    e.preventDefault();
    setDragOverQi(null);
    if (!dragFrom || dragFrom.qi === targetQi || !resolvedQuestions) { setDragFrom(null); return; }

    const next = [...resolvedQuestions];
    const src = next[dragFrom.qi];
    const tgt = next[targetQi];
    const label = dragFrom.refLabel;
    const fname = label + '.png';

    tgt.imageRefs = [...tgt.imageRefs, { label, filename: fname }];
    tgt._loadedImages = { ...tgt._loadedImages, [label]: dragFrom.base64 };

    src.imageRefs = src.imageRefs.filter(r => r.label !== label);
    src._loadedImages = { ...src._loadedImages };
    delete src._loadedImages[label];
    src.image = null; src.answerimage1 = null; src.answerimage2 = null; src.answerimage3 = null; src.answerimage4 = null;
    for (const p of src.parts) { p.answerImage = null; p.image = null; }

    setResolvedQuestions(next);
    setDragFrom(null);
    setTimeout(() => { recalcColumns(dragFrom.qi); recalcColumns(targetQi); }, 0);
  }, [dragFrom, resolvedQuestions, recalcColumns]);

  const totalRefs = parsedQuestions.reduce((s, q) => s + q.imageRefs.length, 0);
  const totalMatched = resolvedQuestions ? resolvedQuestions.reduce((s, q) => {
    let c = 0;
    if (q.image) c++; if (q.answerimage1) c++; if (q.answerimage2) c++; if (q.answerimage3) c++; if (q.answerimage4) c++;
    return s + c;
  }, 0) : 0;

  return (
    <div className="panel" style={{ maxWidth: 1800, margin: '0 auto', display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {showPreview && resolvedQuestions && (
        <QuestionPreview
          questions={buildUploadPayload()}
          onConfirm={confirmPreview}
          onCancel={cancelPreview}
          isUploading={isUploading}
          bnContent={bnContent}
        />
      )}

      {/* Left: Main Content */}
      <div style={{ flex: 1, minWidth: 0 }}>

      <h2 style={{ color: ACCENT }}>Import CQ Questions from TXT with Images</h2>
      <p>Drop a <strong>compiled batch folder</strong> to auto-load everything, or load TXT/images/PDF individually below.</p>

      {/* Compiled Folder Drop */}
      <div onDrop={handleCompiledDrop}
        onDragOver={(e) => { e.preventDefault(); setCompiledDragOver(true); }} onDragLeave={() => setCompiledDragOver(false)}
        style={{ border: `2px dashed ${compiledDragOver ? '#8e44ad' : '#bbb'}`, borderRadius: 12, padding: 35, textAlign: 'center', margin: '15px 0', cursor: 'pointer', backgroundColor: compiledDragOver ? '#f4ecf7' : '#fafafa', transition: 'all 0.2s', borderStyle: compiledDragOver ? 'solid' : 'dashed' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>📁</div>
        <div style={{ fontWeight: 'bold', fontSize: 16, color: compiledDragOver ? '#8e44ad' : '#333' }}>
          {txtFileName && imageFolderName === 'Compiled batch'
            ? `✓ Loaded: ${txtFileName}${bnContent ? ' + BN' : ''}${pdfFileName ? ' + PDF' : ''} (${parsedQuestions.length} Qs, ${imageFileCount} imgs)`
            : 'Drop compiled batch folder here for auto-load'}
        </div>
        {txtFileName && imageFolderName === 'Compiled batch' && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#8e44ad' }}>
            TXT · {bnContent ? 'Bangla · ' : ''}PDF · {imageFileCount} images — all auto-loaded
          </div>
        )}
        {!(txtFileName && imageFolderName === 'Compiled batch') && (
          <div style={{ marginTop: 6, fontSize: 12, color: '#999' }}>
            Batch folder should contain: TXT file, PNG/JPG images, optional PDF + *_BN.txt
          </div>
        )}
      </div>

      {/* TXT Drop */}
      <div onClick={() => txtInputRef.current?.click()} onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        style={{ border: `2px dashed ${dragOver ? ACCENT : '#ccc'}`, borderRadius: 10, padding: 30, textAlign: 'center', margin: '15px 0', cursor: 'pointer', backgroundColor: dragOver ? '#fff5f0' : '#fafafa', transition: 'all 0.2s' }}>
        <input ref={txtInputRef} type="file" accept=".txt" onChange={handleFileSelect} style={{ display: 'none' }} />
        <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
        <div style={{ fontWeight: 'bold', color: dragOver ? ACCENT : '#333' }}>{txtFileName ? `Selected: ${txtFileName}` : 'Drop TXT file here or click to select'}</div>
        {txtContent && <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>{parsedQuestions.length} CQ question(s) detected</div>}
      </div>

      {/* Image Folder Drop */}
      <div onClick={() => folderInputRef.current?.click()} onDrop={handleFolderDropEvent}
        onDragOver={(e) => { e.preventDefault(); setFolderDragOver(true); }} onDragLeave={() => setFolderDragOver(false)}
        style={{ border: `2px dashed ${folderDragOver ? ACCENT : '#ccc'}`, borderRadius: 10, padding: 30, textAlign: 'center', margin: '15px 0', cursor: 'pointer', backgroundColor: folderDragOver ? '#fff5f0' : '#fafafa', transition: 'all 0.2s' }}>
        <input ref={folderInputRef} type="file" webkitdirectory="" directory="" onChange={handleFolderSelect} style={{ display: 'none' }} />
        <div style={{ fontSize: 40, marginBottom: 10 }}>🖼️</div>
        <div style={{ fontWeight: 'bold', color: folderDragOver ? ACCENT : '#333' }}>{imageFolderName ? `${imageFolderName} (${imageFileCount} images)` : 'Drop image folder here or click to select'}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>Supports PNG, JPG, GIF, WebP</div>
      </div>

      {/* PDF Drop */}
      <div onClick={() => pdfInputRef.current?.click()} onDrop={handlePDFDrop}
        onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }} onDragLeave={() => setPdfDragOver(false)}
        style={{ border: `2px dashed ${pdfDragOver ? '#3498db' : '#ccc'}`, borderRadius: 10, padding: 20, textAlign: 'center', margin: '15px 0', cursor: 'pointer', backgroundColor: pdfDragOver ? '#ebf5fb' : '#fafafa', transition: 'all 0.2s' }}>
        <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handlePDFSelect} style={{ display: 'none' }} />
        <div style={{ fontSize: 32, marginBottom: 6 }}>📕</div>
        <div style={{ fontWeight: 'bold', color: pdfDragOver ? '#3498db' : '#333' }}>{pdfFileName ? `PDF: ${pdfFileName} (${pdfPages.length} pages)` : 'Optional: Drop PDF source here for side-by-side reference'}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>Upload the original PDF to compare while editing</div>
      </div>

      {/* PDF Drop zone also toggles sidebar */}
      {pdfDoc && !showPdf && (
        <div style={{ textAlign: 'center', margin: '5px 0' }}>
          <button onClick={() => setShowPdf(true)} style={{ fontSize: 12, padding: '4px 12px', cursor: 'pointer', border: '1px solid #3498db', borderRadius: 4, backgroundColor: 'white', color: '#3498db' }}>📕 Show PDF sidebar ({pdfFileName})</button>
        </div>
      )}

      {/* Summary */}
      {parsedQuestions.length > 0 && imageFileCount > 0 && (
        <div style={{ margin: '20px 0', padding: 15, backgroundColor: '#f0faf0', borderRadius: 8, border: '1px solid #b2d8b2' }}>
          <div style={{ fontWeight: 'bold', color: '#27ae60' }}>Ready to match!</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 5 }}>
            {parsedQuestions.length} question(s) · {totalRefs} image reference(s) · {imageFileCount} image(s) loaded
          </div>
          {resolvedQuestions && <div style={{ marginTop: 8, fontSize: 13, color: '#555' }}>{totalMatched} / {totalRefs} image(s) matched</div>}
          {dupReport?.dups?.length > 0 && (
            <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff3cd', borderRadius: 4, fontSize: 12, color: '#856404' }}>
              <strong>⚠️ {dupReport.dups.length} duplicate image(s)</strong> found across questions. Each kept only in the first question.
              {dupReport.dups.map((d, i) => (
                <div key={i} style={{ marginTop: 2 }}>
                  <strong>{d.filename}</strong> in {d.refs.map((r, ri) => (
                    <span key={ri}>Q{r.qi + 1}[{r.label}]{ri === 0 ? <span style={{ color: '#27ae60' }}> ✓</span> : <span style={{ color: '#e74c3c' }}> ✕</span>} </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, margin: '15px 0', flexWrap: 'wrap' }}>
        <button onClick={loadImagesForQuestions} disabled={!parsedQuestions.length || !imageFileCount}
          style={{ backgroundColor: ACCENT, color: 'white', padding: '10px 20px', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', opacity: (!parsedQuestions.length || !imageFileCount) ? 0.5 : 1 }}>
          {resolvedQuestions ? 'Re-match Images' : 'Match Images to Questions'}
        </button>
        <button onClick={openPreview} disabled={!resolvedQuestions}
          style={{ backgroundColor: '#2980b9', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', opacity: !resolvedQuestions ? 0.5 : 1 }}>
          ✏️ Preview & Edit (metadata, text)
        </button>
        <button onClick={async () => {
          const payload = buildUploadPayload();
          if (!payload.length) return;
          setIsUploading(true);
          setProgress({ current: 0, total: payload.length });
          try {
            await batchAddQuestions(payload, (current, total) => setProgress({ current, total }));
            alert(`Imported ${payload.length} CQ questions!`);
            navigate('/bank');
          } catch (err) { alert('Upload failed: ' + err.message); } finally { setIsUploading(false); }
        }} disabled={!resolvedQuestions || isUploading}
          style={{ backgroundColor: '#27ae60', color: 'white', padding: '10px 20px', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 'bold', opacity: (!resolvedQuestions || isUploading) ? 0.5 : 1 }}>
          {isUploading ? 'Uploading...' : `Start Import (${resolvedQuestions?.length || 0} Qs)`}
        </button>
        <button className="danger" onClick={() => {
          setTxtFileName(''); setTxtContent(null); setParsedQuestions([]);
          setImageMap(new Map()); setImageFileCount(0); setImageFolderName('');
          setResolvedQuestions(null); setExpandedSet(new Set());
          setRemovedSet(new Map()); setMergeHistory(new Map());
          setColumnOverrides(new Map()); setDupReport(null);
          setShowPreview(false); setPdfFileName(''); setPdfDoc(null); setPdfPages([]); setPdfPageImages({}); setShowPdf(false);
          setBnContent(null);
          if (pdfDocRef.current) pdfDocRef.current = null;
        }} disabled={isUploading}>Clear All</button>
      </div>

      {/* Questions */}
      {parsedQuestions.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 15 }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Parsed Questions <span style={{ fontWeight: 'normal', fontSize: 13, color: '#888', marginLeft: 8 }}>(click to expand/edit)</span></h3>
          {parsedQuestions.map((q, qi) => {
            const isExpanded = expandedSet.has(qi);
            const removed = removedSet.get(qi);
            const removedCount = removed?.size || 0;
            const matched = resolvedQuestions?.[qi];
            return (
              <div key={qi}
                onDragOver={(e) => { if (dragFrom && dragFrom.qi !== qi) { e.preventDefault(); setDragOverQi(qi); } }}
                onDragLeave={() => setDragOverQi(null)}
                onDrop={(e) => handleImageDropOnQuestion(e, qi)}
                style={{ border: `1px solid ${dragOverQi === qi ? '#8e44ad' : isExpanded ? ACCENT : '#ddd'}`, borderRadius: 8, marginBottom: 8, backgroundColor: dragOverQi === qi ? '#f4ecf7' : '#fff', overflow: 'hidden', transition: 'all 0.15s' }}>
                <div onClick={() => { const next = new Set(expandedSet); if (next.has(qi)) next.delete(qi); else next.add(qi); setExpandedSet(next); }} style={{
                  padding: '10px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  backgroundColor: isExpanded ? '#fff8f5' : '#fafafa', borderBottom: isExpanded ? '1px solid #ffe0d0' : 'none', userSelect: 'none'
                }}>
                  <div style={{ fontWeight: 'bold' }}>
                    Q{qi + 1}: {q.board}
                    <span style={{ fontWeight: 'normal', color: '#666', marginLeft: 8, fontSize: 13 }}>{q.subject} · {q.chapter}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#888', display: 'flex', gap: 8, alignItems: 'center' }}>
                    {removedCount > 0 && <span style={{ color: '#e74c3c' }}>{removedCount} removed</span>}
                    {q.parts.length} parts · {q.imageRefs.length} imgs
                    <span style={{ fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>
                {!isExpanded ? (
                  <div style={{ padding: '8px 12px' }}>
                    <div style={{ fontSize: 13, color: '#444', marginBottom: 4 }}><strong>Stem:</strong> {q.questionText?.substring(0, 100)}{q.questionText?.length > 100 ? '...' : ''}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {q.parts.map((p, pi) => (
                        <span key={pi} style={{ background: '#f0f0f0', padding: '2px 7px', borderRadius: 3, fontSize: 12 }}>
                          {p.letter.toUpperCase()}. {p.text?.substring(0, 30)}{p.text?.length > 30 ? '...' : ''}{p.marks > 0 && <span style={{ color: '#999' }}> ({p.marks})</span>}
                        </span>
                      ))}
                    </div>
                    {matched && Object.keys(matched._loadedImages).length > 0 && (
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 5 }}>
                        {Object.entries(matched._loadedImages).map(([label, data]) => {
                          if (removed?.has(label)) return null;
                          return <img key={label} src={data} alt={label} draggable onDragStart={(e) => handleImageDragStart(e, qi, label, data)} onDragEnd={handleImageDragEnd} style={{ maxHeight: 26, borderRadius: 3, border: '1px solid #ddd', cursor: 'grab' }} />;
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
                    <div style={{ marginBottom: 10 }}>
                      <strong style={{ color: ACCENT }}>Stem:</strong>
                      <div style={{ marginTop: 3, padding: 8, backgroundColor: '#f9f9f9', borderRadius: 4, whiteSpace: 'pre-wrap' }}>{q.questionText || '(no stem)'}</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <strong style={{ color: ACCENT }}>Parts:</strong>
                      {q.parts.map((p, pi) => (
                        <div key={pi} style={{ marginTop: 4, padding: '6px 8px', backgroundColor: '#f9f9f9', borderRadius: 4, borderLeft: '3px solid #ddd' }}>
                          <div style={{ fontWeight: 'bold' }}>{p.letter.toUpperCase()}. {p.text}{p.marks > 0 && <span style={{ fontWeight: 'normal', color: '#999' }}> ({p.marks})</span>}</div>
                          {p.answer && <div style={{ marginTop: 3, color: '#555', whiteSpace: 'pre-wrap', fontSize: 12 }}><em>Answer:</em> {p.answer.substring(0, 200)}{p.answer.length > 200 ? '...' : ''}</div>}
                        </div>
                      ))}
                    </div>
                    <div>
                      <strong style={{ color: ACCENT }}>Images:</strong>
                      {q.imageRefs.length === 0 && <span style={{ color: '#999', marginLeft: 8 }}>none</span>}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {q.imageRefs.map((ref, ri) => {
                          const isRemoved = removed?.has(ref.label);
                          const imgData = matched?._loadedImages?.[ref.label] || null;
                          const baseLabel = ref.label.toLowerCase().replace(/\d+$/, '').trim();
                          const overrideKey = `${qi}-${ref.label}`;
                          const currentCol = columnOverrides.has(overrideKey) ? columnOverrides.get(overrideKey) : baseLabel;
                          return (
                            <div key={ri} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 2, padding: 6, borderRadius: 6, border: `1px solid ${isRemoved ? '#e74c3c' : '#ddd'}`, backgroundColor: isRemoved ? '#fff5f5' : '#fafafa', opacity: isRemoved ? 0.5 : 1, maxWidth: 170 }}>
                              {imgData ? <img src={imgData} alt={ref.label} draggable onDragStart={(e) => handleImageDragStart(e, qi, ref.label, imgData)} onDragEnd={handleImageDragEnd} style={{ maxHeight: 70, maxWidth: 140, borderRadius: 3, cursor: 'grab' }} />
                                : <div style={{ width: 80, height: 50, backgroundColor: '#eee', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#999' }}>No image</div>}
                              <div style={{ fontSize: 10, fontWeight: 'bold', marginTop: 3, color: isRemoved ? '#e74c3c' : '#555' }}>[{ref.label}]{isRemoved && <span style={{ color: '#e74c3c' }}> ✕</span>}</div>
                              {!isRemoved && imgData && (
                                <select value={currentCol} onChange={(e) => { setColumnForRef(qi, ref.label, e.target.value); setTimeout(() => recalcColumns(qi), 0); }}
                                  style={{ fontSize: 10, marginTop: 3, padding: '1px 3px', maxWidth: 120, border: '1px solid #ccc', borderRadius: 3 }}>
                                  {colOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label} ({imagePartMapping[opt.value]})</option>)}
                                </select>
                              )}
                              <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                                {isRemoved ? <button onClick={() => undoRemoveImage(qi, ref.label)} style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: 3 }}>Undo</button>
                                  : imgData && <button onClick={() => removeImage(qi, ref.label)} style={{ fontSize: 9, padding: '1px 6px', cursor: 'pointer', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: 3 }}>Remove</button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {(() => {
                        if (!matched) return null;
                        const refsByCol = {};
                        for (const ref of q.imageRefs) {
                          if (removed?.has(ref.label)) continue;
                          const baseLabel = ref.label.toLowerCase().replace(/\d+$/, '').trim();
                          const key = `${qi}-${ref.label}`;
                          const col = columnOverrides.has(key) ? columnOverrides.get(key) : baseLabel;
                          if (!refsByCol[col]) refsByCol[col] = [];
                          const data = matched._loadedImages?.[ref.label];
                          if (data) refsByCol[col].push({ label: ref.label, data });
                        }
                        const mergeable = Object.entries(refsByCol).filter(([, imgs]) => imgs.length >= 2);
                        if (!mergeable.length) return null;
                        return (
                          <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 8 }}>
                            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Merge images:</div>
                            {mergeable.map(([col, imgs]) => (
                              <button key={col} onClick={() => setMergeModal({ qi, col, images: imgs })}
                                style={{ fontSize: 11, padding: '4px 10px', marginRight: 6, marginBottom: 4, cursor: 'pointer', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: 4 }}>
                                Merge {col} column ({imgs.length} imgs)
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mergeModal && (
        <ImageMergeModal
          images={mergeModal.images}
          onMerge={(mergedData, indices) => { applyMergeToQuestion(mergeModal.qi, mergedData, indices, mergeModal.col); setMergeModal(null); }}
          onClose={() => setMergeModal(null)}
        />
      )}

      {isUploading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'white', padding: 30, borderRadius: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', minWidth: 400, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 20 }}>Importing Questions...</h3>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#27ae60' }}>{progress.current} / {progress.total}</div>
            <div style={{ width: '100%', height: 30, backgroundColor: '#e0e0e0', borderRadius: 15, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`, height: '100%', backgroundColor: '#27ae60', transition: 'width 0.3s ease' }} />
            </div>
            <div style={{ color: '#666', fontSize: 14 }}>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% Complete</div>
          </div>
        </div>
      )}
      </div>

      {/* Right: PDF Sidebar */}
      {pdfDoc && showPdf && (
        <div style={{ flex: 1, minWidth: 0, position: 'sticky', top: 20, maxHeight: 'calc(100vh - 40px)', overflowY: 'auto', borderRadius: 8, border: '1px solid #3498db', backgroundColor: '#f8fbff' }}>
          <div style={{ padding: '8px 10px', backgroundColor: '#ebf5fb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 1 }}>
            <span style={{ fontWeight: 'bold', fontSize: 12 }}>📕 {pdfFileName}</span>
            <button onClick={() => setShowPdf(false)} style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer', border: 'none', borderRadius: 3, backgroundColor: '#e74c3c', color: 'white' }}>✕</button>
          </div>
          <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            {isPdfLoading ? (
              <div style={{ padding: 20, color: '#888', fontSize: 13 }}>Loading PDF pages...</div>
            ) : pdfPages.map(p => (
              <div key={p} style={{ textAlign: 'center', width: '100%' }}>
                <img src={pdfPageImages[p]} alt={`Page ${p}`} style={{ width: '100%', borderRadius: 4, border: '1px solid #ccc', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                <div style={{ fontSize: 9, color: '#888', marginTop: 1 }}>p.{p}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
