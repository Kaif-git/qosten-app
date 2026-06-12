/**
 * Debug the user's actual file: Ch14_CQ_BANGLA.txt
 * 8 CQs expected, user says only 7 parsed
 */

import { parseCQQuestions } from '../src/utils/cqParser.js';
import fs from 'fs';

const FILE = "D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\General_Mathematics\\Ch14_CQ\\Ch14_CQ_BANGLA.txt";

const text = fs.readFileSync(FILE, 'utf8');
console.log('='.repeat(70));
console.log('  PARSING USER FILE: Ch14_CQ_BANGLA.txt');
console.log('='.repeat(70));
console.log(`File size: ${text.length} chars`);

// Count question headers
const headerCount = (text.match(/^Question \d+:/gm) || []).length;
console.log(`Question headers found: ${headerCount}`);

// Show each header
const headers = text.match(/^Question \d+:/gm) || [];
headers.forEach((h, i) => console.log(`  Header ${i+1}: ${h}`));

// Parse
const questions = parseCQQuestions(text, 'bn');
console.log(`\nParsed questions: ${questions.length}`);

// Summary
questions.forEach((q, i) => {
  const id = q.id || 'N/A';
  const board = q.board || 'N/A';
  const parts = q.parts.length;
  const stem = (q.questionText || '').substring(0, 80).replace(/\n/g, '\\n');
  console.log(`  [${i+1}] ID=${id}, Board=${board}, Parts=${parts}`);
  console.log(`        Stem: ${stem}...`);
  q.parts.forEach(p => {
    const hasAns = (p.answer || '').trim() ? '✓' : '✗';
    console.log(`        ${p.letter}: text="${(p.text||'').substring(0,40)}" answer[${hasAns}]`);
  });
});

// Check if any question was completely dropped
if (questions.length < headerCount) {
  console.log(`\n❌ BUG CONFIRMED: ${headerCount} headers but only ${questions.length} parsed!`);
} else if (questions.length === headerCount) {
  console.log(`\n✅ All ${headerCount} questions parsed successfully`);
}

// Now show detailed trace to find the problem
console.log(`\n${'='.repeat(70)}`);
console.log('  DETAILED LINE-BY-LINE TRACE');
console.log(`${'='.repeat(70)}`);

const lines = text.split('\n');
let questionCounter = 0;
let lastDetectedHeader = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Check if this line looks like a question header
  const isQH = /^(Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)[:ঃ]?\s*\d+/i.test(line);
  if (isQH) {
    questionCounter++;
    lastDetectedHeader = line;
    console.log(`\n[LINE ${i+1}] >>> HEADER ${questionCounter}: ${line}`);
  }
}

console.log(`\nHeaders counted by regex: ${questionCounter}`);
