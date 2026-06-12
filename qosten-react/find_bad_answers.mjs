const API = 'https://questions-api.edventure.workers.dev';

async function fetchAllBySubject(subject) {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,subject,chapter,type,question_text,parts,solution,explanation,correct_answer,options,language'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  return all;
}

const BAD_PATTERNS_EN = [
  /answer\s*(is\s+)?not\s+provided/i,
  /no\s+answer\s+provided/i,
  /answer\s+not\s+given/i,
  /answer\s+not\s+available/i,
  /not\s+provided/i,
  /no\s+solution/i,
  /no\s+explanation/i,
  /n\/a/i,
  /^\.\.\.$/,
  /^\s*\.\s*$/,
  /^\s*[-–—]+\s*$/,
];

const BAD_PATTERNS_BN = [
  /উত্তর\s*(দেওয়া\s*)?নেই/i,
  /উত্তর\s*দেয়া\s*নাই/i,
  /উত্তর\s*প্রদান\s*করা\s*হয়নি/i,
  /কোনো\s*উত্তর\s*নেই/i,
  /সমাধান\s*নেই/i,
  /ব্যাখ্যা\s*নেই/i,
];

function isBadText(text) {
  if (!text || text.trim().length < 20) return 'too short';
  for (const pat of BAD_PATTERNS_EN) if (pat.test(text)) return 'en pattern';
  for (const pat of BAD_PATTERNS_BN) if (pat.test(text)) return 'bn pattern';
  return null;
}

async function main() {
  const subjects = ['Biology', 'Higher Mathematics', 'Physics', 'Chemistry', 'বাংলা', 'English', 'Higher Mathematics (ICGSE)', 'Chemistry (ICGSE)', 'Physics (IGCSE)', 'Biology (ICGSE)', 'ICT', 'BGS', 'Islam & Religion'];
  
  for (const subj of subjects) {
    console.log('\n=== '+subj+' ===');
    const all = await fetchAllBySubject(subj);
    // Focus on CQ type
    const cqs = all.filter(q => q.type === 'cq');
    console.log('Total: '+all.length+', CQs: '+cqs.length);
    let found = 0;
    for (const q of cqs) {
      // Check solution and explanation
      let reason = null;
      if (q.solution) reason = isBadText(typeof q.solution === 'object' ? JSON.stringify(q.solution) : q.solution);
      if (!reason && q.explanation) reason = isBadText(typeof q.explanation === 'object' ? JSON.stringify(q.explanation) : q.explanation);
      if (!reason && q.correct_answer) reason = isBadText(typeof q.correct_answer === 'object' ? JSON.stringify(q.correct_answer) : q.correct_answer);
      
      if (reason) {
        found++;
        const textSnippet = (q.question_text || '').slice(0, 80).replace(/\n/g, ' ');
        const solSnippet = (typeof q.solution === 'object' ? JSON.stringify(q.solution) : (q.solution || '')).slice(0, 120).replace(/\n/g, ' ');
        console.log('  BAD ['+reason+'] ID='+q.id+' ch="'+q.chapter+'" question="'+textSnippet+'"');
        console.log('    solution: '+solSnippet);
      }
    }
    if (found === 0) console.log('  No bad answers found');
  }
}
main().catch(console.error);
