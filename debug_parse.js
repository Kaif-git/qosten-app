const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\';
const bd = '০১২৩৪৫৬৭৮৯';
const ed = '0123456789';
function toEn(s) {
  let r = '';
  for (const c of s) { const i = bd.indexOf(c); r += i >= 0 ? ed[i] : c; }
  return r;
}

let ban = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');

// Normalize to get blocks
let normalized = ban;
normalized = normalized.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2');
normalized = normalized.replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const rawBlocks = normalized.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

// Also need to handle প্রশ্ন references IN answers (like "প্রশ্ন ১ (C) এর সমাধান দেখ")
// These have প্রশ্ন in them but are not headers
// Strategy: a block that starts with প্রশ্ন or Question and has উত্তর:/Answer: is a real question
// If a block's first line after the header is [...] or Stem: or A., it's a real question

const bdDigits = /[০-৯]/;

function parseBlock(text) {
  text = text.trim();
  if (!text) return null;

  const isOld = /^প্রশ্ন/.test(text);
  const isNew = /^Question/.test(text);
  if (!isOld && !isNew) return null;

  let qn, questionPart, answerPart;

  if (isOld) {
    // Find উত্তর: - but be careful! References like "প্রশ্ন ১ (C) এর সমাধান দেখ" contain "প্রশ্ন" too
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

  // Extract attributes
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

  // Extract A, B, C
  const ai = qp.indexOf('A. ');
  const bi = qp.indexOf('B. ');
  const ci_idx = qp.indexOf('C. ');
  if (ai < 0 || bi < 0 || ci_idx < 0) return null;

  const stem = qp.substring(0, ai).trim();
  const partA = qp.substring(ai, bi).trim();
  const partB = qp.substring(bi, ci_idx).trim();
  const partC = qp.substring(ci_idx).trim();

  // Extract answer sections
  const ap = answerPart.trim();
  let aai = ap.indexOf('A. ');
  let abi = ap.indexOf('B. ');
  let aci = ap.indexOf('C. ');

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

let success = 0;
let fail = 0;
for (const block of rawBlocks) {
  const result = parseBlock(block);
  if (result) success++;
  else {
    fail++;
    const first = block.trim().split('\n')[0].substring(0, 50);
    console.log('FAILED: ' + first);
  }
}
console.log('Success: ' + success + ', Failed: ' + fail);
