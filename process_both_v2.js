const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ';

// ==================== BANGLA ====================
function bengaliToEnglish(bnStr) {
  const bd = '০১২৩৪৫৬৭৮৯';
  const ed = '0123456789';
  let r = '';
  for (const c of bnStr) { const i = bd.indexOf(c); r += i >= 0 ? ed[i] : c; }
  return r;
}

function formatBanglaQuestion(text) {
  const ui = text.indexOf('উত্তর:');
  if (ui < 0) return null;
  const qp = text.substring(0, ui);
  const ap = text.substring(ui + 5);

  const qm = qp.match(/প্রশ্ন\s*([০-৯]+):/);
  if (!qm) return null;
  const qn = bengaliToEnglish(qm[1]).padStart(2, '0');

  const attrs = [];
  const ar = /\[([^\]]+)\]/g;
  let m;
  while ((m = ar.exec(qp)) !== null) {
    const t = m[1];
    const ci = t.indexOf(':');
    attrs.push(ci > 0 ? t.substring(0, ci).trim() + ': ' + t.substring(ci + 1).trim() : t);
  }

  let rq = qp.replace(/প্রশ্ন\s*[০-৯]+:/, '').replace(/\[([^\]]+)\]/g, '').trim();
  rq = rq.replace(/^স্টেম:/, '').trim();

  const ai = rq.indexOf('A. ');
  const bi = rq.indexOf('B. ');
  const ci_idx = rq.indexOf('C. ');
  if (ai < 0 || bi < 0 || ci_idx < 0) return null;

  const stem = rq.substring(0, ai).trim();
  const partA = rq.substring(ai, bi).trim();
  const partB = rq.substring(bi, ci_idx).trim();
  const partC = rq.substring(ci_idx).trim();

  const at = ap.trim();
  const aai = at.indexOf('A. ');
  const abi = at.indexOf('B. ');
  const aci = at.indexOf('C. ');
  if (aai < 0 || abi < 0 || aci < 0) return null;

  let out = 'Question ' + qn + ':\n';
  for (const a of attrs) out += a.indexOf(':') > 0 ? '[' + a + ']\n' : '[' + a + ']\n';
  out += 'Stem: ' + stem + '\n';
  out += partA + '\n';
  out += partB + '\n';
  out += partC + '\n';
  out += 'Answer:\n';
  out += at.substring(aai, abi).trim() + '\n';
  out += at.substring(abi, aci).trim() + '\n';
  out += at.substring(aci).trim();

  return out;
}

let banContent = fs.readFileSync(dir + '\\Ch3_CQ_BANGLA.txt', 'utf-8');

// Check if it's single line (old format)
if (!banContent.includes('\n')) {
  const sections = banContent.match(/প্রশ্ন\s*[০-৯]+:.*?(?=প্রশ্ন\s*[০-৯]+:|$)/g);
  let newBan = '';
  for (const sec of sections) {
    const formatted = formatBanglaQuestion(sec);
    if (formatted) newBan += formatted + '\n\n---\n\n';
  }
  newBan = newBan.replace(/\n\n---\n\n$/, '');
  banContent = newBan;
} else {
  // Already line-based, fix minor issues
  banContent = banContent.replace(/(C\..*?\(৪\))(Answer:)/g, '$1\n$2');
  banContent = banContent.replace(/\]Question (\d+:)/g, ']\n\n---\n\nQuestion $1');
}

banContent = banContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';
fs.writeFileSync(dir + '\\Ch3_CQ_BANGLA.txt', banContent, 'utf-8');

const banQ = (banContent.match(/^Question \d+:/gm) || []).length;
console.log('Bangla questions: ' + banQ);

// ==================== ENGLISH ====================
let engContent = fs.readFileSync(dir + '\\Ch3_CQ_ENGLISH.txt', 'utf-8');

// Extract all question sections by finding "Question N:" patterns
// that appear at the beginning of the file or after "---\n\n" or "---\n"
// (these are true headers, not references in answers)
const sections = [];
// Strategy: find all occurrences of "Question N:" and check context
const qRegex = /Question \d+:/g;
let match;
const pos = [];
while ((match = qRegex.exec(engContent)) !== null) {
  const idx = match.index;
  // Check if this is a question header (at start of file or preceded by ---, \n---, etc.)
  const before = engContent.substring(Math.max(0, idx - 10), idx);
  // A header is if at position 0, or preceded by ---\n, or preceded by \n\n
  const isHeader = idx === 0 || /---\s*$/.test(before) || /\n\n$/.test(before) || /\n$/.test(before) && idx > 0;
  if (isHeader || idx < 10) {
    pos.push(idx);
  }
}

// If none found via context, fall back to all occurrences
if (pos.length < 2) {
  qRegex.lastIndex = 0;
  while ((match = qRegex.exec(engContent)) !== null) pos.push(match.index);
}

// Remove duplicates and sort
const uniquePos = [...new Set(pos)].sort((a, b) => a - b);
console.log('English question positions: ' + uniquePos.length);

// Split into sections
for (let i = 0; i < uniquePos.length; i++) {
  const start = uniquePos[i];
  const end = i < uniquePos.length - 1 ? uniquePos[i + 1] : engContent.length;
  sections.push(engContent.substring(start, end));
}

// Process each section: remove instruction notes
const instructionPatterns = [
  /Ensure subject/i, /Ensure chapter/i, /Ensure Board/i,
  /Check formatting/i, /Math tutor extracting/i, /Extract CQ/i,
  /No vague filler/i, /Inline math/i, /specific layout/i,
  /One step per line/i, /Handle missing answers/i,
  /Verify and correct/i, /Beginner-friendly/i,
  /Self-Correction/i, /Final Check/i, /specifics per question/i,
  /Panjeree/i, /Decision:/i, /source is empty/i, /is unreadable/i,
  /still extract/i, /Correct format/i,
  /I will list/i, /I'll stick/i, /to be safe/i, /Keep it/i,
  /images of a test paper/i, /No source/i,
  /Reference page/i, /Q\d+[A-Z] is missing/i,
  /Q\d+[A-Z] is a reference/i, /Q\d+[A-Z] solution is missing/i,
  /Page \d+:/i,
];

function cleanSection(sec) {
  let lines = sec.split('\n');
  lines = lines.filter(l => {
    const t = l.trim();
    if (!t) return true; // keep empty lines
    for (const pat of instructionPatterns) {
      if (pat.test(l)) return false;
      if (pat.test(t)) return false;
    }
    return true;
  });
  return lines.join('\n');
}

let processed = [];
for (const sec of sections) {
  let cleaned = cleanSection(sec);
  cleaned = cleaned.trim();
  if (cleaned) processed.push(cleaned);
}

// Add newlines at structure points within each section
let result = [];
for (const sec of processed) {
  let s = sec;
  // Insert newlines before attribute blocks
  s = s.replace(/(\[ID: \d+\])(?!\n)/g, '\n$1');
  s = s.replace(/(\[Subject: [^\]]*\])(?!\n)/g, '\n$1');
  s = s.replace(/(\[Chapter: [^\]]*\])(?!\n)/g, '\n$1');
  s = s.replace(/(\[Lesson: [^\]]*\])(?!\n)/g, '\n$1');
  s = s.replace(/(\[Board: [^\]]*\])(?!\n)/g, '\n$1');
  // Ensure Stem: and Answer: on own lines
  s = s.replace(/(Stem:)/g, '\n$1');
  s = s.replace(/(Answer:)/g, '\n$1');
  // Handle "C. ... (4)Answer:"
  s = s.replace(/(C\..*?\(4\))(Answer:)/g, '$1\n$2');
  // Handle trailing "C. ... (4)" followed immediately by next question
  s = s.replace(/\)\s*Question (\d+:)/g, ')\n\n---\n\nQuestion $1');
  // Handle "Result: [Proved]Question"
  s = s.replace(/\]\s*Question (\d+:)/g, ']\n\n---\n\nQuestion $1');
  s = s.replace(/(\])C\. /g, '$1\nC. ');
  
  result.push(s.trim());
}

// Join with separators
let engResult = result.join('\n\n---\n\n');
engResult = engResult.replace(/\n{3,}/g, '\n\n').trim() + '\n';

fs.writeFileSync(dir + '\\Ch3_CQ_ENGLISH.txt', engResult, 'utf-8');

const engQ = (engResult.match(/^Question \d+:/gm) || []).length;
console.log('English questions: ' + engQ);

console.log('\n=== VERDICT ===');
if (engQ === banQ) console.log('✓ Counts MATCH');
else console.log('✗ Mismatch by ' + Math.abs(engQ - banQ));
