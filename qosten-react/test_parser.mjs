import { parseCQFromMD } from './src/utils/cqMDParser.js';
import fs from 'fs';

const md = fs.readFileSync('New Format/Physics ch11 cq-2026-05-18_06-22-28.md', 'utf8');
console.log('File size:', md.length);

// Debug: check what's at position 736-1454
console.log('\n=== Content at index 736-740 ===');
console.log(JSON.stringify(md.substring(736, 740)));
console.log('=== Content at index 738-742 ===');
console.log(JSON.stringify(md.substring(738, 742)));

// Check Q1 marker details
const MARKER = /^(?:##\s*)?(?:Ques\.?\s*[►>]?\s*|Answer to the question(?: no)?\.?\s*[►>]?\s*)(\d+)/gim;
const markers = [];
let m;
while ((m = MARKER.exec(md)) !== null) {
  const fullLen = m[0].length;
  console.log('\nMarker at', m.index, ':', JSON.stringify(m[0]), 'len=' + fullLen, 'num=' + m[1]);
  console.log('  Char at index', m.index, ':', JSON.stringify(md[m.index]));
  console.log('  Content after marker starts at', (m.index + fullLen) + ':' , JSON.stringify(md.substring(m.index + fullLen, m.index + fullLen + 20)));
  markers.push({ index: m.index, num: parseInt(m[1]), isQues: /(?:^|\s)Ques/i.test(m[0]) });
  if (markers.length >= 3) break;
}

// Now test the full parse
const result = parseCQFromMD(md, 'en');
console.log('\nTotal questions:', result.length);
result.forEach((q, i) => {
  const chkParts = q.parts.map(p => p.letter + '(' + p.marks + ',' + p.answerImage?.substring(0, 20)?.replace(/https?:\/\//, '')?.substring(0, 20) + ')').join(', ');
  const stemImg = q.image ? 'Y' : 'N';
  console.log('Q' + (i+1) + ': parts=[' + chkParts + '] stem=' + stemImg + ' board=' + (q.board || 'N/A'));
});
