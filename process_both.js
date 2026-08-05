const fs = require('fs');
const path = require('path');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ';

// ============ BANGLA FILE ============
let banContent = fs.readFileSync(path.join(dir, 'Ch3_CQ_BANGLA.txt'), 'utf-8');

// Check if Bangla is single-line
if (banContent.includes('\n') === false) {
  // Single line - needs splitting just like English
  const bd = '০১২৩৪৫৬৭৮৯';
  const ed = '0123456789';
  function toEn(s) {
    let r = '';
    for (const c of s) { const i = bd.indexOf(c); r += i >= 0 ? ed[i] : c; }
    return r;
  }

  function parseQuestion(text) {
    const ui = text.indexOf('উত্তর:');
    const qp = text.substring(0, ui);
    const ap = text.substring(ui + 5);

    const qm = qp.match(/প্রশ্ন\s*([০-৯]+):/);
    const qn = qm ? toEn(qm[1]).padStart(2, '0') : '??';

    const attrs = [];
    const ar = /\[([^\]]+)\]/g;
    let m;
    while ((m = ar.exec(qp)) !== null) {
      const t = m[1];
      const ci = t.indexOf(':');
      if (ci > 0) attrs.push(t.substring(0, ci).trim() + ': ' + t.substring(ci + 1).trim());
      else attrs.push(t);
    }

    let rq = qp.replace(/প্রশ্ন\s*[০-৯]+:/, '').replace(/\[([^\]]+)\]/g, '').trim();
    rq = rq.replace(/^স্টেম:/, '').trim();

    const ai = rq.indexOf('A. ');
    const bi = rq.indexOf('B. ');
    const ci_idx = rq.indexOf('C. ');
    const stem = rq.substring(0, ai).trim();
    const partA = rq.substring(ai, bi).trim();
    const partB = rq.substring(bi, ci_idx).trim();
    const partC = rq.substring(ci_idx).trim();

    const at = ap.trim();
    const aai = at.indexOf('A. ');
    const abi = at.indexOf('B. ');
    const aci = at.indexOf('C. ');
    const ansA = at.substring(aai, abi).trim();
    const ansB = at.substring(abi, aci).trim();
    const ansC = at.substring(aci).trim();

    let out = 'Question ' + qn + ':\n';
    for (const a of attrs) {
      out += '[' + a + ']\n';
    }
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

  const sections = banContent.match(/প্রশ্ন\s*[০-৯]+:.*?(?=প্রশ্ন\s*[০-৯]+:|$)/g);
  let newBan = '';
  for (const sec of sections) {
    newBan += parseQuestion(sec) + '\n\n---\n\n';
  }
  newBan = newBan.replace(/\n\n---\n\n$/, '');
  banContent = newBan;
} else {
  // Already has newlines, just fix formatting
  // Separate "C. ... (৪)Answer:" into two lines
  banContent = banContent.replace(/(C\..*?\(৪\))(Answer:)/g, '$1\n$2');
  // Separate "]Question N:" into new line
  banContent = banContent.replace(/\]Question (\d+:)/g, ']\n\n---\n\nQuestion $1');
  // Ensure proper separator spacing
  banContent = banContent.replace(/(\[প্রমাণিত\]|\[দেখানো হলো\]|\[উত্তর\])\n*---/g, '$1\n\n---');
}

// Normalize --- separators
banContent = banContent.replace(/\n---\n/g, '\n\n---\n\n');
// Collapse 3+ blank lines to 2
banContent = banContent.replace(/\n{3,}/g, '\n\n');
// Remove trailing spaces
banContent = banContent.replace(/[ \t]+$/gm, '');
banContent = banContent.trim() + '\n';

fs.writeFileSync(path.join(dir, 'Ch3_CQ_BANGLA.txt'), banContent, 'utf-8');
console.log('Bangla done.');

// ============ ENGLISH FILE ============
let engContent = fs.readFileSync(path.join(dir, 'Ch3_CQ_ENGLISH.txt'), 'utf-8');

// Insert newlines at question boundaries and attribute lines
let fixed = engContent;

// First, collect all question sections by splitting on 'Question N:'
// Each section starts with 'Question N:' and ends before next 'Question N:' or end
const qRegex = /Question \d+:/g;
const headers = [];
let m;
while ((m = qRegex.exec(engContent)) !== null) {
  headers.push({ text: m[0], index: m.index });
}

// Split into sections
const sections = [];
for (let i = 0; i < headers.length; i++) {
  const start = headers[i].index;
  const end = (i < headers.length - 1) ? headers[i + 1].index : engContent.length;
  sections.push(engContent.substring(start, end));
}

console.log('English sections:', sections.length);

// Process each section
const processedSections = [];
const instructionPatterns = [
  /Ensure subject/i, /Ensure chapter/i, /Ensure Board/i,
  /Check formatting/i, /Math tutor extracting/i, /Extract CQ/i,
  /No vague filler/i, /Inline math/i, /specific layout/i,
  /One step per line/i, /Handle missing answers/i,
  /Verify and correct/i, /Beginner-friendly/i, /Correct errors silently/i,
  /Self-Correction/i, /Final Check/i, /specifics per question/i,
  /Panjeree/i, /Decision:/i, /source is empty/i, /is unreadable/i,
  /still extract/i, /Specific Format/i, /Correct format/i,
  /I will list/i, /I'll stick/i, /to be safe/i,
];

for (const section of sections) {
  // Get the question info line (first line)
  const lines = section.split('\n').filter(l => l.trim());
  
  // Filter out instruction lines
  const cleanLines = lines.filter(l => {
    for (const pat of instructionPatterns) {
      if (pat.test(l)) return false;
    }
    return true;
  });
  
  if (cleanLines.length === 0) continue;
  
  // Now format the cleaned content
  let content = cleanLines.join('\n');
  
  // Insert newlines before attributes
  content = content
    .replace(/(\[ID: \d+\])/g, '\n$1')
    .replace(/(\[Subject: [^\]]*\])/g, '\n$1')
    .replace(/(\[Chapter: [^\]]*\])/g, '\n$1')
    .replace(/(\[Lesson: [^\]]*\])/g, '\n$1')
    .replace(/(\[Board: [^\]]*\])/g, '\n$1');
  
  // Insert newlines before Stem:, Answer:
  content = content.replace(/(Stem:)/g, '\n$1');
  content = content.replace(/(Answer:)/g, '\n$1');
  
  // Insert newline before A. B. C. (unless already at line start)
  content = content.replace(/(?<=\S) (?=A\. )/g, '\n');
  content = content.replace(/(?<=\S) (?=B\. )/g, '\n');
  content = content.replace(/(?<=\S) (?=C\. )/g, '\n');
  
  // Handle "C. ... (4)Answer:" case - separate them
  content = content.replace(/(C\..*?\(4\))(Answer:)/g, '$1\n$2');
  
  // Handle "Answer:A." case
  content = content.replace(/(Answer:)(A\. )/g, '$1\n$2');
  
  // Handle "Result: [Proved]C." case
  content = content.replace(/(\])\s*C\. /g, '$1\nC. ');
  content = content.replace(/(\])\s*(Question \d+:)/g, '$1\n\n---\n\n$2');
  
  processedSections.push(content);
}

// Join sections with proper separators
let result = processedSections.join('\n\n---\n\n');

// Collapse 3+ blank lines
result = result.replace(/\n{3,}/g, '\n\n');

// Remove trailing spaces
result = result.replace(/[ \t]+$/gm, '');
result = result.trim() + '\n';

fs.writeFileSync(path.join(dir, 'Ch3_CQ_ENGLISH.txt'), result, 'utf-8');
console.log('English done.');

// ============ FINAL COUNT ============
const finalBan = fs.readFileSync(path.join(dir, 'Ch3_CQ_BANGLA.txt'), 'utf-8');
const finalEng = fs.readFileSync(path.join(dir, 'Ch3_CQ_ENGLISH.txt'), 'utf-8');

const banQ = (finalBan.match(/^Question \d+:/gm) || []).length;
const engQ = (finalEng.match(/^Question \d+:/gm) || []).length;

console.log('\n=== FINAL ===');
console.log('English questions: ' + engQ);
console.log('Bangla questions:  ' + banQ);
if (engQ === banQ) {
  console.log('✓ Counts match');
} else {
  console.log('✗ Mismatch by ' + Math.abs(engQ - banQ));
}
