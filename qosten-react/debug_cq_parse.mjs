import { readFileSync } from 'fs';
import { parseCQQuestions } from './src/utils/cqParser.js';

const text = readFileSync("D:/OpenClawAutomations/Super Question Processing/organized_output/Bangladesh_Studies/Ch15_CQ/Ch15_CQ_BANGLA.txt", 'utf-8');
const questions = parseCQQuestions(text, 'bn');

console.log('\n===== FULL RESULTS =====');
console.log(`Total questions parsed: ${questions.length}`);

let missingCParts = 0;
let missingDParts = 0;

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const idx = i + 1;
  const hasC = q.parts.some(p => p.letter === 'c');
  const hasD = q.parts.some(p => p.letter === 'd');
  
  const cPart = q.parts.find(p => p.letter === 'c');
  const dPart = q.parts.find(p => p.letter === 'd');
  
  const cMissing = hasC && (!cPart.answer || cPart.answer.trim() === '' || cPart.answer === '[অনুপস্থিত]');
  const dMissing = hasD && (!dPart.answer || dPart.answer.trim() === '' || dPart.answer === '[অনুপস্থিত]');
  
  if (!hasC || !hasD || cMissing || dMissing) {
    console.log(`\n--- Question ${idx} (ID: ${q.id || 'N/A'}) ---`);
    console.log(`  Board: ${q.board || 'N/A'}`);
    console.log(`  Parts letters: [${q.parts.map(p => p.letter).join(', ')}]`);
    if (!hasC) console.log('  ❌ Part c MISSING entirely');
    else if (cMissing) console.log(`  ❌ Part c answer empty/missing: "${cPart.answer?.substring(0, 50)}"`);
    if (!hasD) console.log('  ❌ Part d MISSING entirely');
    else if (dMissing) console.log(`  ❌ Part d answer empty/missing: "${dPart.answer?.substring(0, 50)}"`);
    
    if (q.parts.some(p => p.letter === 'c' || p.letter === 'd')) {
      q.parts.filter(p => p.letter === 'c' || p.letter === 'd').forEach(p => {
        console.log(`  Part ${p.letter}: text="${p.text.substring(0, 80)}" answer="${p.answer.substring(0, 80)}"`);
      });
    }
    
    if (idx >= 28 && idx <= 45) missingCParts++;
  }
}

// Also check for parts with [অনুপস্থিত] text
console.log('\n\n===== QUESTIONS WITH [অনুপস্থিত] PATTERN =====');
for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const idx = i + 1;
  for (const p of q.parts) {
    if (p.text.includes('অনুপস্থিত') || p.answer.includes('অনুপস্থিত')) {
      console.log(`Q${idx} part ${p.letter}: text="${p.text.substring(0,60)}" answer="${p.answer.substring(0,60)}"`);
    }
  }
  // Check for "সৃজনশীল প্রশ্ন-উত্তর" references
  for (const p of q.parts) {
    if (p.answer.includes('সৃজনশীল প্রশ্ন') || p.answer.includes('অনুরূপ')) {
      console.log(`Q${idx} part ${p.letter}: answer="${p.answer.substring(0,80)}"`);
    }
  }
}

console.log('\n\n===== SUMMARY =====');
console.log(`Questions 28-45 with c/d issues: ${missingCParts}`);
