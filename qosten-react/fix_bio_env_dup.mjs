// Merge duplicate "Environment of life" (lowercase l) → "Environment of Life" in Biology EN
const API = 'https://questions-api.edventure.workers.dev';
const OLD = 'Environment of life';
const NEW = 'Environment of Life';

async function fetchAll(subject) {
  const all = [];
  let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,chapter,type,language'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  return all;
}

async function main() {
  console.log('Fetching Biology questions...');
  const all = await fetchAll('Biology');
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
    if (r.ok) { done++; if (done % 30 === 0) console.log(`  ${done}/${toUpdate.length}`); }
    else { fail++; console.log(`  ❌ #${q.id}: ${r.status}`); }
  }
  console.log(`\nDone: ${done} merged, ${fail} failed`);
}
main().catch(console.error);
