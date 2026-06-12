const API = 'https://questions-api.edventure.workers.dev';

const RENAME_MAP = {
  'পর্যায় সারণী': 'পর্যায় সারণি',
};

async function main() {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'রসায়ন', limit:'500', page:String(page), fields:'id,chapter,question_text,type,options,correct_answer,parts,solution,explanation,language,is_flagged,is_quizzable,difficulty,board,tags,lesson,is_premium,image,answer'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  for (const [oldN, newN] of Object.entries(RENAME_MAP)) {
    const toUpdate = all.filter(q => q.chapter === oldN);
    console.log('Found '+toUpdate.length+' with "'+oldN+'"');
    let done = 0, fail = 0;
    for (const q of toUpdate) {
      const body = { ...q, chapter: newN };
      const r = await fetch(`${API}/questions/${q.id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      if (r.ok) { done++; if (done % 20 === 0) console.log('  '+done+'/'+toUpdate.length); }
      else { fail++; console.log('  FAIL #'+q.id+': '+r.status); }
    }
    console.log('  Result: '+done+' renamed, '+fail+' failed');
  }
}
main().catch(console.error);
