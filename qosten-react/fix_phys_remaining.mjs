const API = 'https://questions-api.edventure.workers.dev';
const OLD = 'তড়িৎ প্রবাহ';
const NEW = 'বর্তমান বিদ্যুৎ';

async function main() {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'পদার্থবিজ্ঞান', limit:'500', page:String(page), fields:'id,chapter,question_text,type,options,correct_answer,parts,solution,explanation,language,is_flagged,is_quizzable,difficulty,board,tags,lesson,is_premium,image,answer'});
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
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    if (r.ok) done++; else { fail++; console.log(`  ❌ #${q.id}: ${r.status}`); }
  }
  console.log(`Done: ${done} renamed, ${fail} failed`);
}
main().catch(console.error);
