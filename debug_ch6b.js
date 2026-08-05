const fs = require('fs');
const raw = fs.readFileSync('D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch6_CQ\\Ch6_CQ_BANGLA.txt', 'utf-8');
let norm = raw.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2')
              .replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const blocks = norm.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  console.log(`\n=== Block ${i+1} ===`);
  console.log('Has উত্তর:', b.includes('উত্তর:'));
  console.log('Has Answer:', b.includes('Answer:'));
  console.log('Has ক.:', b.includes('ক.'));
  console.log('Has খ.:', b.includes('খ.'));
  console.log('Has গ.:', b.includes('গ.'));
  console.log('Has প্রশ্নস্তবক:', b.includes('প্রশ্নস্তবক'));
  console.log('Has Stem:', b.includes('Stem:'));
  console.log('Has মূল প্রশ্ন:', b.includes('মূল প্রশ্ন:'));
  console.log('Has প্রদত্ত:', b.includes('প্রদত্ত:'));
  // Find last lines
  const lines = b.split('\n').filter(l => l.trim());
  console.log('Last 3 lines:', lines.slice(-3).join(' | '));
}
