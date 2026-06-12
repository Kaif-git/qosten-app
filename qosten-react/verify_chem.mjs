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
  const ch = {};
  for (const q of all) { const c = q.chapter; if(!ch[c]) ch[c]=0; ch[c]++; }
  
  const CONST_BN = [
    'রসায়নের ধারণা', 'পদার্থের অবস্থা', 'পদার্থের গঠন',
    'পর্যায় সারণি', 'রাসায়নিক বন্ধন', 'মোলের ধারণা ও রাসায়নিক গণনা',
    'রাসায়নিক বিক্রিয়া', 'রসায়ন ও শক্তি', 'অ্যাসিড-ক্ষার ভারসাম্য',
    'খনিজ সম্পদ: ধাতু- অধাতু', 'খনিজ সম্পদ: জীবাশ্ম',
    'আমাদের জীবনে রসায়ন', 'পৃথিবীর রসায়ন ও খনিজ'
  ];
  
  console.log('=== রসায়ন BN final ===');
  for (const [c,n] of Object.entries(ch).sort()) {
    const match = CONST_BN.find(x => x.normalize('NFC') === c.normalize('NFC'));
    console.log((match?'✅':'⚠️ EXTRA')+' "'+c+'": '+n);
  }
  console.log('\n=== Missing from API ===');
  for (const c of CONST_BN) {
    if (!Object.keys(ch).find(k => k.normalize('NFC') === c.normalize('NFC'))) console.log('❌ '+c);
  }
}
main().catch(console.error);
