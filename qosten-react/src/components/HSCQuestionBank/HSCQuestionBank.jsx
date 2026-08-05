import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hscApi } from '../../services/hscApi';
import LatexRenderer from '../LatexRenderer/LatexRenderer';

// ── helpers ────────────────────────────────────────────────────────────────
function safeArr(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } }
  return [];
}

// Map DB row (snake_case) into the app-like shape used by the SSC QuestionCard UI
function toCard(q) {
  const options = safeArr(q.options);
  return {
    id: q.id,
    subject: q.subject || 'N/A',
    chapter: q.chapter || 'N/A',
    type: q.type || '',
    board: q.board,
    source: q.source,
    lesson: q.lesson,
    questionText: q.question_text || q.question || '',
    answer: (q.answer || q.correct_answer || '')?.trim(),
    explanation: q.explanation || '',
    correctAnswer: q.correct_answer || q.answer || '',
    options,
    parts: safeArr(q.parts),
    image: q.image || q.question_image,
    language: q.language,
    isFlagged: !!q.is_flagged || !!q.flagged,
    isVerified: !!q.is_verified,
    isPremium: !!q.is_premium,
    inReviewQueue: !!q.in_review_queue,
    createdAt: q.created_at,
    _raw: q,
  };
}

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
  justifyContent: 'center', alignItems: 'flex-start', zIndex: 10000, padding: '30px', overflowY: 'auto'
};
const modalPanel = {
  backgroundColor: 'white', padding: '25px', borderRadius: '12px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '100%', maxWidth: '900px'
};
const inputStyle = { padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, marginRight: 8, marginBottom: 6, background: 'white' };
const pgBtn = { padding: '7px 14px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer', background: 'white' };
const actBtn = { padding: '6px 12px', borderRadius: 5, border: 'none', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' };

// ── component ─────────────────────────────────────────────────────────────
export default function HSCQuestionBank() {
  const [searchParams] = useSearchParams();
  const [all, setAll] = useState([]);      // loaded page (normalized cards)
  const [total, setTotal] = useState(0);
  const [meta, setMeta] = useState({ subjects: [], chapters: [], sources: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [limit] = useState(50);

  // filters
  const [filters, setFilters] = useState({
    searchText: '', subject: searchParams.get('subject') || '', chapter: searchParams.get('chapter') || '',
    type: '', verified: 'all', flagged: 'all',
  });

  const [editing, setEditing] = useState(null); // card being edited
  const [draft, setDraft] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState({ type: 'mcq', subject: '', chapter: '', question_text: '', options: '', correct_answer: '', explanation: '' });
  const [batchText, setBatchText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  // ── data loading ──────────────────────────────────────────────────────
  const loadMeta = useCallback(async () => {
    try {
      const m = await hscApi.fetchMeta();
      setMeta(m);
      if (!filters.subject && m.subjects && m.subjects.length) {
        setFilters(f => ({ ...f, subject: m.subjects[0] }));
      }
    } catch (e) { console.error('Failed to load HSC meta', e); }
  }, []);

  useEffect(() => { loadMeta(); }, []);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hscApi.fetchQuestions({
        page, limit, subject: filters.subject, chapter: filters.chapter, type: filters.type, source: '',
      });
      setAll(res.questions.map(toCard));
      setTotal(res.total);
    } catch (e) {
      console.error('Failed to load HSC questions', e);
      alert('Failed to load HSC questions: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters.subject, filters.chapter, filters.type]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  // client-side search / verified / flagged filtering over the current page
  const visible = useMemo(() => {
    const s = (filters.searchText || '').toLowerCase().trim();
    return all.filter(q => {
      if (s) {
        const hay = `${q.questionText} ${q.subject} ${q.chapter} ${q.answer} ${q.explanation}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (filters.verified === 'verified' && !q.isVerified) return false;
      if (filters.verified === 'unverified' && q.isVerified) return false;
      if (filters.flagged === 'flagged' && !q.isFlagged) return false;
      if (filters.flagged === 'unflagged' && q.isFlagged) return false;
      return true;
    });
  }, [all, filters]);

  const chaptersForSubject = useMemo(() => {
    return (meta.chapters || []).filter(c => !filters.subject || c.subject === filters.subject).map(c => c.chapter);
  }, [meta.chapters, filters.subject]);

  // ── stats (mirrors SSC Statistics) ────────────────────────────────────
  const stats = useMemo(() => {
    const subjects = new Set();
    const chapters = new Set();
    const types = {};
    all.forEach(q => {
      if (q.subject && q.subject !== 'N/A') subjects.add(q.subject);
      if (q.chapter && q.chapter !== 'N/A') chapters.add(q.chapter);
      const t = (q.type || 'unknown').toLowerCase();
      types[t] = (types[t] || 0) + 1;
    });
    return {
      total: total || meta.total || all.length,
      loaded: all.length,
      subjects: subjects.size,
      chapters: chapters.size,
      types,
      verified: all.filter(q => q.isVerified).length,
      flagged: all.filter(q => q.isFlagged).length,
    };
  }, [all, total, meta.total]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const setFilter = (key, value) => {
    setFilters(f => {
      const next = { ...f, [key]: value };
      if (key === 'subject') { next.chapter = ''; }
      return next;
    });
    setPage(0);
  };


  // ── create / edit / delete / flag / verify ────────────────────────────
  const saveEdit = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const payload = {
        type: draft.type, subject: draft.subject, chapter: draft.chapter,
        lesson: draft.lesson, board: draft.board, source: draft.source,
        question_text: draft.questionText, question: draft.questionText,
        options: draft.options, correct_answer: draft.correctAnswer,
        answer: draft.answer, explanation: draft.explanation,
        parts: draft.parts || [],
        language: draft.language,
        is_premium: draft.isPremium, is_flagged: draft.isFlagged, is_verified: draft.isVerified,
      };
      await hscApi.updateQuestion(draft.id, payload);
      alert('✅ HSC question updated successfully!');
      setEditing(null); setDraft(null);
      loadQuestions(); loadMeta();
    } catch (e) {
      console.error(e);
      alert('Failed to update: ' + e.message);
    } finally { setBusy(false); }
  };

  const handleDelete = async (q) => {
    if (!window.confirm(`Delete HSC question ${q.id}?`)) return;
    setBusy(true);
    try {
      await hscApi.deleteQuestion(q.id);
      alert('🗑️ Deleted');
      loadQuestions(); loadMeta();
    } catch (e) { alert('Failed to delete: ' + e.message); }
    finally { setBusy(false); }
  };

  const handleFlag = async (q) => {
    try { await hscApi.toggleFlag(q.id); loadQuestions(); }
    catch (e) { alert('Failed: ' + e.message); }
  };

  const handleVerify = async (q) => {
    try { await hscApi.toggleVerify(q.id); loadQuestions(); }
    catch (e) { alert('Failed: ' + e.message); }
  };

  const addNewQuestion = async () => {
    if (!newQ.subject || !newQ.chapter || !newQ.question_text) {
      alert('Subject, chapter and question text are required');
      return;
    }
    setBusy(true);
    try {
      let options = [];
      if (newQ.options) {
        try { options = JSON.parse(newQ.options); }
        catch { options = newQ.options.split('\n').filter(x => x.trim()).map(t => ({ label: '', text: t.trim() })); }
      }
      await hscApi.createQuestion({
        type: newQ.type || 'mcq', subject: newQ.subject, chapter: newQ.chapter,
        question_text: newQ.question_text, question: newQ.question_text,
        options, correct_answer: newQ.correct_answer || null,
        answer: newQ.correct_answer || null, explanation: newQ.explanation || null,
      });
      alert('✅ HSC question created!');
      setShowAdd(false);
      setNewQ({ type: 'mcq', subject: filters.subject, chapter: filters.chapter, question_text: '', options: '', correct_answer: '', explanation: '' });
      loadQuestions(); loadMeta();
      setPage(0);
    } catch (e) { alert('Failed to create: ' + e.message); }
    finally { setBusy(false); }
  };

  const importBatch = async () => {
    if (!batchText.trim()) return;
    setBusy(true);
    try {
      let arr;
      try { arr = JSON.parse(batchText); } catch { alert('Batch import must be a JSON array'); return; }
      if (!Array.isArray(arr)) { alert('Expected a JSON array'); return; }
      await hscApi.batchCreateQuestions(arr);
      alert('✅ Batch imported successfully!');
      setBatchText(''); setShowAdd(false);
      loadQuestions(); loadMeta(); setPage(0);
    } catch (e) { alert('Batch import failed: ' + e.message); }
    finally { setBusy(false); }
  };

  const openEdit = (q) => {
    setEditing(q);
    setDraft({
      id: q.id, subject: q.subject === 'N/A' ? '' : q.subject, chapter: q.chapter === 'N/A' ? '' : q.chapter,
      type: q.type, lesson: q.lesson, board: q.board, source: q.source,
      questionText: q.questionText, answer: q.answer, explanation: q.explanation,
      correctAnswer: q.correctAnswer, options: (q.options || []).map(o => ({ label: o.label, text: o.text })),
      parts: (q.parts || []).map(p => ({ label: p.label || p.letter || '', text: p.text || '', marks: p.marks ?? '', answer: p.answer || '' })),
      language: q.language, isPremium: q.isPremium, isFlagged: q.isFlagged, isVerified: q.isVerified,
    });
  };

  const updateOption = (idx, value) => {
    setDraft(prev => { const o = [...prev.options]; o[idx] = { ...o[idx], text: value }; return { ...prev, options: o }; });
  };

  const updatePart = (idx, field, value) => {
    setDraft(prev => { const p = [...prev.parts]; p[idx] = { ...p[idx], [field]: value }; return { ...prev, parts: p }; });
  };

  const addPart = () => {
    setDraft(prev => ({ ...prev, parts: [...prev.parts, { label: String.fromCharCode(97 + prev.parts.length), text: '', marks: '', answer: '' }] }));
  };

  const removePart = (idx) => {
    setDraft(prev => ({ ...prev, parts: prev.parts.filter((_, i) => i !== idx) }));
  };


  // ── small render helpers ──────────────────────────────────────────────
  const renderCardContent = (q) => {
    const isPartsType = (q.type || '').toLowerCase() === 'cq' || (q.type || '').toLowerCase() === 'sq' || ((q.parts || []).length > 0);
    return (
      <>
        <div style={{ margin: '6px 0 10px 0', whiteSpace: 'pre-wrap', fontSize: 14 }}>
          <LatexRenderer text={q.questionText} />
        </div>
        {/* CQ / SQ: render each sub-question + its answer */}
        {isPartsType && q.parts && q.parts.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {q.parts.map((p, i) => (
              <div key={i} style={{ marginBottom: 8, borderLeft: '3px solid #3498db', paddingLeft: 10 }}>
                <div style={{ fontSize: 13, color: '#2c3e50' }}>
                  <b>{p.label || p.letter || String.fromCharCode(97 + i)}.</b>{' '}
                  <LatexRenderer text={p.text} />
                  {(p.marks !== undefined && p.marks !== null && p.marks > 0) && <span style={{ color: '#888', fontSize: 11, marginLeft: 6 }}>({p.marks} marks)</span>}
                </div>
                {p.answer && (
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                    <span style={{ color: '#27ae60', fontWeight: 'bold' }}>Answer:</span> <LatexRenderer text={p.answer} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {/* MCQ: render options */}
        {!isPartsType && q.options && q.options.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {q.options.map((o, i) => (
              <div key={i} style={{ fontSize: 13, marginBottom: 2, color: q.correctAnswer === o.label ? '#1e7e34' : '#333', fontWeight: q.correctAnswer === o.label ? 'bold' : 'normal' }}>
                <span style={{ display: 'inline-block', width: 20 }}>{o.label}.</span>
                <LatexRenderer text={o.text} />
                {q.correctAnswer === o.label && <span style={{ color: '#27ae60', marginLeft: 4 }}>✓</span>}
              </div>
            ))}
          </div>
        )}
        {(q.answer || q.correctAnswer) && !isPartsType && (
          <div style={{ marginTop: 6 }}><strong style={{ color: '#2c3e50' }}>Answer:</strong> <LatexRenderer text={q.answer || q.correctAnswer} /></div>
        )}
        {q.explanation && (
          <div style={{ marginTop: 4, color: '#7f8c8d', fontSize: 13 }}><strong>Explanation:</strong> <LatexRenderer text={q.explanation} /></div>
        )}
      </>
    );
  };

  // ── main render ───────────────────────────────────────────────────────
  return (
    <div style={{ padding: 20, maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>🎓 HSC Question Bank</span>
        <span style={{ fontSize: 13, color: '#888', fontWeight: 'normal' }}>
          {stats.total} total · {stats.loaded} loaded · {stats.subjects} subjects · {stats.chapters} chapters
        </span>
      </h2>

      {/* Toolbar (mirrors SSC QuestionBank header actions) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button style={{ padding: '8px 14px', borderRadius: 6, background: '#3498db', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setShowAdd(v => !v)}>➕ Add New</button>
        <button style={{ padding: '8px 14px', borderRadius: 6, background: '#9b59b6', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { setShowAdd(true); }}>📥 Batch Import</button>
        <button style={{ padding: '8px 14px', borderRadius: 6, background: '#27ae60', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => { setPage(0); loadQuestions(); loadMeta(); }}>🔄 Refresh</button>
      </div>

      {/* Stats bar (mirrors SSC Statistics cards) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Questions', value: stats.total, color: '#3498db' },
          { label: 'Subjects', value: stats.subjects, color: '#9b59b6' },
          { label: 'Chapters (page)', value: stats.chapters, color: '#16a085' },
          { label: 'Verified', value: stats.verified, color: '#27ae60' },
          { label: 'Flagged', value: stats.flagged, color: '#e74c3c' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 130, border: '1px solid #eee', borderRadius: 8, padding: '12px 16px', borderLeft: `4px solid ${s.color}`, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{s.label}</div>
          </div>
        ))}
      </div>


      {/* Filters (mirrors SSC SearchFilters) */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>🔍 Search</label>
          <input style={inputStyle} value={filters.searchText} onChange={e => setFilters(f => ({ ...f, searchText: e.target.value }))} placeholder="Search text..." />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>Subject</label>
          <select style={inputStyle} value={filters.subject} onChange={e => setFilter('subject', e.target.value)}>
            <option value="">All Subjects</option>
            {(meta.subjects || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>Chapter</label>
          <select style={inputStyle} value={filters.chapter} onChange={e => setFilter('chapter', e.target.value)}>
            <option value="">All Chapters</option>
            {chaptersForSubject.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>Type</label>
          <select style={inputStyle} value={filters.type} onChange={e => setFilter('type', e.target.value)}>
            <option value="">All Types</option><option value="mcq">MCQ</option><option value="cq">CQ</option><option value="sq">SQ</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>✅ Verified</label>
          <select style={inputStyle} value={filters.verified} onChange={e => setFilters(f => ({ ...f, verified: e.target.value }))}>
            <option value="all">All</option><option value="verified">Verified Only</option><option value="unverified">Unverified Only</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>🚩 Flagged</label>
          <select style={inputStyle} value={filters.flagged} onChange={e => setFilters(f => ({ ...f, flagged: e.target.value }))}>
            <option value="all">All</option><option value="flagged">Flagged Only</option><option value="unflagged">Unflagged Only</option>
          </select>
        </div>
        <button style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }} onClick={() => { setFilters({ searchText: '', subject: '', chapter: '', type: '', verified: 'all', flagged: 'all' }); setPage(0); }}>Reset</button>
      </div>

      {/* Pagination (top) */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button style={pgBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>◀ Prev</button>
        <span>Page {page + 1} / {totalPages} · {visible.length} shown</span>
        <button style={pgBtn} disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next ▶</button>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>⏳ Loading HSC questions...</div>}
      {!loading && visible.length === 0 && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>No HSC questions found.</div>}


      {/* Question cards (mirrors SSC QuestionCard) */}
      {visible.map(q => (
        <div key={q.id} className={`question ${q.isFlagged ? 'flagged' : ''}`}
          style={{
            border: q.isFlagged ? '2px solid #e74c3c' : '1px solid #eee',
            backgroundColor: q.isFlagged ? '#fff5f5' : 'white',
            borderRadius: 8, padding: 14, marginBottom: 12, position: 'relative',
            boxShadow: '0 2px 4px rgba(155, 89, 182, 0.1)',
            transition: 'transform 0.1s ease', cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          onClick={() => setPreview(q)}
        >
          <div className="metadata" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: '#555', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
            <span>Subject: <b>{q.subject}</b></span>
            <span>Chapter: <b>{q.chapter}</b></span>
            <span>Type: <b>{(q.type || 'N/A').toUpperCase()}</b></span>
            <span>Board: <b>{q.board || 'N/A'}</b></span>
            {q.isFlagged && <span style={{ backgroundColor: '#e74c3c', color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold' }}>🚩 FLAGGED</span>}
            {q.isVerified && <span style={{ backgroundColor: '#27ae60', color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold' }}>✅ VERIFIED</span>}
            {q.isPremium && <span style={{ backgroundColor: '#f1c40f', color: '#333', padding: '2px 8px', borderRadius: 4, fontWeight: 'bold' }}>⭐ PREMIUM</span>}
            <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: 11 }}>ID: {q.id}</span>
          </div>

          {renderCardContent(q)}

          <div className="actions" style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
            <button style={{ ...actBtn, backgroundColor: q.isFlagged ? '#27ae60' : '#e74c3c' }} onClick={() => handleFlag(q)}>{q.isFlagged ? '✓ Unflag' : '🚩 Flag'}</button>
            <button style={{ ...actBtn, backgroundColor: q.isVerified ? '#f1c40f' : '#27ae60' }} onClick={() => handleVerify(q)}>{q.isVerified ? '❌ Unverify' : '✅ Verify'}</button>
            <button style={{ ...actBtn, backgroundColor: '#3498db' }} onClick={() => openEdit(q)}>✏️ Edit</button>
            <button style={{ ...actBtn, backgroundColor: '#6c757d' }} onClick={() => setPreview(q)}>👁 Preview</button>
            <button style={{ ...actBtn, backgroundColor: '#c0392b' }} onClick={() => handleDelete(q)}>🗑 Delete</button>
          </div>
        </div>
      ))}


      {/* Pagination (bottom) */}
      {!loading && visible.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <button style={pgBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>◀ Prev</button>
          <span>Page {page + 1} / {totalPages}</span>
          <button style={pgBtn} disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next ▶</button>
        </div>
      )}

      {/* Add / Batch Import panel */}
      {showAdd && (
        <div style={{ border: '1px solid #4CAF50', padding: 16, borderRadius: 8, marginTop: 16, background: '#fafffd' }}>
          <h4 style={{ marginTop: 0, color: '#3498db' }}>➕ Add New HSC Question</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input style={inputStyle} placeholder="Type" value={newQ.type} onChange={e => setNewQ({ ...newQ, type: e.target.value })} />
            <input style={inputStyle} placeholder="Subject" value={newQ.subject} onChange={e => setNewQ({ ...newQ, subject: e.target.value })} />
            <input style={inputStyle} placeholder="Chapter" value={newQ.chapter} onChange={e => setNewQ({ ...newQ, chapter: e.target.value })} />
          </div>
          <textarea style={{ width: '100%', minHeight: 60, margin: '8px 0 6px', padding: 8, border: '1px solid #ccc', borderRadius: 4 }} placeholder="Question text" value={newQ.question_text} onChange={e => setNewQ({ ...newQ, question_text: e.target.value })} />
          <textarea style={{ width: '100%', minHeight: 44, marginBottom: 6, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} placeholder='Options JSON e.g. [{"label":"a","text":"..."}] OR one per line' value={newQ.options} onChange={e => setNewQ({ ...newQ, options: e.target.value })} />
          <input style={inputStyle} placeholder="Correct answer" value={newQ.correct_answer} onChange={e => setNewQ({ ...newQ, correct_answer: e.target.value })} />
          <textarea style={{ width: '100%', minHeight: 44, margin: '6px 0', padding: 8, border: '1px solid #ccc', borderRadius: 4 }} placeholder="Explanation" value={newQ.explanation} onChange={e => setNewQ({ ...newQ, explanation: e.target.value })} />
          <button style={{ ...actBtn, backgroundColor: '#27ae60' }} onClick={addNewQuestion} disabled={busy}>{busy ? 'Saving...' : '💾 Save Question'}</button>

          <div style={{ borderTop: '1px solid #eee', marginTop: 16, paddingTop: 16 }}>
            <h4 style={{ margin: 0, color: '#8e44ad' }}>📥 Batch Import (JSON array)</h4>
            <textarea style={{ width: '100%', minHeight: 110, margin: '8px 0', padding: 8, border: '1px solid #ccc', borderRadius: 4 }} placeholder='[{"type":"mcq","subject":"Physics","chapter":"Ch1","question_text":"...","options":[...],"correct_answer":"a"}]' value={batchText} onChange={e => setBatchText(e.target.value)} />
            <button style={{ ...actBtn, backgroundColor: '#8e44ad' }} onClick={importBatch} disabled={busy}>{busy ? 'Importing...' : '🚀 Import Batch'}</button>
            <button style={pgBtn} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}


      {/* Edit modal (mirrors SSC modal style) */}
      {editing && draft && (
        <div style={modalOverlay}>
          <div style={modalPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#3498db' }}>✏️ Edit HSC Question</h3>
              <button onClick={() => { setEditing(null); setDraft(null); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#666' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input style={inputStyle} value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} placeholder="Subject" />
              <input style={inputStyle} value={draft.chapter} onChange={e => setDraft({ ...draft, chapter: e.target.value })} placeholder="Chapter" />
              <input style={inputStyle} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} placeholder="Type" />
              <input style={inputStyle} value={draft.board || ''} onChange={e => setDraft({ ...draft, board: e.target.value })} placeholder="Board" />
              <input style={inputStyle} value={draft.lesson || ''} onChange={e => setDraft({ ...draft, lesson: e.target.value })} placeholder="Lesson" />
            </div>

            <div style={{ margin: '10px 0' }}>
              <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3 }}>Question</label>
              <textarea style={{ width: '100%', minHeight: 70, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} value={draft.questionText} onChange={e => setDraft({ ...draft, questionText: e.target.value })} />
            </div>

            <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3 }}>Options</label>
            {(draft.options || []).map((o, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ width: 22, fontWeight: 'bold', fontSize: 13 }}>{o.label}</span>
                <input style={{ flex: 1, padding: 6, border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }} value={o.text} onChange={e => updateOption(idx, e.target.value)} />
                <button style={pgBtn} onClick={() => setDraft(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }))}>✖</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button style={pgBtn} onClick={() => setDraft(prev => ({ ...prev, options: [...prev.options, { label: String.fromCharCode(97 + prev.options.length), text: '' }] }))}>➕ Option</button>
            </div>

            <label style={{ display: 'block', fontSize: 12, color: '#666', margin: '8px 0 3px' }}>Parts (sub-questions — for CQ/SQ)</label>
            {(draft.parts || []).map((p, idx) => (
              <div key={idx} style={{ border: '1px solid #e3e3e3', borderRadius: 6, padding: 8, marginBottom: 6, background: '#fafbfc' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <input style={{ width: 50, padding: 4, border: '1px solid #ccc', borderRadius: 4 }} placeholder="Let" value={p.label} onChange={e => updatePart(idx, 'label', e.target.value)} />
                  <input style={{ width: 90, padding: 4, border: '1px solid #ccc', borderRadius: 4 }} placeholder="Marks" value={p.marks} onChange={e => updatePart(idx, 'marks', e.target.value)} />
                  <button style={pgBtn} onClick={() => removePart(idx)}>✖</button>
                </div>
                <textarea style={{ width: '100%', minHeight: 44, padding: 6, border: '1px solid #ccc', borderRadius: 4, marginBottom: 4, fontSize: 13 }} placeholder="Sub-question" value={p.text} onChange={e => updatePart(idx, 'text', e.target.value)} />
                <textarea style={{ width: '100%', minHeight: 44, padding: 6, border: '1px solid #ccc', borderRadius: 4, fontSize: 13 }} placeholder="Answer" value={p.answer} onChange={e => updatePart(idx, 'answer', e.target.value)} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button style={pgBtn} onClick={addPart}>➕ Part</button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input style={{ ...inputStyle, width: 220 }} placeholder="Correct answer" value={draft.correctAnswer} onChange={e => setDraft({ ...draft, correctAnswer: e.target.value })} />
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={draft.isVerified} onChange={e => setDraft({ ...draft, isVerified: e.target.checked })} style={{ marginRight: 4 }} /> Verified</label>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center' }}><input type="checkbox" checked={draft.isPremium} onChange={e => setDraft({ ...draft, isPremium: e.target.checked })} style={{ marginRight: 4 }} /> Premium</label>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3 }}>Answer</label>
              <textarea style={{ width: '100%', minHeight: 44, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} value={draft.answer} onChange={e => setDraft({ ...draft, answer: e.target.value })} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 3 }}>Explanation</label>
              <textarea style={{ width: '100%', minHeight: 50, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={{ ...actBtn, backgroundColor: '#27ae60', padding: '10px 20px' }} onClick={saveEdit} disabled={busy}>{busy ? 'Saving...' : '💾 Save Changes'}</button>
              <button style={pgBtn} onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}


      {/* Preview modal */}
      {preview && (
        <div style={modalOverlay}>
          <div style={modalPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: '#16a085' }}>👁 Question Preview</h3>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#666' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
              ID: {preview.id} · Subject: {preview.subject} · Chapter: {preview.chapter} · Type: {(preview.type || 'N/A').toUpperCase()}
              {preview.board ? ` · Board: ${preview.board}` : ''}
              {preview.source ? ` · Source: ${preview.source}` : ''}
              {preview.isVerified ? ' · ✅Verified' : ''}{preview.isFlagged ? ' · 🚩Flagged' : ''}{preview.isPremium ? ' · ⭐Premium' : ''}
            </div>
            {renderCardContent(preview)}
            {preview.image && <div style={{ marginTop: 10 }}><img src={preview.image} alt="q" style={{ maxWidth: '100%', borderRadius: 6, border: '1px solid #ddd' }} /></div>}
            <div style={{ marginTop: 18 }}>
              <button style={{ ...actBtn, backgroundColor: '#3498db' }} onClick={() => { setPreview(null); openEdit(preview); }}>✏️ Edit</button>
              <button style={pgBtn} onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

