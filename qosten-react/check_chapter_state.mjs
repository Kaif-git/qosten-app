const API = 'https://questions-api.edventure.workers.dev';

async function fetchAllBySubject(subject) {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,chapter,type'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  return all;
}

async function main() {
  const subjects = ['Physics', 'Chemistry', 'Biology', 'Higher Mathematics', 'রসায়ন'];
  for (const subj of subjects) {
    const all = await fetchAllBySubject(subj);
    const byCh = {};
    for (const q of all) {
      const c = q.chapter || '(no chapter)';
      if (!byCh[c]) byCh[c] = {total:0, mcq:0, cq:0, sq:0};
      byCh[c].total++;
      byCh[c][q.type || 'unknown']++;
    }
    console.log('\n=== '+subj+' ('+all.length+' total) ===');
    for (const [ch, counts] of Object.entries(byCh).sort()) {
      console.log('  '+counts.total+'q ['+counts.mcq+' mcq, '+counts.cq+' cq, '+counts.sq+' sq]  '+ch);
    }
  }
}
main().catch(console.error);
