import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestions } from '../../context/QuestionContext';
import { parseCQFromMD } from '../../utils/cqMDParser';
import CQMDImageAssigner from './CQMDImageAssigner';

export default function CQMDImport() {
  const { batchAddQuestions } = useQuestions();
  const navigate = useNavigate();

  const [enInput, setEnInput] = useState('');
  const [bnInput, setBnInput] = useState('');
  const [enQuestions, setEnQuestions] = useState(null);
  const [bnQuestions, setBnQuestions] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [step, setStep] = useState('input');

  const handleParseEn = () => {
    if (!enInput.trim()) { alert('Paste English markdown first.'); return; }
    const parsed = parseCQFromMD(enInput, 'en');
    if (parsed.length === 0) { alert('No CQ questions could be parsed from English text. Check format.'); return; }
    setEnQuestions(parsed);
    alert(`Parsed ${parsed.length} English CQ questions.`);
  };

  const handleParseBn = () => {
    if (!bnInput.trim()) { alert('Paste Bangla markdown first.'); return; }
    const parsed = parseCQFromMD(bnInput, 'bn');
    if (parsed.length === 0) { alert('No CQ questions could be parsed from Bangla text. Check format.'); return; }
    setBnQuestions(parsed);
    alert(`Parsed ${parsed.length} Bangla CQ questions.`);
  };

  const handleAssignConfirm = async (mergedQuestions) => {
    setIsUploading(true);
    setProgress({ current: 0, total: mergedQuestions.length });

    try {
      await batchAddQuestions(mergedQuestions, (current, total) => {
        setProgress({ current, total });
      });
      const enCount = mergedQuestions.filter(q => q.language === 'en').length;
      const bnCount = mergedQuestions.length - enCount;
      alert(`Uploaded ${mergedQuestions.length} questions (EN: ${enCount}, BN: ${bnCount})`);
      navigate('/bank');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Check console.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenAssigner = () => {
    if (!enQuestions && !bnQuestions) {
      alert('Parse at least one set of questions first.');
      return;
    }
    const enCount = enQuestions?.length || 0;
    const bnCount = bnQuestions?.length || 0;
    if (enCount > 0 && bnCount > 0 && enCount !== bnCount) {
      const ok = window.confirm(
        `Count mismatch: ${enCount} English vs ${bnCount} Bangla. Continue?`
      );
      if (!ok) return;
    }
    setStep('assign');
  };

  if (step === 'assign') {
    const combined = [];
    if (enQuestions) combined.push(...enQuestions.map(q => ({ ...q, language: 'en' })));
    if (bnQuestions) combined.push(...bnQuestions.map(q => ({ ...q, language: 'bn' })));

    return (
      <div className="panel">
        <h2>Assign Images to Questions</h2>
        <CQMDImageAssigner
          rawMD={enInput || bnInput}
          questions={combined}
          onConfirm={handleAssignConfirm}
          onCancel={() => setStep('input')}
        />
        {isUploading && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 10000
          }}>
            <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '10px', minWidth: '400px', textAlign: 'center' }}>
              <h3>Uploading Questions...</h3>
              <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '15px 0', color: '#27ae60' }}>
                {progress.current} / {progress.total}
              </div>
              <div style={{ width: '100%', height: '30px', backgroundColor: '#e0e0e0', borderRadius: '15px', overflow: 'hidden' }}>
                <div style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  height: '100%', backgroundColor: '#27ae60', transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Import CQ from Markdown</h2>
      <p>
        Paste the markdown content from the new format service. After parsing, open the visual assigner to manually place images from the markdown into question slots.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3>English Markdown</h3>
          <textarea
            value={enInput}
            onChange={e => setEnInput(e.target.value)}
            placeholder="Paste English CQ markdown here..."
            style={{ minHeight: '300px', width: '100%', boxSizing: 'border-box' }}
          />
          <button onClick={handleParseEn} disabled={!enInput.trim()}>
            Parse English
          </button>
          {enQuestions && (
            <p style={{ color: '#27ae60', fontWeight: 'bold' }}>
              {enQuestions.length} English CQ questions ready
            </p>
          )}
        </div>
        <div>
          <h3>Bangla Markdown</h3>
          <textarea
            value={bnInput}
            onChange={e => setBnInput(e.target.value)}
            placeholder="Paste Bangla CQ markdown here..."
            style={{ minHeight: '300px', width: '100%', boxSizing: 'border-box' }}
          />
          <button onClick={handleParseBn} disabled={!bnInput.trim()}>
            Parse Bangla
          </button>
          {bnQuestions && (
            <p style={{ color: '#27ae60', fontWeight: 'bold' }}>
              {bnQuestions.length} Bangla CQ questions ready
            </p>
          )}
        </div>
      </div>

      {(enQuestions || bnQuestions) && (
        <div style={{ margin: '20px 0', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '8px', border: '1px solid #b3d9ff' }}>
          <h3>Summary</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #3498db' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>English</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Bangla</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Board</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Stem Img</th>
                <th style={{ padding: '8px', textAlign: 'left' }}>Part Images</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({
                length: Math.max(
                  enQuestions?.length || 0,
                  bnQuestions?.length || 0
                )
              }).map((_, i) => {
                const enQ = enQuestions?.[i];
                const bnQ = bnQuestions?.[i];
                const partImgs = (enQ?.parts || []).filter(p => p.answerImage).length;
                const imgIndicator = enQ?.image ? '✓' : (bnQ?.image ? '✓' : '—');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px' }}>Q{i + 1}</td>
                    <td style={{ padding: '6px' }}>{enQ ? '✓' : '—'}</td>
                    <td style={{ padding: '6px' }}>{bnQ ? '✓' : '—'}</td>
                    <td style={{ padding: '6px', fontSize: '13px' }}>{enQ?.board || bnQ?.board || '—'}</td>
                    <td style={{ padding: '6px', color: enQ?.image ? '#27ae60' : '#999' }}>{imgIndicator}</td>
                    <td style={{ padding: '6px', color: partImgs > 0 ? '#8e44ad' : '#999' }}>
                      {partImgs > 0 ? `${partImgs}/4` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleOpenAssigner}
          disabled={!enQuestions && !bnQuestions}
          style={{ backgroundColor: '#8e44ad', color: 'white', padding: '12px 30px', fontSize: '16px' }}
        >
          Assign Images
        </button>
        <button
          className="danger"
          onClick={() => { setEnInput(''); setBnInput(''); setEnQuestions(null); setBnQuestions(null); }}
          disabled={isUploading}
        >
          Clear All
        </button>
      </div>

      {enQuestions && enQuestions.length > 0 && (
        <details style={{ marginTop: '20px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
            Preview First English Question
          </summary>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(enQuestions[0], null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
