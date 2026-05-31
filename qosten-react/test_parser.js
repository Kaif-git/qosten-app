const fs = require('fs');
const path = require('path');

// Import the actual module
const { parseCQFromMD } = require('./src/utils/cqMDParser.js');

const md = fs.readFileSync(path.join(__dirname, 'New Format', 'Physics ch11 cq-2026-05-18_06-22-28.md'), 'utf8');
console.log('File size:', md.length, 'bytes');

const result = parseCQFromMD(md, 'en');
console.log('Total questions:', result.length);

result.forEach((q, i) => {
  const parts = q.parts.map(p => p.letter + '(' + p.marks + ')').join(', ');
  const stemImg = q.image ? '✓' : '—';
  const ansImgs = q.parts.filter(p => p.answerImage).length;
  console.log('Q' + (i+1) + ': parts=[' + parts + '] stem=' + stemImg + ' ansImgs=' + ansImgs + ' board=' + (q.board || '—'));
});
