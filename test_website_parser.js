const path = require('path');
const { parseCQQuestions } = require('./src/utils/cqParser.js');

const enFile = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_ENGLISH_new.txt';
const bnFile = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_BANGLA_new.txt';

const fs = require('fs');

const enText = fs.readFileSync(enFile, 'utf-8');
const bnText = fs.readFileSync(bnFile, 'utf-8');

console.log('=== English ===');
const enParsed = parseCQQuestions(enText, 'en');
console.log('Total:', enParsed.length);

console.log('\n=== Bangla ===');
const bnParsed = parseCQQuestions(bnText, 'bn');
console.log('Total:', bnParsed.length);

// Print details
enParsed.forEach((q, i) => {
  const parts = q.parts.map(p => p.letter + '(' + p.marks + ')').join(', ');
  console.log(`EN Q${i+1}: parts=[${parts}] board=${q.board || '—'} subject=${q.subject || '—'}`);
});

console.log('---');

bnParsed.forEach((q, i) => {
  const parts = q.parts.map(p => p.letter + '(' + p.marks + ')').join(', ');
  console.log(`BN Q${i+1}: parts=[${parts}] board=${q.board || '—'} subject=${q.subject || '—'}`);
});
