const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\';
let ban = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');

let normalized = ban;
normalized = normalized.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2');
normalized = normalized.replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const rawBlocks = normalized.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

// Debug block 5 (Question 6:)
const block = rawBlocks[5];
console.log('Block 5 starts with:', block.substring(0, 100));
console.log('---');
console.log('Has Answer:?', block.includes('Answer:'));
console.log('Has A. ?', block.includes('A. '));
console.log('Has B. ?', block.includes('B. '));
console.log('Has C. ?', block.includes('C. '));

// Try to find the Answer: header
const ansIdx = block.indexOf('Answer:');
console.log('Answer: at index', ansIdx);

// Check what's before and after
if (ansIdx >= 0) {
  console.log('Before Answer:', block.substring(Math.max(0,ansIdx-50), ansIdx));
  console.log('After Answer:', block.substring(ansIdx, ansIdx+50));
  
  // Check the format
  console.log('\nFull block (first 500 chars):');
  console.log(block.substring(0, 500));
}
