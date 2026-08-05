const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\';

const bd = '০১২৩৪৫৬৭৮৯';
const ed = '0123456789';
function toEn(s) {
  let r = '';
  for (const c of s) { const i = bd.indexOf(c); r += i >= 0 ? ed[i] : c; }
  return r;
}

// ========== BANGLA ==========
let ban = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');

// Split into sections by প্রশ্ন N: or Question N: headers
// Use a regex that matches either প্রশ্ন with Bengali digits or Question with English digits
const splitRegex = /(?=(?:^|\n)প্রশ্ন\s*[০-৯]+:)|(?=(?:^|\n)Question\s+\d+:)/;
let rawSections = ban.split(splitRegex).filter(s => s.trim());

console.log('Raw Bangla sections:', rawSections.length);

function parseBanglaSection(text) {
  text = text.trim();
  if (!text) return null;

  // Determine format
  let isOld = /প্রশ্ন\s*[০-৯]+:/.test(text);
  let isNew = /^Question\s+\d+:/.test(text);

  let qn, questionPart, answerPart;

  if (isOld) {
    // Old format: প্রশ্ন N:[ID: N]...[attrs...]স্টেম: ...A. ...B. ...C. ...উত্তর:A. ...B. ...C. ...
    const ui = text.indexOf('উত্তর:');
    if (ui < 0) return null;
    questionPart = text.substring(0, ui);
    answerPart = text.substring(ui + 5); // skip উত্তর:

    const qm = questionPart.match(/প্রশ্ন\s*([০-৯]+):/);
    if (!qm) return null;
    qn = toEn(qm[1]).padStart(2, '0');
  } else if (isNew) {
    // Already in Question N: format with newlines
    const lines = text.split('\n');
    qn = lines[0].replace('Question ', '').replace(':', '').trim().padStart(2, '0');

    const ansIdx = lines.findIndex(l => l.trim() === 'Answer:');
    if (ansIdx < 0) return null;
    questionPart = lines.slice(0, ansIdx).join('\n');
    answerPart = lines.slice(ansIdx + 1).join('\n');
  } else {
    return null;
  }

  // Extract attributes
  let attrs = [];
  let qp = questionPart;
  if (isOld) {
    const ar = /\[([^\]]+)\]/g;
    let m;
    while ((m = ar.exec(qp)) !== null) {
      const t = m[1];
      const ci = t.indexOf(':');
      attrs.push(ci > 0 ? t.substring(0, ci).trim() + ': ' + t.substring(ci + 1).trim() : t);
    }
    qp = qp.replace(/প্রশ্ন\s*[০-৯]+:/, '').replace(/\[([^\]]+)\]/g, '').trim();
    if (qp.startsWith('স্টেম:')) qp = qp.substring(5).trim();
  } else {
    // For new format, parse attributes and Stem
    const lines = qp.split('\n').map(l => l.trim()).filter(l => l);
    let i = 1; // skip first line (Question N:)
    while (i < lines.length && /^\[.*\]$/.test(lines[i])) {
      const t = lines[i].replace(/^\[|\]$/g, '');
      const ci = t.indexOf(':');
      attrs.push(ci > 0 ? t.substring(0, ci).trim() + ': ' + t.substring(ci + 1).trim() : t);
      i++;
    }
    // Remaining lines contain Stem, A., B., C.
    qp = lines.slice(i).join('\n');
  }

  // Extract Stem, A., B., C. from questionPart remainder
  const ai = qp.indexOf('A. ');
  const bi = qp.indexOf('B. ');
  const ci_idx = qp.indexOf('C. ');

  // Handle "Stem: " prefix
  let stemText = qp;
  if (stemText.startsWith('Stem:')) stemText = stemText.substring(5).trim();
  const stem = stemText.substring(0, ai).trim();
  const partA = qp.substring(ai, bi).trim();
  const partB = qp.substring(bi, ci_idx).trim();
  const partC = qp.substring(ci_idx).trim();

  // Extract Answer sections
  const ap = answerPart.trim();
  const aai = ap.indexOf('A. ');
  const abi = ap.indexOf('B. ');
  const aci = ap.indexOf('C. ');
  if (aai < 0 || abi < 0 || aci < 0) return null;

  const ansA = ap.substring(aai, abi).trim();
  const ansB = ap.substring(abi, aci).trim();
  const ansC = ap.substring(aci).trim();

  // Build output
  let out = 'Question ' + qn + ':\n';
  for (const a of attrs) out += '[' + a + ']\n';
  out += 'Stem: ' + stem + '\n';
  out += partA + '\n';
  out += partB + '\n';
  out += partC + '\n';
  out += 'Answer:\n';
  out += ansA + '\n';
  out += ansB + '\n';
  out += ansC;
  return out;
}

let newBan = '';
for (const sec of rawSections) {
  const formatted = parseBanglaSection(sec);
  if (formatted) {
    newBan += formatted + '\n\n---\n\n';
  }
}
newBan = newBan.replace(/\n\n---\n\n$/, '');
newBan = newBan.replace(/\n{3,}/g, '\n\n').trim() + '\n';

fs.writeFileSync(dir + 'Ch3_CQ_BANGLA.txt', newBan, 'utf-8');
console.log('Bangla question count: ' + (newBan.match(/^Question \d+:/gm) || []).length);

// ========== ENGLISH ==========
let eng = fs.readFileSync(dir + 'Ch3_CQ_ENGLISH.txt', 'utf-8');

// Split by Question N: at start of lines
const qPos = [];
const qre = /^Question \d+:/gm;
let m;
while ((m = qre.exec(eng)) !== null) qPos.push(m.index);

console.log('English raw question headers at line starts:', qPos.length);

let engSections = [];
for (let i = 0; i < qPos.length; i++) {
  const start = qPos[i];
  const end = i < qPos.length - 1 ? qPos[i + 1] : eng.length;
  engSections.push(eng.substring(start, end));
}

// Clean instruction notes from each section
const badPatterns = [
  /Ensure subject/i, /Ensure chapter/i, /Ensure Board/i,
  /Check formatting/i, /Math tutor extracting/i, /Extract CQ/i,
  /No vague filler/i, /Inline math/i, /specific layout/i,
  /One step per line/i, /Handle missing answers/i,
  /Verify and correct/i, /Beginner-friendly/i, /Correct errors silently/i,
  /Self-Correction/i, /Final Check/i, /specifics per question/i,
  /Panjeree/i, /Decision:/i, /source is empty/i, /is unreadable/i,
  /still extract/i, /Correct format/i, /I will list/i,
  /I'll stick/i, /to be safe/i, /Keep it/i,
  /images of a test paper/i, /No source/i,
  /Reference page/i, /Q\d+[A-Z] is (?:missing|a reference|solution is missing)/i,
  /^Page \d+:/mi,
  /^3 pages of/i, /^Two images/i, /^Subject, Chapter/i,
];

function cleanEng(sec) {
  let lines = sec.split('\n').filter(l => {
    for (const p of badPatterns) { if (p.test(l)) return false; }
    return true;
  });
  return lines.join('\n').trim();
}

let engResult = '';
for (const sec of engSections) {
  let cleaned = cleanEng(sec);
  if (cleaned) engResult += cleaned + '\n\n---\n\n';
}
engResult = engResult.replace(/\n\n---\n\n$/, '');
engResult = engResult.replace(/\n{3,}/g, '\n\n').trim() + '\n';

fs.writeFileSync(dir + 'Ch3_CQ_ENGLISH.txt', engResult, 'utf-8');
console.log('English question count: ' + (engResult.match(/^Question \d+:/gm) || []).length);

// ========== FINAL VERDICT ==========
const finalBan = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');
const finalEng = fs.readFileSync(dir + 'Ch3_CQ_ENGLISH.txt', 'utf-8');
const bq = (finalBan.match(/^Question \d+:/gm) || []).length;
const eq = (finalEng.match(/^Question \d+:/gm) || []).length;

console.log('\n=== FINAL ===');
console.log('English: ' + eq);
console.log('Bangla:  ' + bq);
console.log(eq === bq ? '✓ MATCH' : '✗ MISMATCH');
