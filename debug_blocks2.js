const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\';
let ban = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');

console.log('File length:', ban.length);

// Insert newline before any প্রশ্ন N: or Question N: that isn't already at line start
let normalized = ban;
normalized = normalized.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2');
normalized = normalized.replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');

const blocks = normalized.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

console.log('Total blocks:', blocks.length);
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i].trim();
  const first40 = b.split('\n')[0].trim().substring(0, 40);
  const hasAns = b.includes('উত্তর:') || b.includes('Answer:');
  console.log('Block ' + i + ': ' + first40 + ' | hasAns=' + hasAns + ' len=' + b.length);
}
