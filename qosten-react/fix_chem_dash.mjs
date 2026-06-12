const API = 'https://questions-api.edventure.workers.dev';
const OLD = 'খনিজ সম্পদ: ধাতু-অধাতু';
const NEW = 'খনিজ সম্পদ: ধাতু- অধাতু';

async function main() {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'রসায়ন', limit:'500', page:String(page), fields:'id,chapter,type,language'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  const toUpdate = all.filter(q => q.chapter === OLD);
  console.log(`Found ${toUpdate.length} questions with "${OLD}"`);
  
  let done = 0, fail = 0;
  for (const q of toUpdate) {
    const body = { ...q, chapter: NEW };
    const r = await fetch(`${API}/questions/${q.id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    if (r.ok) done++; else { fail++; console.log(`  ❌ #${q.id}: ${r.status}`); }
  }
  console.log(`Done: ${done} renamed, ${fail} failed`);
}
main().catch(console.error);
