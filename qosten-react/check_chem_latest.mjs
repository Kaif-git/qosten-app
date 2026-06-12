const API = 'https://questions-api.edventure.workers.dev';
async function main() {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'রসায়ন', limit:'500', page:String(page), fields:'id,chapter'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  const byCh = {};
  for (const q of all) { const c = q.chapter; if(!byCh[c]) byCh[c] = 0; byCh[c]++; }
  console.log('Chemistry BN: '+all.length+' total');
  for (const [c,n] of Object.entries(byCh).sort()) {
    console.log('  '+n+'x  '+c);
  }
}
main().catch(console.error);
