const API = 'https://questions-api.edventure.workers.dev';
async function main() {
  // Check old chapter name still exists
  for (const ch of ['তড়িৎ প্রবাহ', 'বর্তমান বিদ্যুৎ']) {
    const r = await fetch(API+'/questions?subject='+encodeURIComponent('পদার্থবিজ্ঞান')+'&chapter='+encodeURIComponent(ch)+'&limit=1&fields=id');
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    console.log('"'+ch+'": '+(b.length > 0 ? b.length+' results (first page)' : '0 results'));
  }
  // Full count of all chapters
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'পদার্থবিজ্ঞান', limit:'500', page:String(page), fields:'id,chapter'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  const cnt = {}; for (const q of all) { const c=q.chapter; if(!cnt[c]) cnt[c]=0; cnt[c]++; }
  console.log('\nAll BN chapters:');
  for (const [c,n] of Object.entries(cnt).sort()) console.log('  '+c+': '+n);
}
main().catch(console.error);
