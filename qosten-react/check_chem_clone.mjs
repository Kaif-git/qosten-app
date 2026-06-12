const API = 'https://questions-api.edventure.workers.dev';
async function main() {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'রসায়ন', limit:'500', page:String(page), fields:'id,chapter,type'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  const byCh = {};
  for (const q of all) {
    const c = q.chapter;
    if (!byCh[c]) byCh[c] = [];
    byCh[c].push(q.id);
  }
  for (const [c, ids] of Object.entries(byCh).sort()) {
    console.log(c+': '+ids.length+' questions');
  }
  // Check for overlapping IDs between chapters
  const chapters = Object.keys(byCh);
  for (let i = 0; i < chapters.length; i++) {
    for (let j = i+1; j < chapters.length; j++) {
      const overlap = byCh[chapters[i]].filter(id => byCh[chapters[j]].includes(id));
      if (overlap.length > 0) {
        console.log('OVERLAP: "'+chapters[i]+'" <-> "'+chapters[j]+'": '+overlap.length+' IDs');
        console.log('  IDs: '+overlap.slice(0,5).join(', ')+'...');
      }
    }
  }
  // Check for duplicate IDs within same chapter
  for (const [c, ids] of Object.entries(byCh)) {
    const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
    if (dupes.length > 0) console.log('DUPLICATE IDs in "'+c+'": '+dupes.length);
  }
  console.log('\nDone.');
}
main().catch(console.error);
