import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { roadmapApi } from '../../services/roadmapApi';
import LatexRenderer from '../LatexRenderer/LatexRenderer';

const inputStyle = { padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, marginRight: 8, marginBottom: 6, background: 'white' };
const btnBase = { padding: '6px 12px', borderRadius: 5, border: 'none', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' };

const diffColor = { easy: '#27ae60', medium: '#f39c12', hard: '#e74c3c' };
const statusColor = { active: '#27ae60', draft: '#f39c12', archived: '#888' };
const sessionColor = {
  content_view: '#3498db', quiz: '#9b59b6', practice: '#e67e22',
  flashcard: '#16a085', video: '#c0392b', summary: '#2980b9',
};

const modalOverlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex',
  justifyContent: 'center', alignItems: 'flex-start', zIndex: 10000, padding: '30px', overflowY: 'auto'
};
const modalPanel = {
  backgroundColor: 'white', padding: '25px', borderRadius: '12px',
  boxShadow: '0 10px 25px rgba(0,0,0,0.2)', width: '100%', maxWidth: '950px'
};

export default function RoadmapView() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [detail, setDetail] = useState(null); // full roadmap with nodes
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedNode, setExpandedNode] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  const [sessionQuestions, setSessionQuestions] = useState({}); // { [sessionId]: questions[] }
  const [loadingSessions, setLoadingSessions] = useState({});   // { [sessionId]: true }

  const parseConfig = (cfg) => {
    if (!cfg) return {};
    if (typeof cfg === 'object') return cfg;
    try { return JSON.parse(cfg); } catch { return {}; }
  };

  const loadSessionQuestions = useCallback(async (session) => {
    const cfg = parseConfig(session.config);
    const ids = Array.isArray(cfg.question_ids) ? cfg.question_ids : [];
    if (ids.length === 0) return;
    setLoadingSessions(prev => ({ ...prev, [session.id]: true }));
    try {
      const qs = await roadmapApi.fetchQuestionsByIds(ids.map(String));
      setSessionQuestions(prev => ({ ...prev, [session.id]: qs }));
    } catch (e) {
      console.error('Failed to load session questions', e);
    } finally {
      setLoadingSessions(prev => { const n = { ...prev }; delete n[session.id]; return n; });
    }
  }, []);

  const isQuestionSession = (s) => {
    const t = (s.session_type || '').toLowerCase();
    return t === 'mcq' || t === 'cq' || t === 'sq' || t === 'quiz' || t === 'practice' || t === 'flashcard';
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await roadmapApi.listRoadmaps();
      setRoadmaps(list);
    } catch (e) {
      console.error('Failed to load roadmaps', e);
      alert('Failed to load roadmaps: ' + e.message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const subjects = useMemo(() => {
    const set = new Set();
    roadmaps.forEach(r => r.subject && set.add(r.subject));
    return [...set].sort();
  }, [roadmaps]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return roadmaps.filter(r => {
      if (subjectFilter && r.subject !== subjectFilter) return false;
      if (s) {
        const hay = `${r.title} ${r.subject} ${r.chapter} ${r.description || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [roadmaps, search, subjectFilter]);

  // group filtered roadmaps by subject
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!map[r.subject]) map[r.subject] = [];
      map[r.subject].push(r);
    });
    // sort chapters within subject
    Object.keys(map).forEach(k => map[k].sort((a, b) => (a.chapter || '').localeCompare(b.chapter || '')));
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const totalNodes = roadmaps.reduce((s, r) => s + (r.total_nodes || 0), 0);
    const totalXp = roadmaps.reduce((s, r) => s + (r.total_xp || 0), 0);
    return {
      total: roadmaps.length,
      subjects: subjects.length,
      totalNodes,
      totalXp,
    };
  }, [roadmaps, subjects]);

  const openDetail = useCallback(async (rm) => {
    setLoadingDetail(true);
    setDetail(null);
    try {
      const full = await roadmapApi.getRoadmap(rm.id);
      setDetail(full);
    } catch (e) {
      console.error('Failed to load roadmap detail', e);
      alert('Failed to load roadmap: ' + e.message);
    } finally { setLoadingDetail(false); }
  }, []);

  const safeArr2 = (v) => { if (Array.isArray(v)) return v; if (typeof v === 'string') { try { return JSON.parse(v); } catch { return []; } } return []; };

  const renderLinkedQuestion = (q, idx, partSelection) => {
    const parts = safeArr2(q.parts);
    const options = safeArr2(q.options);
    const isCQ = (q.type || '').toLowerCase() === 'cq' || parts.length > 0;
    // For CQ, optionally filter to selected parts
    const visibleParts = (isCQ && Array.isArray(partSelection) && partSelection.length)
      ? parts.filter(p => partSelection.includes(p.label || p.letter))
      : parts;
    return (
      <div key={q.id || idx} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 10, marginBottom: 10, background: '#fff' }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
          {q.type ? <span style={{ textTransform: 'uppercase', fontWeight: 'bold', color: '#3498db', marginRight: 8 }}>{q.type}</span> : null}
          {q.subject ? <span>{q.subject}</span> : null}
          {q.board ? <span> · {q.board}</span> : null}
          <span style={{ marginLeft: 8, color: '#bbb' }}>ID: {q.id}</span>
        </div>
        <div style={{ fontSize: 13, marginBottom: 6, whiteSpace: 'pre-wrap' }}><LatexRenderer text={q.question_text || q.question || ''} /></div>
        {isCQ && visibleParts.map((p, i) => (
          <div key={i} style={{ borderLeft: '3px solid #9b59b6', paddingLeft: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 12, color: '#2c3e50' }}><b>{p.label || p.letter}.</b> <LatexRenderer text={p.text} /> {p.marks ? <span style={{ color: '#888', fontSize: 10 }}>({p.marks})</span> : null}</div>
            {p.answer && <div style={{ fontSize: 12, color: '#555' }}><span style={{ color: '#27ae60', fontWeight: 'bold' }}>Ans:</span> <LatexRenderer text={p.answer} /></div>}
          </div>
        ))}
        {!isCQ && options.map((o, i) => (
          <div key={i} style={{ fontSize: 12, color: q.correct_answer === o.label ? '#1e7e34' : '#333', fontWeight: q.correct_answer === o.label ? 'bold' : 'normal' }}>
            <b>{o.label}.</b> <LatexRenderer text={o.text} /> {q.correct_answer === o.label && <span style={{ color: '#27ae60' }}>✓</span>}
          </div>
        ))}
        {q.explanation && <div style={{ fontSize: 11, color: '#7f8c8d', marginTop: 4 }}><b>Explanation:</b> <LatexRenderer text={q.explanation} /></div>}
      </div>
    );
  };

  const renderSession = (s, idx) => {
    const color = sessionColor[s.session_type] || '#7f8c8d';
    return (
      <div key={idx} style={{ borderLeft: `3px solid ${color}`, padding: '8px 12px', marginBottom: 8, background: '#fafbfc', borderRadius: 4 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ background: color, color: 'white', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{s.session_type}</span>
          <strong style={{ fontSize: 13 }}>{s.title}</strong>
          {s.required_completions > 1 && <span style={{ fontSize: 11, color: '#888' }}>· {s.required_completions}× required</span>}
          {s.passing_score != null && s.passing_score < 100 && <span style={{ fontSize: 11, color: '#888' }}>· pass {s.passing_score}%</span>}
          {s.source_type && <span style={{ fontSize: 11, color: '#888' }}>· src: {s.source_type}{s.source_id ? `/${s.source_id}` : ''}</span>}
        </div>
        {s.content && (
          <div style={{ fontSize: 12, color: '#555', marginTop: 4, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>
            <LatexRenderer text={s.content} />
          </div>
        )}

        {/* Linked questions (MCQ/CQ/SQ) */}
        {isQuestionSession(s) && (() => {
          const cfg = parseConfig(s.config);
          const ids = Array.isArray(cfg.question_ids) ? cfg.question_ids : [];
          const loaded = sessionQuestions[s.id];
          const isLoading = loadingSessions[s.id];
          return (
            <div style={{ marginTop: 8, border: '1px dashed #bbb', borderRadius: 6, padding: 8, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 12, color: '#2c3e50' }}>📝 Linked Questions</strong>
                <span style={{ fontSize: 11, color: '#888' }}>{ids.length} in config</span>
                {loaded && <span style={{ fontSize: 11, color: '#27ae60' }}>· {loaded.length} loaded</span>}
                {!loaded && !isLoading && ids.length > 0 && (
                  <button onClick={() => loadSessionQuestions(s)} style={{ ...btnBase, background: '#3498db', fontSize: 11, padding: '3px 10px' }}>Load questions</button>
                )}
                {isLoading && <span style={{ fontSize: 11, color: '#888' }}>⏳ loading...</span>}
              </div>
              {loaded && loaded.length > 0 && loaded.map((q, i) => {
                const partSel = cfg.cq_part_selections ? (cfg.cq_part_selections[String(q.id)] || cfg.cq_part_selections[q.id]) : null;
                return renderLinkedQuestion(q, i, partSel);
              })}
              {loaded && loaded.length === 0 && <div style={{ fontSize: 12, color: '#aaa' }}>No questions could be loaded (they may have been deleted).</div>}
              {ids.length === 0 && <div style={{ fontSize: 12, color: '#aaa' }}>This session has no question_ids in its config.</div>}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderNode = (n, idx) => {
    const isOpen = expandAll || expandedNode === n.id;
    const nDiff = n.difficulty || 'medium';
    return (
      <div key={n.id} style={{ border: '1px solid #eee', borderRadius: 6, marginBottom: 8, overflow: 'hidden' }}>
        <div onClick={() => { setExpandAll(false); setExpandedNode(isOpen ? null : n.id); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: isOpen ? '#f0f7ff' : 'white' }}>
          <span style={{ display: 'inline-flex', width: 26, height: 26, borderRadius: '50%', background: '#3498db', color: 'white', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 'bold' }}>{n.order_index + 1}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#2c3e50' }}>{n.title}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{n.topic || n.node_type || ''} {n.is_mandatory ? '· mandatory' : '· optional'} {n.estimated_minutes ? `· ~${n.estimated_minutes}m` : ''} {n.xp_reward ? `· +${n.xp_reward}xp` : ''}</div>
          </div>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: diffColor[nDiff] || '#888', color: 'white', fontWeight: 'bold' }}>{nDiff}</span>
          <span style={{ fontSize: 11, color: '#888' }}>{(n.sessions || []).length} sessions</span>
          <span style={{ fontSize: 14, color: '#888' }}>{isOpen ? '▼' : '▶'}</span>
        </div>
        {isOpen && (
          <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #eee', background: '#fff' }}>
            {n.description && <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}><LatexRenderer text={n.description} /></div>}
            {(n.sessions && n.sessions.length > 0)
              ? n.sessions.map(renderSession)
              : <div style={{ fontSize: 12, color: '#aaa' }}>No sessions.</div>}
            {(n.episodes && n.episodes.length > 0) && (
              <div style={{ marginTop: 8 }}>
                <strong style={{ fontSize: 12, color: '#6f42c1' }}>📺 Episodes ({n.episodes.length})</strong>
                {n.episodes.map((ep, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>{ep.title || ep.id} {ep.xp_reward ? `· +${ep.xp_reward}xp` : ''}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  return (
    <div style={{ padding: 20, maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>🗺️ Learning Roadmaps <span style={{ fontSize: 12, color: '#888', fontWeight: 'normal' }}>(SSC / original table)</span></span>
        <span style={{ fontSize: 13, color: '#888', fontWeight: 'normal' }}>{stats.total} roadmaps · {stats.subjects} subjects · {stats.totalNodes} nodes · {stats.totalXp}xp</span>
      </h2>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[{ l: 'Roadmaps', v: stats.total, c: '#3498db' }, { l: 'Subjects', v: stats.subjects, c: '#9b59b6' }, { l: 'Total Nodes', v: stats.totalNodes, c: '#16a085' }, { l: 'Total XP', v: stats.totalXp, c: '#e67e22' }].map(s => (
          <div key={s.l} style={{ flex: 1, minWidth: 130, border: '1px solid #eee', borderRadius: 8, padding: '12px 16px', borderLeft: `4px solid ${s.c}`, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>🔍 Search</label>
          <input style={inputStyle} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title / chapter..." />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#666', marginBottom: 2 }}>Subject</label>
          <select style={inputStyle} value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #ccc', cursor: 'pointer' }} onClick={() => { setSearch(''); setSubjectFilter(''); }}>Reset</button>
        <button style={{ ...btnBase, background: '#27ae60' }} onClick={load}>🔄 Refresh</button>
      </div>

      {loading && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>⏳ Loading roadmaps...</div>}
      {!loading && filtered.length === 0 && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>No roadmaps found.</div>}

      {/* Grouped list */}
      {!loading && Object.keys(grouped).map(subj => (
        <div key={subj} style={{ marginBottom: 20 }}>
          <h3 style={{ color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: 4, marginBottom: 10 }}>
            {subj} <span style={{ fontSize: 12, color: '#888', fontWeight: 'normal' }}>({grouped[subj].length})</span>
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {grouped[subj].map(rm => {
              const d = rm.difficulty || 'medium';
              const st = rm.status || 'draft';
              return (
                <div key={rm.id} onClick={() => openDetail(rm)} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, cursor: 'pointer', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'transform 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                  <div style={{ fontSize: 13, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 }}>{rm.title}</div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{rm.chapter}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, background: diffColor[d] || '#888', color: 'white', fontWeight: 'bold' }}>{d}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 10, background: statusColor[st] || '#888', color: 'white', fontWeight: 'bold' }}>{st}</span>
                    <span style={{ color: '#666' }}>{rm.total_nodes} nodes</span>
                    <span style={{ color: '#666' }}>{rm.total_xp}xp</span>
                    {rm.ai_generated ? <span style={{ color: '#6f42c1' }}>✨ AI</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}


      {/* Detail modal */}
      {(loadingDetail || detail) && (
        <div style={modalOverlay} onClick={() => { if (!loadingDetail) { setDetail(null); setExpandedNode(null); setExpandAll(false); } }}>
          <div style={modalPanel} onClick={e => e.stopPropagation()}>
            {loadingDetail && <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>⏳ Loading roadmap...</div>}
            {detail && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#3498db' }}>{detail.title}</h3>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{detail.subject} — {detail.chapter}</div>
                  </div>
                  <button onClick={() => { setDetail(null); setExpandedNode(null); setExpandAll(false); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#666' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, fontSize: 11 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, background: diffColor[detail.difficulty] || '#888', color: 'white', fontWeight: 'bold' }}>{detail.difficulty || 'medium'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, background: statusColor[detail.status] || '#888', color: 'white', fontWeight: 'bold' }}>{detail.status || 'draft'}</span>
                  <span style={{ color: '#666' }}>{(detail.nodes || []).length} nodes</span>
                  <span style={{ color: '#666' }}>{detail.total_xp}xp</span>
                  {detail.ai_generated ? <span style={{ color: '#6f42c1' }}>✨ AI generated</span> : null}
                </div>

                {detail.description && <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}><LatexRenderer text={detail.description} /></div>}

                <div style={{ marginBottom: 8, fontSize: 12, color: '#666' }}>
                  <button style={{ ...btnBase, background: '#3498db', marginRight: 8 }} onClick={() => { setExpandAll(false); setExpandedNode(null); }}>Collapse all</button>
                  <button style={{ ...btnBase, background: '#27ae60' }} onClick={() => { setExpandedNode(null); setExpandAll(true); }}>Expand all</button>
                </div>

                {(detail.nodes || []).map((n, i) => renderNode(n, i))}
                {(detail.nodes || []).length === 0 && <div style={{ color: '#888', padding: 20, textAlign: 'center' }}>This roadmap has no nodes yet.</div>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

