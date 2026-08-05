const fs = require('fs');

const file = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\final\\Shuva\\Shuva_CQ_final.txt';
const txt = fs.readFileSync(file, 'utf-8');

// Split by standalone --- OR --- Batch N ---
const blocks = txt.split(/\n(?:---\n|--- Batch \d+ ---\n)/);

let kept = [];
let dropped = [];

for (const raw of blocks) {
  let b = raw.trim();
  if (!b) continue;

  // Check for question header (may have leading batch header like '--- Batch 1 ---')
  const qMatch = b.match(/(?:^--- Batch \d+ ---\n\n)?\*{0,2}Question (\d+):\*{0,2}/);
  if (!qMatch) {
    dropped.push({ reason: 'no-header', text: b.substring(0, 80) });
    continue;
  }

  const hasStem = b.includes('**উদ্দীপক:**');
  const hasAns = /উত্তর\s*[:ঃ]/.test(b);
  const hasNoContent = /কোনো উত্তর নাই|কোন উত্তর নেই|no answer provided|no question provided/i.test(b);
  const board = (b.match(/\[Board: ([^\]]+)\]/) || [, undefined])[1];
  const qNum = qMatch[1];

  if (hasStem && hasAns && !hasNoContent) {
    let clean = b.replace(/^--- Batch \d+ ---\n\n/, '').replace(/^\*{2}(Question \d+):\*{2}/m, '$1:');
    kept.push(clean);
  } else {
    dropped.push({
      qNum,
      board,
      reason: (!hasStem ? 'NO_STEM' : '') + (!hasAns ? ' NO_ANS' : '') + (hasNoContent ? ' NO_CONTENT' : ''),
      len: b.length
    });
  }
}

const outFile = file.replace('.txt', '_cleaned.txt');
fs.writeFileSync(outFile, kept.join('\n\n---\n\n'), 'utf-8');

console.log(`Kept: ${kept.length} questions`);
for (const d of dropped) {
  console.log(`  Dropped Q${d.qNum || '?'} [${d.board||'N/A'}] ${d.reason} (${d.len}B)`);
}
console.log(`\nWritten to: ${outFile}`);
