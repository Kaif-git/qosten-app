const fs = require('fs');
const path = require('path');

const backupDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\BACKUP_CQ_FILES';
let banRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_BANGLA.txt'), 'utf-8');

// Normalize and split  
let norm = banRaw.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2').replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const blocks = norm.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

// For each block, check what conditions fail
for (let i = 0; i < blocks.length; i++) {
  const text = blocks[i].trim();
  const isOld = /^প্রশ্ন/.test(text);
  const qnMatch = text.match(isOld ? /প্রশ্ন\s*([০-৯]+):/ : /Question\s*(\d+):/);
  const qn = qnMatch ? qnMatch[1] : '??';
  
  const ui = text.indexOf('উত্তর:');
  const ai = text.indexOf('Answer:');
  const hasSplit = (ui >= 0 || ai >= 0);
  
  const hasA = text.includes('A. ');
  const hasB = text.includes('B. ');
  const hasC = text.includes('C. ');
  
  // Check A B C in answer  
  let ansText = '';
  if (ui >= 0) ansText = text.substring(ui + 5);
  else if (ai >= 0) ansText = text.substring(ai + 7);
  
  const ansHasA = ansText.includes('A. ');
  const ansHasB = ansText.includes('B. ');
  const ansHasC = ansText.includes('C. ');
  
  const fails = [];
  if (!hasSplit) fails.push('no উত্তর:/Answer:');
  if (!hasA) fails.push('no A.');
  if (!hasB) fails.push('no B.');
  if (!hasC) fails.push('no C.');
  if (!ansHasA) fails.push('answer no A.');
  if (!ansHasB) fails.push('answer no B.');
  if (!ansHasC) fails.push('answer no C.');
  
  console.log(`Block ${i}: Q${String(qn).padStart(2)} ${isOld ? '(old)' : '(new)'} ${fails.length ? 'FAIL: '+fails.join(', ') : 'OK'}`);
}
