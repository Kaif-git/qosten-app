const fs = require('fs');
const raw = fs.readFileSync('D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch6_CQ\\Ch6_CQ_BANGLA.txt', 'utf-8');
console.log('Length:', raw.length);
console.log('Starts with:', raw.substring(0, 50));

// Check the split logic
let norm = raw.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2')
              .replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const blocks = norm.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());
console.log('Blocks:', blocks.length);

// Show first block
if (blocks.length > 0) {
  console.log('Block 1:', blocks[0].substring(0, 200));
  console.log('---');
  // Check for উত্তর:
  console.log('উত্তর: index:', blocks[0].indexOf('উত্তর:'));
}
