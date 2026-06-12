const API = 'https://questions-api.edventure.workers.dev';

function isBadAnswer(text) {
  if (!text || !text.trim()) return 'empty';
  const t = text.trim();
  if (t.length < 15) return 'too short ('+t.length+' chars)';
  // Exact match patterns for "no answer" statements
  const badExact = [
    '[No answer provided in source]',
    '[No answer provided in source] [Ans.]',
    '[উৎস থেকে কোনো উত্তর প্রদান করা হয়নি]',
    '[উৎস থেকে কোনো উত্তর প্রদান করা হয়নি]',
    '[উৎসটিতে কোনো উত্তর প্রদান করা হয়নি]',
    '[উৎসটিতে কোনো উত্তর দেওয়া নেই]',
    '[উৎস দ্বারা কোনো উত্তর প্রদান করা হয়নি]',
    '[মূল উৎসে কোনো উত্তর দেওয়া নেই]',
    '---',
  ];
  if (badExact.includes(t)) return 'placeholder text';
  // Patterns
  const badPat = [
    /^\[No answer provided/i,
    /^\[উত্তর.*নেই/i,
    /^\[উৎস.*কোনো\s*উত্তর/i,
    /^\[মূল\s*উৎসে.*উত্তর\s*নেই/i,
    /^Element$/i,
    /^For compound ---/,
    /^Bohr's atomic model \(Figure/i,
    /^Bohr's model \(Figure/i,
    /^First, we identify elements A and/i,
    /^\s*\.\.\.\s*$/,
  ];
  for (const p of badPat) if (p.test(t)) return 'placeholder text';
  return null;
}

async function fetchAllCQs(subject) {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,subject,chapter,type,parts'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  return all.filter(q => q.type === 'cq');
}

async function main() {
  const subjects = ['Physics', 'Chemistry', 'Biology', 'Higher Mathematics', 'রসায়ন'];
  const toFlag = [];

  for (const subj of subjects) {
    console.log('\n=== '+subj+' ===');
    const cqs = await fetchAllCQs(subj);
    console.log('CQs found: '+cqs.length);
    for (const q of cqs) {
      let parts;
      try { parts = JSON.parse(q.parts); } catch(e) { continue; }
      if (!Array.isArray(parts)) continue;
      let badParts = [];
      for (const p of parts) {
        const letter = (p.letter||p.label||'').toUpperCase();
        if (letter !== 'C' && letter !== 'D') continue;
        const reason = isBadAnswer(p.answer);
        if (reason) badParts.push(letter);
      }
      if (badParts.length > 0) {
        toFlag.push({id: q.id, subject: subj, chapter: q.chapter, badParts: badParts.join(',')});
        console.log('  ID='+q.id+' ['+q.chapter+'] bad parts: '+badParts.join(','));
      }
    }
  }

  console.log('\n\n=========== '+toFlag.length+' questions to flag ===========');
  for (const f of toFlag) {
    console.log(f.id+','+f.subject+','+f.chapter+','+f.badParts);
  }
  console.log('\nTotal: '+toFlag.length);
}
main().catch(console.error);
