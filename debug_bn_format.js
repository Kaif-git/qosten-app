const fs = require('fs');
const path = require('path');
const backupDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\BACKUP_CQ_FILES';
let banRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_BANGLA.txt'), 'utf-8');
let norm = banRaw.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2').replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
const blocks = norm.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());

// Check blocks 10-15 and 21-26 for first 400 chars
for (const idx of [10, 11, 21, 22]) {
  console.log(`=== Block ${idx} (first 400) ===`);
  console.log(blocks[idx].trim().substring(0, 400));
  console.log('');
}
