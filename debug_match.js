const fs = require('fs');
const path = require('path');

const backupDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\BACKUP_CQ_FILES';
const bd = '০১২৩৪৫৬৭৮৯';
const ed = '0123456789';
const toEn = s => { let r=''; for(const c of s){const i=bd.indexOf(c);r+=i>=0?ed[i]:c;} return r; };

// Parse Bangla
let banRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_BANGLA.txt'), 'utf-8');
let norm = banRaw.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2').replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
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

  return { qn, attrs };
}

const banQuestions = [];
for (const block of blocks) {
  const q = parseQuestion(block);
  if (q) banQuestions.push(q);
}

// Print all Bangla question attrs
console.log('=== BANGLA QUESTIONS ===');
for (const q of banQuestions) {
  const board = q.attrs['Board'] || q.attrs['বোর্ড'] || 'MISSING';
  console.log(`  Q${String(q.qn).padStart(2)} | Board: ${board} | ID: ${q.attrs['ID']}`);
}

// Parse English
let engRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_ENGLISH.txt'), 'utf-8');
const engSplit = engRaw.split(/(?=Question \d+:)/);
const engQuestions = [];
for (const block of engSplit) {
  const t = block.trim();
  if (!t || !t.startsWith('Question')) continue;
  const headerMatch = t.match(/Question (\d+):/);
  if (!headerMatch) continue;
  const qn = parseInt(headerMatch[1]);
  const ai = t.indexOf('Answer:');
  if (ai < 0) continue;
  const qp = t.substring(0, ai);
  const attrs = {};
  const ar = /\[([^\]]+)\]/g;
  let m;
  while ((m = ar.exec(qp)) !== null) {
    const tag = m[1];
    const ci = tag.indexOf(':');
    if (ci > 0) attrs[tag.substring(0, ci).trim()] = tag.substring(ci + 1).trim();
  }
  engQuestions.push({ qn, attrs });
}

console.log('\n=== ENGLISH QUESTIONS ===');
for (const q of engQuestions) {
  const board = q.attrs['Board'] || 'MISSING';
  console.log(`  Q${String(q.qn).padStart(2)} | Board: ${board} | ID: ${q.attrs['ID']}`);
}
