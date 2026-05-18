import React, { useState, useRef, useEffect, useMemo } from 'react';

const SLOTS = ['stem', 'a', 'b', 'c', 'd'];
const SLOT_LABELS = { stem: 'Stem', a: 'A', b: 'B', c: 'C', d: 'D' };

export default function CQMDImageAssigner({ rawMD, questions, onConfirm, onCancel }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const mdRef = useRef(null);

  const [assignments, setAssignments] = useState(() =>
    questions.map(q => {
      const a = { stem: q.image || null };
      for (const p of q.parts || []) {
        a[p.letter] = p.answerImage || null;
      }
      return a;
    })
  );

  // Extract all unique image URLs from the raw markdown
  const allImages = useMemo(() => {
    const set = new Set();
    const re = /<img\s+src='([^']+)'/gi;
    let m;
    while ((m = re.exec(rawMD)) !== null) set.add(m[1]);
    return [...set];
  }, [rawMD]);

  // Highlight selected image in the MD panel
  useEffect(() => {
    if (!mdRef.current) return;
    const imgs = mdRef.current.querySelectorAll('img');
    imgs.forEach(img => {
      img.style.outline = img.src === selectedImage ? '3px solid #3498db' : 'none';
      img.style.outlineOffset = img.src === selectedImage ? '2px' : '0';
    });
  }, [selectedImage]);

  const handleMDClick = (e) => {
    if (e.target.tagName !== 'IMG') return;
    const url = e.target.src;
    setSelectedImage(prev => prev === url ? null : url);
  };

  const handleSlotClick = (qIdx, slot) => {
    if (!selectedImage) return;
    setAssignments(prev => {
      const next = prev.map(row => ({ ...row }));
      next[qIdx] = { ...next[qIdx], [slot]: selectedImage };
      return next;
    });
  };

  const handleSlotClear = (qIdx, slot, e) => {
    e.stopPropagation();
    setAssignments(prev => {
      const next = prev.map(row => ({ ...row }));
      next[qIdx] = { ...next[qIdx], [slot]: null };
      return next;
    });
  };

  const handleConfirm = () => {
    const merged = questions.map((q, qi) => {
      const row = assignments[qi];
      const qCopy = { ...q, image: row.stem };
      if (qCopy.parts) {
        qCopy.parts = qCopy.parts.map((p, pi) => ({
          ...p,
          answerImage: row[p.letter] || null,
          image: row[p.letter] || null,
        }));
      }
      // Sync legacy columns
      qCopy.answerimage1 = qCopy.parts?.[2]?.answerImage || null; // c
      qCopy.answerimage2 = qCopy.parts?.[3]?.answerImage || null; // d
      qCopy.answerimage3 = qCopy.parts?.[0]?.answerImage || null; // a
      qCopy.answerimage4 = qCopy.parts?.[1]?.answerImage || null; // b
      return qCopy;
    });
    onConfirm(merged);
  };

  const countAssigned = (qIdx) =>
    SLOTS.filter(s => assignments[qIdx]?.[s]).length;

  const renderMDContent = () => {
    // Wrap text in pre for whitespace preservation,
    // but let HTML tags (img, div) render naturally.
    // Insert a zero-width marker around img tags so we can style them after render.
    const html = rawMD
      .replace(/<img\s+src='([^']+)'/gi, (m, url) => {
        return `<img src='${url}' data-imgurl='${url}' style='cursor:pointer;max-width:100%;margin:6px 0;border:1px solid #ddd;border-radius:4px;' onerror='this.style.display="none"'`;
      });
    return html;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '500px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
        <strong>Assign Images</strong>
        {selectedImage ? (
          <span style={{ color: '#3498db', fontSize: '13px' }}>
            Selected: click a slot in the grid to place this image
          </span>
        ) : (
          <span style={{ color: '#888', fontSize: '13px' }}>
            Click an image in the markdown panel to select it
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#888' }}>
          {allImages.length} images, {questions.length} questions
        </span>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Left panel: raw markdown */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '13px', color: '#555' }}>Markdown (click an image to select it)</div>
          <div
            ref={mdRef}
            onClick={handleMDClick}
            style={{
              flex: 1, overflow: 'auto', border: '1px solid #ccc', borderRadius: '6px',
              padding: '12px', backgroundColor: '#fafafa', fontSize: '14px',
              lineHeight: '1.7', whiteSpace: 'pre-wrap', fontFamily: 'monospace'
            }}
            dangerouslySetInnerHTML={{ __html: renderMDContent() }}
          />
        </div>

        {/* Right panel: question grid */}
        <div style={{ flex: '1.2', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', fontSize: '13px', color: '#555' }}>
            Questions ({questions.length}) — click a cell to place the selected image
          </div>
          <div style={{ flex: 1, overflow: 'auto', border: '1px solid #ccc', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, backgroundColor: '#f0f4f8', zIndex: 1 }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Board</th>
                  {SLOTS.map(s => (
                    <th key={s} style={{ ...thStyle, color: s === 'stem' ? '#2c3e50' : '#8e44ad' }}>{SLOT_LABELS[s]}</th>
                  ))}
                  <th style={{ ...thStyle, width: '50px' }}>C</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, qi) => (
                  <tr key={qi} style={{ borderBottom: '1px solid #e8e8e8' }}>
                    <td style={tdStyle}>Q{qi + 1}</td>
                    <td style={{ ...tdStyle, fontSize: '11px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {q.board || '—'}
                    </td>
                    {SLOTS.map(s => {
                      const url = assignments[qi]?.[s];
                      return (
                        <td key={s} style={{ ...tdStyle, textAlign: 'center', cursor: selectedImage ? 'pointer' : 'default' }}
                          onClick={() => handleSlotClick(qi, s)}
                          title={selectedImage ? `Assign to Q${qi + 1} ${SLOT_LABELS[s]}` : 'Select an image first'}>
                          {url ? (
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <img src={url} alt="" style={{ width: '50px', height: '40px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #bbb' }} />
                              <button
                                onClick={(e) => handleSlotClear(qi, s, e)}
                                style={{
                                  position: 'absolute', top: '-6px', right: '-6px',
                                  width: '16px', height: '16px', borderRadius: '50%',
                                  border: 'none', backgroundColor: '#e74c3c', color: 'white',
                                  fontSize: '10px', lineHeight: '16px', textAlign: 'center',
                                  cursor: 'pointer', padding: 0
                                }}
                                title="Clear">×</button>
                            </div>
                          ) : (
                            <div style={{
                              width: '50px', height: '40px', border: '2px dashed #ccc',
                              borderRadius: '3px', display: 'inline-flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '18px', color: '#ccc'
                            }}>
                              {selectedImage ? '+' : ''}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center', fontSize: '12px', color: countAssigned(qi) > 0 ? '#27ae60' : '#ccc' }}>
                      {countAssigned(qi)}/{SLOTS.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="danger">Cancel</button>
        <button onClick={handleConfirm} style={{ backgroundColor: '#27ae60', color: 'white', padding: '10px 24px', fontSize: '15px' }}>
          Confirm & Upload
        </button>
      </div>
    </div>
  );
}

const thStyle = {
  padding: '6px 4px', textAlign: 'center', borderBottom: '2px solid #ddd',
  fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap'
};
const tdStyle = {
  padding: '4px', verticalAlign: 'middle'
};
