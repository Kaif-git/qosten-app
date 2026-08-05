const fs = require('fs');
const path = require('path');

const filePath = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_BANGLA.txt';
let content = fs.readFileSync(filePath, 'utf-8');

// Fix 1: Separate "C. ... (৪)Answer:" into two lines
content = content.replace(/(C\..*?\(৪\))(Answer:)/g, '$1\n$2');

// Fix 2: Separate "]Question N:" into new line with proper spacing
content = content.replace(/\]Question (\d+:)/g, ']\n\n---\n\nQuestion $1');

// Fix 3: Ensure proper line breaks before --- separators
// Make sure Result/[Proved]/[Showed] lines have proper spacing before ---
content = content.replace(/\[প্রমাণিত\]\n*---/g, '[প্রমাণিত]\n\n---');
content = content.replace(/\[দেখানো হলো\]\n*---/g, '[দেখানো হলো]\n\n---');
content = content.replace(/\[উত্তর\]\n*---/g, '[উত্তর]\n\n---');

// Fix 4: Clean up extra spaces
content = content.replace(/  +/g, ' ');

// Fix 5: Ensure --- is on its own line with surrounding blank lines
content = content.replace(/\n---\n/g, '\n\n---\n\n');

// Fix 6: Remove excessive blank lines (more than 2 consecutive)
content = content.replace(/\n{4,}/g, '\n\n\n');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Bangla file fixed.');
