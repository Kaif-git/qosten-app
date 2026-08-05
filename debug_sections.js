const fs = require('fs');

const dir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\';
let ban = fs.readFileSync(dir + 'Ch3_CQ_BANGLA.txt', 'utf-8');

const sections = [];
let remaining = ban;

while (remaining.length > 0) {
  // Find next প্রশ্ন or Question header (anywhere in text)
  const q1 = remaining.match(/(?:^|\n)প্রশ্ন\s*[০-৯]+:|প্রশ্ন\s*[০-৯]+:/);
  const q2 = remaining.match(/(?:^|\n)Question\s+\d+:/);
  
  let firstIdx = -1;
  let firstMatch = null;
  
  if (q1 && q2) {
    if (q1.index < q2.index) { firstIdx = q1.index; firstMatch = 'old'; }
    else { firstIdx = q2.index; firstMatch = 'new'; }
  } else if (q1) { firstIdx = q1.index; firstMatch = 'old'; }
  else if (q2) { firstIdx = q2.index; firstMatch = 'new'; }
  
  if (firstIdx < 0) { remaining = ''; break; }
  
  let searchFrom = firstIdx + 10; // skip past this header
  if (searchFrom >= remaining.length) { sections.push(remaining.substring(firstIdx)); break; }
  
  const restAfter = remaining.substring(searchFrom);
  
  const q1n = restAfter.match(/(?:^|\n)প্রশ্ন\s*[০-৯]+:|প্রশ্ন\s*[০-৯]+:/);
  const q2n = restAfter.match(/(?:^|\n)Question\s+\d+:/);
  
  let nextIdx = -1;
  if (q1n) nextIdx = q1n.index + searchFrom;
  if (q2n) {
    const candidate = q2n.index + searchFrom;
    if (nextIdx < 0 || candidate < nextIdx) nextIdx = candidate;
  }
  
  if (nextIdx < 0) { sections.push(remaining.substring(firstIdx)); break; }
  
  sections.push(remaining.substring(firstIdx, nextIdx));
  remaining = remaining.substring(nextIdx);
}

console.log('Total sections:', sections.length);
for (let i = 0; i < sections.length; i++) {
  const s = sections[i].trim();
  console.log('Section ' + i + ' (' + s.length + ' chars): starts with: ' + 
    (s.startsWith('প্রশ্ন') ? 'প্রশ্ন ' + s.match(/প্রশ্ন\s*([০-৯]+)/)[1] : 
     s.startsWith('Question') ? s.split('\n')[0].substring(0, 15) : 'OTHER: ' + s.substring(0, 40)));
}
