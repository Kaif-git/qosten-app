const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\';
let ban = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');

const bd = '০১২৩৪৫৬৭৮৯';
const ed = '0123456789';
function toEn(s) {
  let r = '';
  for (const c of s) { const i = bd.indexOf(c); r += i >= 0 ? ed[i] : c; }
  return r;
}

// Normalize
let normalized = ban;
normalized = normalized.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2');
normalized = normalized.replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');

const blocks = normalized.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

console.log('Total blocks:', blocks.length);
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i].trim();
  const hasAnswer = b.includes('উত্তর:') || b.includes('Answer:');
  const hasABC = b.includes('A. ') && b.includes('B. ') && b.includes('C. ');
  const isRef = /প্রশ্ন\s+[০-৯]+\s*\(/.test(b);
  
  const firstLine = b.split('\n')[0].trim();
  console.log('Block ' + i + ': ' + firstLine.substring(0, 40) + 
    ' | hasAnswer=' + hasAnswer + ' hasABC=' + hasABC + ' isRef=' + isRef +
    ' len=' + b.length);
}
