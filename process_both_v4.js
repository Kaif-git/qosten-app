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

// Strategy: split into question blocks by finding boundaries
// Each block starts with either প্রশ্ন N: or Question N:
// Split by these markers (keeping the marker)

// First, normalize all প্রশ্ন N: or Question N: to be at line start
// by inserting \n before them if needed
let normalized = ban;

// Insert newline before any প্রশ্ন N: or Question N: that isn't already at line start
normalized = normalized.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2');
normalized = normalized.replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');

// Now split on line-starting প্রশ্ন or Question 
const blocks = normalized.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

console.log('Bangla total blocks:', blocks.length);

function parseBlock(text) {
  text = text.trim();
  if (!text) return null;

  const isOld = /প্রশ্ন/.test(text);
  const isNew = /^Question/.test(text);
  if (!isOld && !isNew) return null;

  // Check if this is a reference (like "প্রশ্ন ১ (C) এর সমাধান দেখ") and not a real question
  // A real question has উত্তর: or Answer:
  const hasAnswer = text.includes('উত্তর:') || text.includes('Answer:');
  if (!hasAnswer) return null;

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

  const attrs = [];
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
    if (qp.startsWith('মূল প্রশ্ন:')) qp = qp.substring(7).trim();
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

  const stem = qp.substring(0, ai).trim();
  const partA = qp.substring(ai, bi).trim();
  const partB = qp.substring(bi, ci_idx).trim();
  const partC = qp.substring(ci_idx).trim();

  const ap = answerPart.trim();
  const aai = ap.indexOf('A. ');
  const abi = ap.indexOf('B. ');
  const aci = ap.indexOf('C. ');

  let ansA, ansB, ansC;

  if (aai >= 0 && abi >= 0 && aci >= 0) {
    ansA = ap.substring(aai, abi).trim();
    ansB = ap.substring(abi, aci).trim();
    ansC = ap.substring(aci).trim();
  } else {
    // Try ক. খ. গ.
    const kai = ap.indexOf('ক. ');
    const kbi = ap.indexOf('খ. ');
    const kci = ap.indexOf('গ. ');
    if (kai >= 0 && kbi >= 0 && kci >= 0) {
      ansA = 'A. ' + ap.substring(kai, kbi).replace(/^ক\.\s*/, '').trim();
      ansB = 'B. ' + ap.substring(kbi, kci).replace(/^খ\.\s*/, '').trim();
      ansC = 'C. ' + ap.substring(kci).replace(/^গ\.\s*/, '').trim();
    } else {
      return null;
    }
  }

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
for (const block of blocks) {
  const result = parseBlock(block);
  if (result) {
    newBan += result + '\n\n---\n\n';
  }
}
newBan = newBan.replace(/\n\n---\n\n$/, '');
newBan = newBan.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

fs.writeFileSync(dir + 'Ch3_CQ_BANGLA.txt', newBan, 'utf-8');
const bq = (newBan.match(/^Question \d+:/gm) || []).length;
console.log('Bangla questions:', bq);

// ========== ENGLISH ==========
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
  /Reference page/i,
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
engResult = engResult.replace(/\n{4,}/g, '\n\n\n').trim() + '\n';

fs.writeFileSync(dir + 'Ch3_CQ_ENGLISH.txt', engResult, 'utf-8');
const eq = (engResult.match(/^Question \d+:/gm) || []).length;
console.log('English questions:', eq);

console.log('\n=== VERDICT ===');
console.log(eq === bq ? '✓ MATCH (' + eq + ')' : '✗ MISMATCH (English: ' + eq + ', Bangla: ' + bq + ')');
