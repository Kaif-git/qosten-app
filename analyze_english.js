const fs = require('fs');
const eng = fs.readFileSync('D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_ENGLISH.txt', 'utf-8');

// Find all instances of notes/gibberish patterns
const patterns = ['Ensure subject', 'Ensure chapter', 'Ensure Board', 'Check formatting',
  'No answer provided', 'source is empty', 'Final Check', 'No source',
  'specific layout', 'One step per line'];

for (const pat of patterns) {
  let idx = 0;
  while ((idx = eng.indexOf(pat, idx)) >= 0) {
    const start = Math.max(0, idx - 50);
    const end = Math.min(eng.length, idx + 150);
    console.log('Found "' + pat + '" at ' + idx + ':');
    console.log('  Context: ...' + eng.substring(start, end) + '...');
    console.log('');
    idx++;
  }
}

// Find all '---' positions
console.log('\n=== All --- positions ===');
let dashPos = eng.indexOf('---');
let count = 0;
while (dashPos >= 0 && count < 40) {
  const ctxStart = Math.max(0, dashPos - 60);
  const ctxEnd = Math.min(eng.length, dashPos + 120);
  console.log('--- at ' + dashPos + ': ...' + eng.substring(ctxStart, ctxEnd) + '...');
  console.log('');
  dashPos = eng.indexOf('---', dashPos + 1);
  count++;
}
if (dashPos < 0) console.log('No more --- found after ' + count + ' occurrences');
