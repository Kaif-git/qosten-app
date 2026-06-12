/**
 * Debug ALL Ch14 CQ files to find the 8→7 parsing bug
 */
import { parseCQQuestions } from '../src/utils/cqParser.js';
import fs from 'fs';

const DIR = "D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\General_Mathematics\\Ch14_CQ\\";
const files = ["Ch14_CQ_BANGLA.txt", "Ch14_CQ_BANGLA_new.txt", "Ch14_CQ_ENGLISH.txt", "Ch14_CQ_ENGLISH_new.txt"];

for (const fname of files) {
  const filePath = DIR + fname;
  const text = fs.readFileSync(filePath, 'utf8');
  const headers = (text.match(/^Question \d+:/gm) || []).length;
  const questions = parseCQQuestions(text, 'bn');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  FILE: ${fname}`);
  console.log(`  Headers: ${headers} | Parsed: ${questions.length}`);
  console.log(`${'='.repeat(60)}`);
  
  if (headers !== questions.length) {
    console.log(`  ❌ MISMATCH: ${headers} headers vs ${questions.length} parsed`);
    // Show what we got
    questions.forEach((q, i) => {
      const board = q.board || '(none)';
      const parts = q.parts.length;
      const stem = (q.questionText || '').substring(0, 60).replace(/\n/g, ' ');
      console.log(`    [${i+1}] board="${board}" parts=${parts} stem="${stem}..."`);
    });
  } else {
    console.log(`  ✅ Match: ${questions.length} questions`);
    questions.forEach((q, i) => {
      console.log(`    [${i+1}] board="${q.board || '(none)'}" parts=${q.parts.length}`);
    });
  }
}
