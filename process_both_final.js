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

// Split even when প্রশ্ন N: appears mid-line (no preceding newline)
// Use a lookbehind or match the প্রশ্ন N: as a delimiter
const sections = [];
let remaining = ban;

while (remaining.length > 0) {
  // Find the next প্রশ্ন N: or Question N: 
  // For প্রশ্ন N: match at start or anywhere
  const q1 = remaining.match(/(?:^|\n)প্রশ্ন\s*[০-৯]+:|প্রশ্ন\s*[০-৯]+:/);
  const q2 = remaining.match(/(?:^|\n)Question\s+\d+:/);
  
  let firstIdx = -1;
  let firstMatch = null;
  
  if (q1) {
    firstIdx = q1.index;
    firstMatch = 'old';
  }
  if (q2) {
    if (firstIdx < 0 || q2.index < firstIdx) {
      firstIdx = q2.index;
      firstMatch = 'new';
    }
  }
  
  if (firstIdx < 0) {
    // No more headers, take rest
    sections.push(remaining);
    break;
  }
  
  // Find the NEXT header after this one
  let searchFrom = firstIdx + (firstMatch === 'old' ? 1 : 1); // skip past this match
  
  // If this is a প্রশ্ন mid-line (not preceded by \n), the searchFrom needs adjustment
  if (firstMatch === 'old' && !remaining.substring(Math.max(0, firstIdx-1), firstIdx).includes('\n')) {
    // It's mid-line, the প্রশ্ন is the boundary
  }
  
  // Find next header
  const restAfter = remaining.substring(searchFrom);
  const q1n = restAfter.match(/(?:^|\n)প্রশ্ন\s*[০-৯]+:|প্রশ্ন\s*[০-৯]+:/);
  const q2n = restAfter.match(/(?:^|\n)Question\s+\d+:/);
  
  let nextIdx = -1;
  if (q1n) nextIdx = q1n.index + searchFrom;
  if (q2n) {
    const candidate = q2n.index + searchFrom;
    if (nextIdx < 0 || candidate < nextIdx) nextIdx = candidate;
  }
  
  if (nextIdx < 0) {
    sections.push(remaining.substring(firstIdx));
    break;
  }
  
  sections.push(remaining.substring(firstIdx, nextIdx));
  remaining = remaining.substring(nextIdx);
}

console.log('Bangla sections found:', sections.length);

// Parse each section
function parseBanglaSection(text) {
  text = text.trim();
  if (!text) return null;

  let isOld = text.startsWith('প্রশ্ন');
  let isNew = text.startsWith('Question');

  if (!isOld && !isNew) return null;

  let qn, questionPart, answerPart;

  if (isOld) {
    const ui = text.indexOf('উত্তর:');
    if (ui < 0) return null;
    questionPart = text.substring(0, ui);
    answerPart = text.substring(ui + 5);

    const qm = questionPart.match(/প্রশ্ন\s*([০-৯]+):/);
    if (!qm) return null;
    qn = toEn(qm[1]).padStart(2, '0');
  } else {
    const lines = text.split('\n');
    qn = lines[0].replace('Question ', '').replace(':', '').trim().padStart(2, '0');

    const ansIdx = lines.findIndex(l => l.trim() === 'Answer:');
    if (ansIdx < 0) return null;
    questionPart = lines.slice(0, ansIdx).join('\n');
    answerPart = lines.slice(ansIdx + 1).join('\n');
  }

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
    if (qp.startsWith('Stem:')) qp = qp.substring(5).trim();
  } else {
    const lines = qp.split('\n').map(l => l.trim()).filter(l => l);
    let i = 1;
    while (i < lines.length && /^\[.*\]$/.test(lines[i])) {
      const t = lines[i].replace(/^\[|\]$/g, '');
      const ci = t.indexOf(':');
      attrs.push(ci > 0 ? t.substring(0, ci).trim() + ': ' + t.substring(ci + 1).trim() : t);
      i++;
    }
    qp = lines.slice(i).join('\n');
  }

  const ai = qp.indexOf('A. ');
  const bi = qp.indexOf('B. ');
  const ci_idx = qp.indexOf('C. ');
  if (ai < 0 || bi < 0 || ci_idx < 0) return null;

  let stemText = qp;
  if (stemText.startsWith('মূল প্রশ্ন:')) stemText = stemText.substring(7).trim();
  const stem = stemText.substring(0, ai).trim();
  const partA = qp.substring(ai, bi).trim();
  const partB = qp.substring(bi, ci_idx).trim();
  const partC = qp.substring(ci_idx).trim();

  // Handle answer parts that might have English format or Bengali format
  const ap = answerPart.trim();
  const aai = ap.indexOf('A. ');
  const abi = ap.indexOf('B. ');
  const aci = ap.indexOf('C. ');
  if (aai < 0 || abi < 0 || aci < 0) {
    // Try ক. খ. গ. (Bengali part markers)
    const kai = ap.indexOf('ক. ');
    const kbi = ap.indexOf('খ. ');
    const kci = ap.indexOf('গ. ');
    if (kai >= 0 && kbi >= 0 && kci >= 0) {
      const ansA = ap.substring(kai, kbi).trim();
      const ansB = ap.substring(kbi, kci).trim();
      const ansC = ap.substring(kci).trim();
      
      let out = 'Question ' + qn + ':\n';
      for (const a of attrs) out += '[' + a + ']\n';
      out += 'Stem: ' + stem + '\n';
      out += partA + '\n';
      out += partB + '\n';
      out += partC + '\n';
      out += 'Answer:\n';
      out += 'A. ' + ansA.replace(/^ক\.\s*/, '') + '\n';
      out += 'B. ' + ansB.replace(/^খ\.\s*/, '') + '\n';
      out += 'C. ' + ansC.replace(/^গ\.\s*/, '');
      return out;
    }
    return null;
  }

  const ansA = ap.substring(aai, abi).trim();
  const ansB = ap.substring(abi, aci).trim();
  const ansC = ap.substring(aci).trim();

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
for (const sec of sections) {
  const formatted = parseBanglaSection(sec);
  if (formatted) {
    newBan += formatted + '\n\n---\n\n';
  }
}
newBan = newBan.replace(/\n\n---\n\n$/, '');
newBan = newBan.replace(/\n{3,}/g, '\n\n').trim() + '\n';

fs.writeFileSync(dir + 'Ch3_CQ_BANGLA.txt', newBan, 'utf-8');
const bqCount = (newBan.match(/^Question \d+:/gm) || []).length;
console.log('Bangla final count:', bqCount);

// ========== ENGLISH ==========
// Just split on line-starting Question N: and clean
let eng = fs.readFileSync(dir + 'Ch3_CQ_ENGLISH.txt', 'utf-8');

const qPos = [];
const qre = /^Question \d+:/gm;
let m;
while ((m = qre.exec(eng)) !== null) qPos.push(m.index);

let engSections = [];
for (let i = 0; i < qPos.length; i++) {
  const start = qPos[i];
  const end = i < qPos.length - 1 ? qPos[i + 1] : eng.length;
  engSections.push(eng.substring(start, end));
}

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

// Fix: 제거 "C. [No answer provided in source]\n\n---\n\nQuestion 12:" pattern
// (keep the questions, just fix spacing)
engResult = engResult.replace(/\n\n---\n\n(?=Question \d+:)/g, '\n\n---\n\n');

fs.writeFileSync(dir + 'Ch3_CQ_ENGLISH.txt', engResult, 'utf-8');
const eqCount = (engResult.match(/^Question \d+:/gm) || []).length;
console.log('English final count:', eqCount);

console.log('\n=== VERDICT ===');
console.log('English: ' + eqCount + ', Bangla: ' + bqCount);
console.log(eqCount === bqCount ? '✓ MATCH' : '✗ MISMATCH');
