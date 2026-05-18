import React, { useState } from 'react';

export default function ProcessChapterModal({ isOpen, onClose, subject, questions }) {
  const [copiedButtons, setCopiedButtons] = useState(new Set());

  if (!isOpen) return null;

  const chapterData = {};
  questions.forEach(q => {
    if (q.subject !== subject) return;
    const chap = q.chapter || 'Uncategorized';
    if (!chapterData[chap]) {
      chapterData[chap] = { mcq: 0, cq: 0, sq: 0 };
    }
    const type = q.type?.toLowerCase() || 'other';
    if (chapterData[chap][type] !== undefined) {
      chapterData[chap][type]++;
    }
  });

  const handleCopy = (chap, type) => {
    const filtered = questions.filter(q => q.subject === subject && (q.chapter || 'Uncategorized') === chap && q.type?.toLowerCase() === type);
    
    const prompt = `Review these questions and return ONLY commands in this exact format (one per line):
ID delete
ID correct:a/b/c/d

Rules:
- Delete questions with missing context/stem (e.g., "What was Mr Rahim doing?" without prior story)
- Fix correct answer if explanation doesn't match current answer
- Use Question ID only, not question number
- No extra text, just the commands\n\n`;

    const questionsText = filtered.map((q, idx) => {
      let text = `[ID: ${q.id}]\n${idx + 1}. ${q.questionText || q.question || ''}\n`;
      if (type === 'mcq' && q.options) {
        q.options.forEach(opt => { text += `${opt.label}) ${opt.text}\n`; });
        text += `Ans: ${q.correctAnswer}\n`;
        if (q.explanation) text += `Explanation: ${q.explanation}\n`;
      } else if (type === 'cq' && q.parts) {
        q.parts.forEach(p => { text += `${p.letter}. ${p.text} (${p.marks})\nAns: ${p.answer}\n`; });
      } else if (type === 'sq') {
        text += `Ans: ${q.answer}\n`;
      }
      return text;
    }).join('\n---\n\n');
    
    navigator.clipboard.writeText(prompt + questionsText);
    
    const key = `${chap}-${type}`;
    setCopiedButtons(prev => new Set(prev).add(key));
    alert(`Copied ${filtered.length} ${type.toUpperCase()} from ${chap} to clipboard with instructions.`);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>Subject: {subject || 'All'}</h3>
        {Object.entries(chapterData).sort().map(([chap, counts]) => (
          <div key={chap} style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
            <strong>{chap}</strong>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              {['mcq', 'cq', 'sq'].map(type => (
                <button 
                  key={type} 
                  onClick={() => handleCopy(chap, type)} 
                  disabled={counts[type] === 0}
                  style={{ 
                    padding: '5px 10px', 
                    fontSize: '12px', 
                    cursor: counts[type] > 0 ? 'pointer' : 'default',
                    backgroundColor: copiedButtons.has(`${chap}-${type}`) ? '#ccc' : ''
                  }}
                >
                  {type.toUpperCase()} ({counts[type]})
                </button>
              ))}
            </div>
          </div>
        ))}
        <button onClick={onClose} style={{ marginTop: '20px', width: '100%', padding: '10px' }}>Close</button>
      </div>
    </div>
  );
}
