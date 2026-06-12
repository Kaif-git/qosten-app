// Final audit: Compare constants vs API for Mathematics (EN) and গণিত (BN)
const API = 'https://questions-api.edventure.workers.dev';

async function fetchAll(subject) {
  const all = [];
  let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,chapter'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b);
    page++;
    if (b.length < 500) break;
  }
  const chapters = {};
  for (const q of all) {
    const c = q.chapter || '(unknown)';
    if (!chapters[c]) chapters[c] = 0;
    chapters[c]++;
  }
  return { total: all.length, chapters };
}

// Constants mathematics chapters
const CONST_MATH = [
  { s: 1,  en: 'Real Numbers',                                        bn: 'বাস্তব সংখ্যা' },
  { s: 2,  en: 'Set and Function',                                     bn: 'সেট ও ফাংশন' },
  { s: 3,  en: 'Algebraic Expression',                                 bn: 'বীজগাণিতিক রাশি' },
  { s: 4,  en: 'Exponents and Logarithms',                             bn: 'সূচক ও লগারিদম' },
  { s: 5,  en: 'Equations in One Variable',                            bn: 'এক চলকের সমীকরণ' },
  { s: 6,  en: 'Lines, Angles and Triangles',                          bn: 'রেখা, কোণ ও ত্রিভুজ' },
  { s: 7,  en: 'Practical Geometry',                                   bn: 'ব্যবহারিক জ্যামিতি' },
  { s: 8,  en: 'Circle',                                               bn: 'বৃত্ত' },
  { s: 9,  en: 'Trigonometric Ratio',                                  bn: 'ত্রিকোণমিতিক অনুপাত' },
  { s: 10, en: 'Distance and Elevation',                               bn: 'দূরত্ব ও উন্নতি কোণ' },
  { s: 11, en: 'Algebraic Ratio and Proportion',                      bn: 'বীজগাণিতিক অনুপাত ও সমানুপাত' },
  { s: 12, en: 'Simple Simultaneous Equations in Two Variables',      bn: 'সরল সহসমীকরণ' },
  { s: 13, en: 'Finite Series',                                        bn: 'সসীম ধারা' },
  { s: 14, en: 'Ratio, Similarity and Symmetry',                      bn: 'অনুপাত, সাদৃশ্য এবং প্রতিসাম্য' },
  { s: 15, en: 'Area Related Theorems and Constructions',              bn: 'ক্ষেত্রফল সম্পর্কিত উপপাদ্য ও অঙ্কন' },
  { s: 16, en: 'Mensuration',                                          bn: 'পরিমিতি' },
];

function norm(s) {
  return s.normalize('NFC').replace(/[\s\u200c\u200d]/g, '').toLowerCase();
}

async function main() {
  const enApi = await fetchAll('Mathematics');
  const bnApi = await fetchAll('গণিত');

  console.log('=== CONSTANTS (16 chapters) ===');
  console.log('=== API Mathematics EN (' + enApi.total + ' questions, ' + Object.keys(enApi.chapters).length + ' chapters) ===');
  console.log('=== API গণিত BN (' + bnApi.total + ' questions, ' + Object.keys(bnApi.chapters).length + ' chapters) ===\n');

  for (const ch of CONST_MATH) {
    const enNorm = norm(ch.en);
    const bnNorm = norm(ch.bn);

    // Find in EN API
    const enMatch = Object.keys(enApi.chapters).find(k => norm(k) === enNorm);
    const enQ = enMatch ? enApi.chapters[enMatch] : 0;

    // Find in BN API
    const bnMatch = Object.keys(bnApi.chapters).find(k => norm(k) === bnNorm);
    const bnQ = bnMatch ? bnApi.chapters[bnMatch] : 0;

    const enStatus = enQ ? `✅ ${enQ} questions` : '❌ MISSING';
    const bnStatus = bnQ ? `✅ ${bnQ} questions` : (ch.s === 12 ? '❌ MISSING (user will upload)' : '❌ MISSING');

    console.log(`  ${ch.s}. ${ch.en}`);
    console.log(`     EN: ${enStatus}`);
    console.log(`     BN: ${bnStatus}`);
    console.log('');
  }

  // Check for extra chapters in API that aren't in constants
  console.log('=== EXTRA chapters in API (not in constants) ===');
  for (const [ch, count] of Object.entries(enApi.chapters)) {
    if (!CONST_MATH.find(c => norm(c.en) === norm(ch))) {
      console.log(`  EN extra: "${ch}" — ${count} questions`);
    }
  }
  for (const [ch, count] of Object.entries(bnApi.chapters)) {
    if (!CONST_MATH.find(c => norm(c.bn) === norm(ch))) {
      console.log(`  BN extra: "${ch}" — ${count} questions`);
    }
  }
}

main().catch(console.error);
