/**
 * Debug script: Test with the EXACT text format the user provided
 * 
 * Key observation: The user's data has questions WITHOUT `---` between them
 * in some places, and the header `Question X:` is the ONLY separator.
 * 
 * Also testing: 
 * - What if there's NO `---` between any questions?
 * - What if some questions are missing answers?
 * - What if format is Question: header only, no metadata brackets?
 */

import { parseCQQuestions } from '../src/utils/cqParser.js';

const BH = '='.repeat(70);

// TEST: Parse 8 CQs where the first Question 1 has no answer section
// and Question 2 starts right after
console.log(`${BH}`);
console.log('  TEST A: Q1 has no Answer section, Q2 starts right after');
console.log(`${BH}`);

const testA = makeTestA();
const resultA = parseCQQuestions(testA, 'bn');
console.log(`\n  Result: ${resultA.length}/8`);
resultA.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}, stem="${(q.questionText||'').substring(0,40)}"`));
if (resultA.length < 8) console.log('  ❌ BUG: Missing question(s)!');

// TEST: First line is a "Question 1" but starts at beginning of text
// (no leading whitespace, no preamble)
console.log(`\n${BH}`);
console.log('  TEST B: 8 CQs with NO --- separator, only Question headers');
console.log(`${BH}`);

const testB = makeTestB();
const resultB = parseCQQuestions(testB, 'bn');
console.log(`\n  Result: ${resultB.length}/8`);
resultB.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
if (resultB.length < 8) console.log('  ❌ BUG: Missing question(s)!');

// TEST: Mixed format - English letter parts mixed with Bengali answers
console.log(`\n${BH}`);
console.log('  TEST C: 8 CQs with mixed width Unicode chars, BOM prefix');
console.log(`${BH}`);

const testC = '\uFEFF' + makeTestB();
const resultC = parseCQQuestions(testC, 'bn');
console.log(`\n  Result: ${resultC.length}/8`);
resultC.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
if (resultC.length < 8) console.log('  ❌ BUG: BOM caused missing question(s)!');

// TEST: What if ONE question has "প্রশ্ন" instead of "Question"
console.log(`\n${BH}`);
console.log('  TEST D: One question uses "প্রশ্ন X:" header instead of "Question X:"');
console.log(`${BH}`);

const testD = makeTestD();
const resultD = parseCQQuestions(testD, 'bn');
console.log(`\n  Result: ${resultD.length}/8`);
resultD.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
if (resultD.length < 8) console.log('  ❌ BUG: Missing question(s)!');

// TEST: Long board names causing header to be >60 chars
console.log(`\n${BH}`);
console.log('  TEST E: Question header line > 60 chars (triggering length check)');
console.log(`${BH}`);

const testE = makeTestE();
const resultE = parseCQQuestions(testE, 'bn');
console.log(`\n  Result: ${resultE.length}/8`);
resultE.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
if (resultE.length < 8) console.log(`  ❌ Headers with line.length >= 60 can be missed!`);

// TEST: What if metadata has trailing text after bracket
console.log(`\n${BH}`);
console.log('  TEST F: 8 CQs with Question: header looking like "Question: (Board Name):"');
console.log(`${BH}`);

const testF = makeTestF();
const resultF = parseCQQuestions(testF, 'bn');
console.log(`\n  Result: ${resultF.length}/8`);
resultF.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
if (resultF.length < 8) console.log('  ❌ BUG: Missing question(s)!');

// TEST: Each question starts with "Question X:" on the same line as first metadata
console.log(`\n${BH}`);
console.log('  TEST G: 8 CQs, Question header contains metadata [ID:X]');
console.log(`${BH}`);

const testG = makeTestG();
const resultG = parseCQQuestions(testG, 'bn');
console.log(`\n  Result: ${resultG.length}/8`);
resultG.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
if (resultG.length < 8) console.log('  ❌ BUG: Missing question(s)!');

// TEST: 9 questions (one more than 8)
console.log(`\n${BH}`);
console.log('  TEST H: 9 CQs standard format');
console.log(`${BH}`);

const testH = makeTestH();
const resultH = parseCQQuestions(testH, 'bn');
console.log(`\n  Result: ${resultH.length}/9`);
if (resultH.length < 9) console.log(`  ❌ Only ${resultH.length}/9 parsed!`);

// ── TEST GENERATORS ──

function makeTestA() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Board: Board ${i}]\n`;
    out += `Stem: This is stem for question ${i}.\n`;
    out += `A. Part A text. (2)\n`;
    out += `B. Part B text. (4)\n`;
    if (i % 2 === 0) {
      // Even questions have answer section
      out += `Answer:\n`;
      out += `A. Answer A.\n`;
      out += `B. Answer B.\n`;
    }
    // Odd questions have NO answer section!
  }
  return out;
}

function makeTestB() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Subject: Mathematics]\n`;
    out += `[Board: Board ${i}]\n`;
    out += `Stem: Stem text for Q${i}.\n`;
    out += `A. Part A (2)\n`;
    out += `B. Part B (4)\n`;
    out += `Answer:\n`;
    out += `A. Answer A.\n`;
    out += `B. Answer B.\n`;
  }
  return out;
}

function makeTestD() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    if (i === 5) {
      out += `প্রশ্ন ৫:\n`;
    } else {
      out += `Question ${i}:\n`;
    }
    out += `[ID: ${i}]\n`;
    out += `[Board: Board ${i}]\n`;
    out += `Stem: Stem text.\n`;
    out += `A. Part A (2)\n`;
    out += `B. Part B (4)\n`;
    out += `Answer:\n`;
    out += `A. Answer A.\n`;
    out += `B. Answer B.\n`;
  }
  return out;
}

function makeTestE() {
  // Question headers with extra text to make them >60 chars
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    // Make the header long by adding board info inline
    // "Question 1: [ID: 1] [Subject: Something very long that makes this line exceed sixty characters total]"
    if (i % 3 === 0) {
      // These headers are > 60 chars
      out += `Question ${i}: [ID: ${i}] [Subject: Very Long Subject Name That Makes This Header Line Exceed Sixty Characters And More]\n`;
    } else {
      out += `Question ${i}:\n`;
    }
    if (i % 3 !== 0) {
      out += `[ID: ${i}]\n`;
    }
    out += `[Board: Board ${i}]\n`;
    out += `Stem: Stem text.\n`;
    out += `A. Part A (2)\n`;
    out += `B. Part B (4)\n`;
    out += `Answer:\n`;
    out += `A. Answer A.\n`;
    out += `B. Answer B.\n`;
  }
  return out;
}

function makeTestF() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    out += `Question ${i}: (Board ${i} Board-2024)\n`;
    out += `[ID: ${i}]\n`;
    out += `[Subject: Mathematics]\n`;
    out += `Stem: Stem text.\n`;
    out += `A. Part A (2)\n`;
    out += `B. Part B (4)\n`;
    out += `Answer:\n`;
    out += `A. Answer A.\n`;
    out += `B. Answer B.\n`;
  }
  return out;
}

function makeTestG() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    out += `Question ${i}: [ID: ${i}] [Subject: Mathematics] [Board: Board ${i}]\n`;
    out += `Stem: Stem text.\n`;
    out += `A. Part A (2)\n`;
    out += `B. Part B (4)\n`;
    out += `Answer:\n`;
    out += `A. Answer A.\n`;
    out += `B. Answer B.\n`;
  }
  return out;
}

function makeTestH() {
  let out = '';
  for (let i = 1; i <= 9; i++) {
    if (i > 1) out += '\n---\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Subject: Mathematics]\n`;
    out += `[Board: Board ${i}]\n`;
    out += `Stem: Stem text.\n`;
    out += `A. Part A (2)\n`;
    out += `B. Part B (4)\n`;
    out += `Answer:\n`;
    out += `A. Answer A.\n`;
    out += `B. Answer B.\n`;
  }
  return out;
}
