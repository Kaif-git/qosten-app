const API = 'https://questions-api.edventure.workers.dev';

const BAD_PATTERNS = [
  /answer\s*(is\s+)?not\s+provided/i,
  /no\s+answer\s+provided/i,
  /answer\s+not\s+given/i,
  /answer\s+not\s+available/i,
  /not\s+provided/i,
  /no\s+solution/i,
  /no\s+explanation/i,
  /n\/a/i,
  /উত্তর\s*(দেওয়া\s*)?নেই/i,
  /উত্তর\s*দেয়া\s*নাই/i,
  /উত্তর\s*প্রদান\s*করা\s*হয়নি/i,
  /কোনো\s*উত্তর\s*নেই/i,
  /সমাধান\s*নেই/i,
  /ব্যাখ্যা\s*নেই/i,
  /^\.\.\.$/m,
  /^\s*[-–—]+\s*$/,
];

function isBadAnswer(text) {
  if (!text) return 'empty';
  const t = text.trim();
  if (t.length < 40) return 'too short ('+t.length+' chars)';
  for (const pat of BAD_PATTERNS) if (pat.test(t)) return 'bad pattern';
  return null;
}

async function fetchAllBySubject(subject) {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,subject,chapter,type,question_text,parts,solution,explanation,correct_answer,language'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  return all;
}

async function main() {
  const subjects = ['Biology', 'Higher Mathematics', 'Physics', 'Chemistry', 'রসায়ন'];
  
  for (const subj of subjects) {
    console.log('\n=== '+subj+' ===');
    const all = await fetchAllBySubject(subj);
    const cqs = all.filter(q => q.type === 'cq');
    console.log('Total: '+all.length+', CQs: '+cqs.length);
    let badC = 0, badD = 0;
    for (const q of cqs) {
      let parts;
      try { parts = JSON.parse(q.parts); } catch(e) { continue; }
      if (!Array.isArray(parts)) continue;
      for (const p of parts) {
        if (!p.letter) continue;
        const letter = p.letter.toUpperCase();
        if (letter !== 'C' && letter !== 'D') continue;
        const reason = isBadAnswer(p.answer);
        if (reason) {
          if (letter === 'C') badC++;
          else badD++;
          const textSnippet = (p.text || '').slice(0, 60).replace(/\n/g, ' ');
          const ansSnippet = (p.answer || '').slice(0, 100).replace(/\n/g, ' ');
          console.log('  Part '+letter+' ID='+q.id+' ['+reason+']');
          console.log('    Q: '+textSnippet);
          console.log('    A: '+ansSnippet);
        }
      }
    }
    console.log('Summary: bad C='+badC+', bad D='+badD);
  }
}
main().catch(console.error);
