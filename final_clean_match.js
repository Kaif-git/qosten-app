const fs = require('fs');
const path = require('path');

const backupDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\BACKUP_CQ_FILES';
const outDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ';
const bd = '০১২৩৪৫৬৭৮৯';
const ed = '0123456789';
const toEn = s => { let r=''; for(const c of s){const i=bd.indexOf(c);r+=i>=0?ed[i]:c;} return r; };

// ========== STEP 1: Parse all questions from Bangla backup ==========
let banRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_BANGLA.txt'), 'utf-8');
let norm = banRaw
  .replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2')
  .replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const blocks = norm.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

function parseQuestion(text) {
  text = text.trim();
  const isOld = /^প্রশ্ন/.test(text);
  if (!isOld && !/^Question/.test(text)) return null;

  const ui = text.indexOf('উত্তর:');
  const ai = text.indexOf('Answer:');
  const splitPos = ui >= 0 && ai >= 0 ? Math.min(ui, ai) : ui >= 0 ? ui : ai >= 0 ? ai : -1;
  if (splitPos < 0) return null;

  const qp = text.substring(0, splitPos);
  const ap = text.substring(splitPos + (splitPos === ui ? 5 : 7));

  let qn;
  if (isOld) {
    const m = qp.match(/প্রশ্ন\s*([০-৯]+):/);
    if (!m) return null;
    qn = parseInt(toEn(m[1]));
  } else {
    qn = parseInt(text.split('\n')[0].match(/\d+/)[0]);
  }

  const attrs = {};
  const ar = /\[([^\]]+)\]/g;
  let m;
  while ((m = ar.exec(qp)) !== null) {
    const t = m[1];
    const ci = t.indexOf(':');
    if (ci > 0) attrs[t.substring(0, ci).trim()] = t.substring(ci + 1).trim();
  }

  let stemText = qp.replace(/প্রশ্ন\s*[০-৯]+:/, '').replace(/Question\s+\d+:/, '').replace(/\[([^\]]+)\]/g, '').trim();
  stemText = stemText.replace(/^স্টেম:/, '').replace(/^Stem:/, '').replace(/^মূল প্রশ্ন:/, '').trim();

  const aqi = stemText.indexOf('A. ');
  const bqi = stemText.indexOf('B. ');
  const cqi = stemText.indexOf('C. ');
  if (aqi < 0 || bqi < 0 || cqi < 0) return null;

  const parts = {
    stem: stemText.substring(0, aqi).trim(),
    A: stemText.substring(aqi, bqi).trim(),
    B: stemText.substring(bqi, cqi).trim(),
    C: stemText.substring(cqi).trim()
  };

  let ansText = ap.trim();
  const aai = ansText.indexOf('A. ');
  const abi = ansText.indexOf('B. ');
  const aci = ansText.indexOf('C. ');
  if (aai < 0 || abi < 0 || aci < 0) return null;

  const answers = {
    A: ansText.substring(aai, abi).trim(),
    B: ansText.substring(abi, aci).trim(),
    C: ansText.substring(aci).trim()
  };

  return { qn, attrs, parts, answers, board: attrs['Board'] || attrs['বোর্ড'] || 'Unknown' };
}

const banQuestions = [];
for (const block of blocks) {
  const q = parseQuestion(block);
  if (q) banQuestions.push(q);
}
console.log(`Bangla: ${banQuestions.length} questions parsed`);

// ========== STEP 2: Parse all questions from English backup ==========
const engQuestions = [];
let engRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_ENGLISH.txt'), 'utf-8');

// English is all single-line, split by "Question N:"
const engBlocks = [];
const engSplit = engRaw.split(/(?=Question \d+:)/);
for (const block of engSplit) {
  const t = block.trim();
  if (!t || !t.startsWith('Question')) continue;

  const headerMatch = t.match(/Question (\d+):/);
  if (!headerMatch) continue;
  const qn = parseInt(headerMatch[1]);

  const ai = t.indexOf('Answer:');
  const splitPos = ai >= 0 ? ai : -1;
  if (splitPos < 0) continue;

  const qp = t.substring(0, splitPos);
  const ap = t.substring(splitPos + 7);

  const attrs = {};
  const ar = /\[([^\]]+)\]/g;
  let m;
  while ((m = ar.exec(qp)) !== null) {
    const tag = m[1];
    const ci = tag.indexOf(':');
    if (ci > 0) attrs[tag.substring(0, ci).trim()] = tag.substring(ci + 1).trim();
  }

  let stemText = qp.replace(/\[([^\]]+)\]/g, '').replace(/Question\s+\d+:/, '').trim();
  stemText = stemText.replace(/^Stem:/, '').trim();

  const aqi = stemText.indexOf('A. ');
  const bqi = stemText.indexOf('B. ');
  const cqi = stemText.indexOf('C. ');
  if (aqi < 0 || bqi < 0 || cqi < 0) continue;

  const parts = {
    stem: stemText.substring(0, aqi).trim(),
    A: stemText.substring(aqi, bqi).trim(),
    B: stemText.substring(bqi, cqi).trim(),
    C: stemText.substring(cqi).trim()
  };

  let ansText = ap.trim();
  const aai = ansText.indexOf('A. ');
  const abi = ansText.indexOf('B. ');
  const aci = ansText.indexOf('C. ');
  if (aai < 0 || abi < 0 || aci < 0) continue;

  const answers = {
    A: ansText.substring(aai, abi).trim(),
    B: ansText.substring(abi, aci).trim(),
    C: ansText.substring(aci).trim()
  };

  engQuestions.push({ qn, attrs, parts, answers, board: attrs['Board'] || 'Unknown' });
}

console.log(`English: ${engQuestions.length} questions parsed`);

// ========== STEP 3: Filter out instruction-text artifacts from English ==========
const badPatterns = [/Ensure subject/i, /Ensure chapter/i, /Ensure Board/i, /Check formatting/i,
  /Math tutor/i, /Extract CQ/i, /No vague filler/i, /Inline math/i, /specific layout/i,
  /One step per line/i, /Handle missing/i, /Verify and correct/i, /Beginner-friendly/i,
  /Self-Correction/i, /Final Check/i, /Panjeree/i, /Decision:/i, /source is empty/i,
  /is unreadable/i, /still extract/i, /Correct format/i, /I will list/i, /I'll stick/i,
  /to be safe/i, /Keep it/i, /images of a test paper/i, /No source/i, /Reference page/i];

const cleanEng = engQuestions.filter(q => {
  const full = [q.parts.stem, q.parts.A, q.parts.B, q.parts.C, q.answers.A, q.answers.B, q.answers.C].join(' ');
  return !badPatterns.some(p => p.test(full));
});
console.log(`English after cleaning: ${cleanEng.length}`);

// ========== STEP 4: Match questions by (qn, board) ==========
// Some have duplicate qn but different boards (2024 vs 2022 sets)
// Match on both qn AND board

function makeKey(q) {
  // Normalize board name
  let board = q.board.replace(/[\s-]/g, '').toLowerCase();
  // Handle Bengali board names  
  const boardMap = {
    'ঢাকাবোর্ড': 'dhaka', 'সিলেটবোর্ড': 'sylhet', 'বরিশালবোর্ড': 'barishal',
    'ময়মনসিংহবোর্ড': 'mymensingh', 'রাজশাহীবোর্ড': 'rajshahi', 'কুমিল্লাবোর্ড': 'cumilla',
    'চট্টগ্রামবোর্ড': 'chattogram', 'দিনাজপুরবোর্ড': 'dinajpur', 'যশোরবোর্ড': 'jashore',
    'মির্জাপুরক্যাডেটকলেজ': 'mirzapur', 'জয়পুরহাটগার্লস্ক্যাডেটকলেজ': 'joypurhat'
  };
  for (const [bn, en] of Object.entries(boardMap)) {
    if (board.includes(bn)) board = en;
  }
  return `${q.qn}|${board}`;
}

const banMap = new Map();
for (const q of banQuestions) {
  const key = makeKey(q);
  if (!banMap.has(key)) banMap.set(key, []);
  banMap.get(key).push(q);
}

const engMap = new Map();
for (const q of cleanEng) {
  const key = makeKey(q);
  if (!engMap.has(key)) engMap.set(key, []);
  engMap.get(key).push(q);
}

// Find common keys
const banKeys = new Set(banMap.keys());
const engKeys = new Set(engMap.keys());
const commonKeys = [...banKeys].filter(k => engKeys.has(k)).sort();

console.log(`\nCommon questions (matched by ID + Board): ${commonKeys.length}`);

// ========== STEP 5: Write matched files ==========
function fmtQuestion(q, lang) {
  const isBan = lang === 'bangla';
  let out = `Question ${String(q.qn).padStart(2, '0')}:\n`;
  const attrKeys = isBan
    ? { 'ID': q.attrs['ID'] || q.qn, 'বিষয়': q.attrs['Subject'] || q.attrs['বিষয়'] || '',
       'অধ্যায়': q.attrs['Chapter'] || q.attrs['অধ্যায়'] || '',
       'পাঠ': q.attrs['Lesson'] || q.attrs['পাঠ'] || '',
       'বোর্ড': q.attrs['Board'] || q.attrs['বোর্ড'] || '' }
    : { 'ID': q.attrs['ID'] || q.qn, 'Subject': q.attrs['Subject'] || q.attrs['বিষয়'] || '',
       'Chapter': q.attrs['Chapter'] || q.attrs['অধ্যায়'] || '',
       'Lesson': q.attrs['Lesson'] || q.attrs['পাঠ'] || '',
       'Board': q.attrs['Board'] || q.attrs['বোর্ড'] || '' };
  for (const [k, v] of Object.entries(attrKeys)) {
    if (v) out += `[${k}: ${v}]\n`;
  }
  out += `Stem: ${q.parts.stem}\n`;
  out += `${q.parts.A}\n`;
  out += `${q.parts.B}\n`;
  out += `${q.parts.C}\n`;
  out += `Answer:\n`;
  out += `${q.answers.A}\n`;
  out += `${q.answers.B}\n`;
  out += `${q.answers.C}`;
  return out;
}

let banOut = '';
let engOut = '';
for (const key of commonKeys) {
  const bq = banMap.get(key)[0];
  const eq = engMap.get(key)[0];
  banOut += fmtQuestion(bq, 'bangla') + '\n\n---\n\n';
  engOut += fmtQuestion(eq, 'english') + '\n\n---\n\n';
}
banOut = banOut.replace(/\n\n---\n\n$/, '').trim() + '\n';
engOut = engOut.replace(/\n\n---\n\n$/, '').trim() + '\n';

// Fix: remove any instruction-text that might still be in answer sections
const gibberish = [/Ensure subject[^\n]*/gi, /Ensure chapter[^\n]*/gi, /Ensure Board[^\n]*/gi,
  /Check formatting[^\n]*/gi, /Math tutor[^\n]*/gi, /Extract CQ[^\n]*/gi, /Panjeree[^\n]*/gi,
  /Final Check[^\n]*/gi, /No source[^\n]*/gi, /One step per line[^\n]*/gi,
  /Reference page[^\n]*/gi, /images of a test paper[^\n]*/gi, /Decision:[^\n]*/gi,
  /Handle missing[^\n]*/gi, /Correct errors[^\n]*/gi, /source is empty[^\n]*/gi,
  /specific layout[^\n]*/gi, /to be safe[^\n]*/gi, /I will list[^\n]*/gi,
  /I'll stick[^\n]*/gi];
for (const g of gibberish) { engOut = engOut.replace(g, ''); }

fs.writeFileSync(path.join(outDir, 'Ch3_CQ_BANGLA_new.txt'), banOut, 'utf-8');
fs.writeFileSync(path.join(outDir, 'Ch3_CQ_ENGLISH_new.txt'), engOut, 'utf-8');

console.log(`\n✓ Written to Ch3_CQ_BANGLA_new.txt (${(banOut.match(/^Question/gm) || []).length} questions)`);
console.log(`✓ Written to Ch3_CQ_ENGLISH_new.txt (${(engOut.match(/^Question/gm) || []).length} questions)`);

// Show what was matched
console.log('\nMatched questions:');
for (const key of commonKeys) {
  const bq = banMap.get(key)[0];
  const eq = engMap.get(key)[0];
  console.log(`  Q${String(bq.qn).padStart(2,' ')} | ${bq.board.padEnd(30)} | ${eq.board}`);
}
