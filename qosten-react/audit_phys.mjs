const API = 'https://questions-api.edventure.workers.dev';
async function get(subj) {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:subj, limit:'500', page:String(page), fields:'id,chapter'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  const ch = {};
  for (const q of all) { const c = q.chapter||'(unknown)'; if(!ch[c]) ch[c]=0; ch[c]++; }
  return {total: all.length, chapters: ch};
}

// Constants for physics
const CONST_EN = [
  'Physical Quantities and Their Measurements',
  'Motion',
  'Force',
  'Work, Power and Energy',
  'State of Matter and Pressure',
  'Effect of Heat on Matter',
  'Waves and Sound',
  'Reflection of Light',
  'Refraction of Light',
  'Static Electricity',
  'Current Electricity',
  'Magnetic Effects of Current',
  'Modern Physics & Electronics',
  'Physics to Save Life',
];

const CONST_BN = [
  'ভৌত রাশি ও তাদের পরিমাপ',
  'গতি',
  'বল',
  'কাজ, ক্ষমতা ও শক্তি',
  'পদার্থের অবস্থা এবং চাপ',
  'পদার্থের উপর তাপের প্রভাব',
  'তরঙ্গ ও শব্দ',
  'আলোর প্রতিফলন',
  'আলোর প্রতিসরণ',
  'স্থির তড়িৎ',
  'বর্তমান বিদ্যুৎ',
  'কারেন্টের চৌম্বকীয় প্রভাব',
  'আধুনিক পদার্থবিদ্যা ও ইলেকট্রনিক্স',
  'জীবন বাঁচাতে পদার্থবিজ্ঞান',
];

function norm(s) {
  return s.normalize('NFC').replace(/[\s\u200c\u200d]/g, '').toLowerCase();
}

async function main() {
  const en = await get('Physics');
  const bn = await get('পদার্থবিজ্ঞান');
  
  console.log('=== Physics EN ('+en.total+'q, '+Object.keys(en.chapters).length+' chapters) ===');
  for (const [c,n] of Object.entries(en.chapters).sort()) console.log('  "'+c+'": '+n);
  console.log('\n=== পদার্থবিজ্ঞান BN ('+bn.total+'q, '+Object.keys(bn.chapters).length+' chapters) ===');
  for (const [c,n] of Object.entries(bn.chapters).sort()) console.log('  "'+c+'": '+n);

  console.log('\n=== EN match check ===');
  for (const c of CONST_EN) {
    const cn = norm(c);
    const found = Object.keys(en.chapters).find(k => norm(k) === cn);
    console.log((found?'✅':'❌')+' '+c+(found?' ('+en.chapters[found]+'q)':''));
  }
  console.log('\n=== BN match check ===');
  for (const c of CONST_BN) {
    const cn = norm(c);
    const found = Object.keys(bn.chapters).find(k => norm(k) === cn);
    console.log((found?'✅':'❌')+' '+c+(found?' ('+bn.chapters[found]+'q)':''));
  }
  console.log('\n=== Extra in API EN ===');
  for (const [c,n] of Object.entries(en.chapters)) {
    if (!CONST_EN.find(x => norm(x) === norm(c))) console.log('  "'+c+'": '+n);
  }
  console.log('\n=== Extra in API BN ===');
  for (const [c,n] of Object.entries(bn.chapters)) {
    if (!CONST_BN.find(x => norm(x) === norm(c))) console.log('  "'+c+'": '+n);
  }
}
main().catch(console.error);
