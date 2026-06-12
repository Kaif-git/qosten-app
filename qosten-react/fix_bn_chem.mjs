// Rename 3 API BN রসায়ন chapters to match constants
const API = 'https://questions-api.edventure.workers.dev';

const RENAME_MAP = {
  'পর্যায় সারণী': 'পর্যায় সারণি',
  'মোল এবং রাসায়নিক গণনার ধারণা': 'মোলের ধারণা ও রাসায়নিক গণনা',
  'আমাদের জীবনে রসায়ন': 'আমাদের জীবনে রসায়ন',
};

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
  console.log('Fetching রসায়ন questions...');
  const all = await fetchAll('রসায়ন');
  
  for (const [oldName, newName] of Object.entries(RENAME_MAP)) {
    const toUpdate = all.filter(q => q.chapter === oldName);
    console.log(`\n"${oldName}" → "${newName}": ${toUpdate.length} questions`);
    
    let done = 0, fail = 0;
    for (const q of toUpdate) {
      const body = { ...q, chapter: newName };
      const r = await fetch(`${API}/questions/${q.id}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      if (r.ok) done++;
      else { fail++; console.log(`  ❌ #${q.id}: ${r.status}`); }
    }
    console.log(`  Result: ${done} renamed, ${fail} failed`);
  }
}
main().catch(console.error);
