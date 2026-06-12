const API = 'https://questions-api.edventure.workers.dev';
async function get(subj) {
  const all = [];
  let page = 0;
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

const CONST_EN = [
  'Concepts of Chemistry',
  'States of Matter',
  'Structure of Matter',
  'Periodic Table',
  'Chemical Bond',
  'Concept of Mole and Chemical Counting',
  'Chemical Reactions',
  'Chemistry and Energy',
  'Acid-Base Balance',
  'Mineral Resources: Metal-Nonmetal',
  'Mineral Resources: Fossils',
  'Chemistry in Our Lives',
  'Chemistry of Earth and Minerals',
];

const CONST_BN = [
  '우리 জীবনের রসায়ন',
  'পদার্থের অবস্থা',
  'পদার্থের গঠন',
  'পর্যায় সারণি',
  'রাসায়নিক বন্ধন',
  'মোলের ধারণা ও রাসায়নিক গণনা',
  'রাসায়নিক বিক্রিয়া',
  'রসায়ন ও শক্তি',
  'অ্যাসিড-ক্ষার ভারসাম্য',
  'খনিজ সম্পদ: ধাতু- অধাতু',
  'খনিজ সম্পদ: জীবাশ্ম',
  'আমাদের জীবনে রসায়ন',
  'পৃথিবীর রসায়ন ও খনিজ',
];

function norm(s) {
  return s.normalize('NFC').replace(/[\s\u200c\u200d]/g, '').toLowerCase();
}

async function main() {
  const en = await get('Chemistry');
  const bn = await get('রসায়ন');
  console.log('=== Chemistry EN ('+en.total+'q, '+Object.keys(en.chapters).length+' chapters) ===');
  for (const [c,n] of Object.entries(en.chapters).sort()) console.log('  "'+c+'": '+n);
  console.log('\n=== রসায়ন BN ('+bn.total+'q, '+Object.keys(bn.chapters).length+' chapters) ===');
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

  console.log('\n=== Extra in EN API ===');
  for (const [c,n] of Object.entries(en.chapters)) {
    const cn = norm(c);
    if (!CONST_EN.find(x => norm(x) === cn)) console.log('  "'+c+'": '+n);
  }
  console.log('\n=== Extra in BN API ===');
  for (const [c,n] of Object.entries(bn.chapters)) {
    const cn = norm(c);
    if (!CONST_BN.find(x => norm(x) === cn)) console.log('  "'+c+'": '+n);
  }
}
main().catch(console.error);
