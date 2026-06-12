import fs from 'fs';
const h = JSON.parse(fs.readFileSync('hierarchy_api.json', 'utf8'));

const bn1 = h.find(s => s.name === 'বাংলা প্রথম পত্র');
console.log('=== BANGLA 1 (' + bn1.chapters.length + ' chapters) ===');
bn1.chapters.forEach((c, i) => console.log((i+1) + '. ' + JSON.stringify(c.name)));

const bn2 = h.find(s => s.name === 'বাংলা দ্বিতীয় পত্র');
console.log('\n=== BANGLA 2 (' + bn2.chapters.length + ' chapters) ===');
bn2.chapters.forEach((c, i) => console.log((i+1) + '. ' + JSON.stringify(c.name)));

const pairs = [
  ['জীববিজ্ঞান', 'Biology'],
  ['বাংলাদেশ ও বিশ্বপরিচয়', 'Bangladesh and Global Studies'],
  ['পদার্থবিজ্ঞান', 'Physics'],
  ['উচ্চতর গণিত', 'Higher Mathematics'],
  ['গণিত', 'Mathematics'],
  ['রসায়ন', 'Chemistry'],
  ['তথ্য ও যোগাযোগ প্রযুক্তি', 'Information and Communication Technology'],
];

for (const [bnName, enName] of pairs) {
  const bnSub = h.find(s => s.name === bnName);
  const enSub = h.find(s => s.name === enName);
  console.log('\n=== ' + bnName + ' (' + bnSub.chapters.length + ' BN) vs ' + enName + ' (' + (enSub?enSub.chapters.length:'?') + ' EN) ===');
  const maxLen = Math.max(bnSub.chapters.length, enSub ? enSub.chapters.length : 0);
  for (let i = 0; i < maxLen; i++) {
    const bn = i < bnSub.chapters.length ? bnSub.chapters[i].name : '';
    const en = enSub && i < enSub.chapters.length ? enSub.chapters[i].name : '';
    console.log('  BN: ' + JSON.stringify(bn) + '  EN: ' + JSON.stringify(en));
  }
}
