/**
 * Debug script v2: Test the EXACT input the user provides
 * 
 * The user pasted Bangla CQs with mixed formats:
 * - Some use `[ID:]` bracketed metadata
 * - Some use `ID:` unbracketed metadata  
 * - Some use English headers/subjects
 * - Some use Bengali headers/subjects
 * 
 * This script tests the ACTUAL user input format.
 */

import { parseCQQuestions } from '../src/utils/cqParser.js';
import fs from 'fs';
import path from 'path';

const BH = '='.repeat(70);
const SH = '-'.repeat(50);

// Test with 8 CQs in the exact format the user uses
// Key variations to test:
// 1. All questions have `---` separators
// 2. All questions use `[ID:]` bracketed metadata
// 3. Some questions mix in `ID:` unbracketed metadata
// 4. Bengali and English mixed in the same input

const BH_SZ = '='.repeat(50);

// ── TEST 1: 8 CQs, all with bracketed metadata, all with --- separators ──
console.log(`\n${BH}`);
console.log('  TEST 1: 8 CQs standard format (bracketed metadata, --- separators)');
console.log(`${BH}`);

const test1 = generateTest1();
const result1 = parseCQQuestions(test1, 'bn');
console.log(`\n  RESULT: ${result1.length}/8 questions parsed`);
if (result1.length !== 8) {
  console.log(`  ❌ MISSING ${8 - result1.length} question(s)!`);
  result1.forEach((q, i) => console.log(`    [${i+1}] board="${q.board}"`));
}

// ── TEST 2: 8 CQs, NO --- separators, just header to header ──
console.log(`\n${BH}`);
console.log('  TEST 2: 8 CQs without --- separators');
console.log(`${BH}`);

const test2 = generateTest2();
const result2 = parseCQQuestions(test2, 'bn');
console.log(`\n  RESULT: ${result2.length}/8 questions parsed`);
if (result2.length !== 8) {
  console.log(`  ❌ MISSING ${8 - result2.length} question(s)!`);
}

// ── TEST 3: 8 CQs, mixed metadata format (some bracketed, some not) ──
console.log(`\n${BH}`);
console.log('  TEST 3: 8 CQs with mixed metadata format');
console.log(`${BH}`);

const test3 = generateTest3();
const result3 = parseCQQuestions(test3, 'bn');
console.log(`\n  RESULT: ${result3.length}/8 questions parsed`);
if (result3.length !== 8) {
  console.log(`  ❌ MISSING ${8 - result3.length} question(s)!`);
  // Find which one failed
  const headers = test3.match(/Question \d+/g) || [];
  console.log(`  Headers found in input: ${headers.join(', ')}`);
  result3.forEach((q, i) => console.log(`    [${i+1}] parsed as board="${q.board}"`));
}

// ── TEST 4: 8 CQs, some with Answer: on same line as last part ──
console.log(`\n${BH}`);
console.log('  TEST 4: 8 CQs with উত্তর: on same line as last part (problem format from debug script)');
console.log(`${BH}`);

const test4 = generateTest4();
const result4 = parseCQQuestions(test4, 'bn');
console.log(`\n  RESULT: ${result4.length}/8 questions parsed`);
if (result4.length !== 8) {
  console.log(`  ❌ MISSING ${8 - result4.length} question(s)!`);
}

// ── TEST 5: 8 CQs with mid-line Bangla part letters (ক. embedded in stem) ──
console.log(`\n${BH}`);
console.log('  TEST 5: 8 CQs with mid-line part letters (ক. embedded in stem line)');
console.log(`${BH}`);

const test5 = generateTest5();
const result5 = parseCQQuestions(test5, 'bn');
console.log(`\n  RESULT: ${result5.length}/8 questions parsed`);
if (result5.length !== 8) {
  console.log(`  ❌ MISSING ${8 - result5.length} question(s)!`);
  // Show what happened
  result5.forEach((q, i) => {
    console.log(`    [${i+1}] board="${q.board}", parts=${q.parts.length}, stem=${(q.questionText || '').substring(0, 60)}`);
  });
} else {
  console.log('  ✅ All 8 parsed!');
  result5.forEach((q, i) => {
    console.log(`    [${i+1}] board="${q.board}", parts=${q.parts.length}`);
    q.parts.forEach(p => console.log(`        ${p.letter}: text="${(p.text||'').substring(0,50)}", answer="${(p.answer||'').substring(0,50)}"`));
  });
}

// ── TEST 6: User's EXACT format - copy from their message ──
console.log(`\n${BH}`);
console.log('  TEST 6: ACID TEST - Mix of question formats (first Q uses unbracketed metadata, then mixed)');
console.log(`${BH}`);

const test6 = generateAcidTest();
const result6 = parseCQQuestions(test6, 'bn');
console.log(`\n  RESULT: ${result6.length}/8 questions parsed`);
result6.forEach((q, i) => {
  console.log(`    [${i+1}] board="${q.board}", parts=${q.parts.length}`);
});
if (result6.length !== 8) {
  console.log(`  ❌ BUG CONFIRMED: Only ${result6.length}/8 parsed!`);
  // Show the line-by-line trace
  console.log(`\n  --- FULL LINE-BY-LINE TRACE ---`);
  traceFull(test6);
}

// ── Helper: trace the full parsing ──
function traceFull(text) {
  // Re-parse with console output buffered
  parseCQQuestions(text, 'bn');
}

// ── TEST GENERATORS ──

function generateTest1() {
  let out = '';
  const boards = [
    'দিনাজপুর বোর্ড-২০১৭', 'কুমিল্লা বোর্ড-২০১৭', 
    'কুমিল্লা ক্যাডেট কলেজ', 'সিলেট ক্যাডেট কলেজ',
    'ঢাকা বোর্ড-২০১৭', 'চট্টগ্রাম বোর্ড-২০১৭',
    'রাজশাহী বোর্ড-২০১৭', 'বরিশাল বোর্ড-২০১৭'
  ];
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n---\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Subject: সাধারণ গণিত]\n`;
    out += `[Chapter: অনুপাত ও সদৃশতা]\n`;
    out += `[Lesson: ত্রিভুজের সদৃশতা]\n`;
    out += `[Board: ${boards[i-1]}]\n`;
    out += `Stem: ABC একটি ত্রিভুজ যেখানে D হলো BC-এর মধ্যবিন্দু।\n`;
    out += `A. প্রমাণ করো যে AB + AC > BC। (2)\n`;
    out += `B. প্রমাণ করো যে AB + AC > 2AD। (4)\n`;
    out += `C. প্রমাণ করো যে মধ্যমাত্রয় পরস্পরকে 2:1 অনুপাতে বিভক্ত করে। (4)\n`;
    out += `Answer:\n`;
    out += `A. ধাপ ১: ABC ত্রিভুজে।\n`;
    out += `B. ধাপ ১: AD মধ্যমা।\n`;
    out += `C. ধাপ ১: AD, BE, CF মধ্যমা।\n`;
  }
  return out;
}

function generateTest2() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Subject: সাধারণ গণিত]\n`;
    out += `[Chapter: অনুপাত ও সদৃশতা]\n`;
    out += `[Board: বোর্ড-${2000+i}]\n`;
    out += `Stem: ABC একটি ত্রিভুজ।\n`;
    out += `A. প্রমাণ করো। (2)\n`;
    out += `B. দেখাও যে। (4)\n`;
    out += `Answer:\n`;
    out += `A. উত্তর এখানে।\n`;
    out += `B. উত্তর এখানে।\n`;
  }
  return out;
}

function generateTest3() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n---\n\n';
    out += `Question ${i}:\n`;
    if (i % 2 === 0) {
      // Unbracketed metadata (like the user's second Question 2)
      out += `ID: ${i}\n`;
      out += `Subject: সাধারণ গণিত\n`;
      out += `Chapter: অনুপাত ও সদৃশতা\n`;
      out += `Board: বোর্ড ${i}\n`;
    } else {
      // Bracketed metadata
      out += `[ID: ${i}]\n`;
      out += `[Subject: সাধারণ গণিত]\n`;
      out += `[Chapter: অনুপাত ও সদৃশতা]\n`;
      out += `[Board: বোর্ড ${i}]\n`;
    }
    out += `Stem: ABC একটি ত্রিভুজ।\n`;
    out += `A. প্রমাণ করো। (2)\n`;
    out += `B. দেখাও যে। (4)\n`;
    out += `Answer:\n`;
    out += `A. উত্তর।\n`;
    out += `B. উত্তর।\n`;
  }
  return out;
}

function generateTest4() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n---\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Board: বোর্ড ${i}]\n`;
    out += `Stem: ABC একটি ত্রিভুজ।\n`;
    out += `ক. প্রমাণ করো। (২)\n`;
    out += `খ. দেখাও যে। (৪)\n`;
    if (i < 8) {
      out += `গ. প্রমাণ করো। (৪)উত্তর:\n`;
    } else {
      out += `গ. প্রমাণ করো। (৪)উত্তর:\n`;
    }
    out += `ক. উত্তর ক।\n`;
    out += `খ. উত্তর খ।\n`;
    out += `গ. উত্তর গ।\n`;
  }
  return out;
}

function generateTest5() {
  let out = '';
  for (let i = 1; i <= 8; i++) {
    if (i > 1) out += '\n---\n\n';
    out += `Question ${i}:\n`;
    out += `[ID: ${i}]\n`;
    out += `[Board: বোর্ড ${i}]\n`;
    out += `Stem: ABC একটি ত্রিভুজ যেখানে D হলো BC এর মধ্যবিন্দু।ক. প্রমাণ করো AB > AC (২)\n`;
    out += `খ. দেখাও যে AB + AC > BC (৪)\n`;
    out += `গ. প্রমাণ করো যে মধ্যমাত্রয় 2:1 অনুপাতে বিভক্ত (৪)উত্তর:\n`;
    out += `ক. উত্তর ক।\n`;
    out += `খ. উত্তর খ।\n`;
    out += `গ. উত্তর গ।\n`;
  }
  return out;
}

function generateAcidTest() {
  // This test mixes the actual formats seen in the user's paste
  let out = '';
  
  // Question 1: bracketed metadata, Bengali, standard format
  out += `Question 1:\n`;
  out += `[ID: 1]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]\n`;
  out += `[Lesson: ত্রিভুজের সদৃশতা]\n`;
  out += `[Board: দিনাজপুর বোর্ড-২০১৭]\n`;
  out += `Stem: PQR-এ, P-এর দ্বিখণ্ডক PS, QR-কে S বিন্দুতে ছেদ করে। RT, SP-এর সমান্তরাল যা QP-এর বর্ধিত অংশকে T বিন্দুতে ছেদ করে।\n`;
  out += `A. দেখাও যে, যদি দুটি ত্রিভুজের ভূমি সমান হয়, তবে তাদের উচ্চতা এবং ক্ষেত্রফল সমানুপাতিক হয়। (2)\n`;
  out += `B. প্রমাণ করো যে, QS : SR = PQ : PR। (4)\n`;
  out += `C. যদি QR-এর সমান্তরাল একটি রেখাংশ PQ এবং PR-কে যথাক্রমে M এবং N বিন্দুতে ছেদ করে, তবে প্রমাণ করো যে, QS : SR = MQ : NR। (4)\n`;
  out += `Answer:\n`;
  out += `A. ধাপ ১: মনে করি দুটি ত্রিভুজের ভূমি সমান b এবং উচ্চতা h1 ও h2।\n`;
  out += `B. ধাপ ১: SP || RT এবং PR ছেদক বলে PTR = QPS।\n`;
  out += `C. ধাপ ১: B থেকে QS/SR = PQ/PR।\n`;
  out += `\n---\n\n`;

  // Question 2: unbracketed metadata, English subject
  out += `Question 2:\n`;
  out += `ID: 2\n`;
  out += `Subject: General Mathematics\n`;
  out += `Chapter: Ratio, Similarity and Symmetry\n`;
  out += `Lesson: Properties of Similar Triangles\n`;
  out += `Board: Millennium Scholastic School & College, Bogura\n`;
  out += `Stem: ABC-এ, B এবং C-এর দ্বিখণ্ডকদ্বয় O বিন্দুতে ছেদ করে।\n`;
  out += `A. ত্রিভুজের অনুরূপ বাহু এবং অনুরূপ কোণগুলোর নাম লেখো। (2)\n`;
  out += `B. প্রমাণ করো যে, BOC = 90° + A/2। (4)\n`;
  out += `C. প্রমাণ করো যে, A + B + C = 180°। (4)\n`;
  out += `Answer:\n`;
  out += `A. ধাপ ১: ABC ও DEF সদৃশ ত্রিভুজ।\n`;
  out += `B. ধাপ ১: ABC-এ, A + B + C = 180°।\n`;
  out += `C. ধাপ ১: A দিয়ে BC-এর সমান্তরাল রেখা টানলে।\n`;
  out += `\n---\n\n`;

  // Question 3: bracketed, Bengali
  out += `Question 3:\n`;
  out += `[ID: 3]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Chapter: অনুপাত এবং সদৃশতা]\n`;
  out += `[Board: কুমিল্লা বোর্ড-২০১৭]\n`;
  out += `Stem: ABC এবং DEF দুটি সমকোণ বিশিষ্ট ত্রিভুজ।\n`;
  out += `A. চিত্র অঙ্কন করো। (2)\n`;
  out += `B. প্রমাণ করো AG : DH = AB : DE। (4)\n`;
  out += `Answer:\n`;
  out += `A. ধাপ ১: ABC এবং DEF অঙ্কন করো।\n`;
  out += `B. ধাপ ১: ABG এবং DEH-এ।\n`;
  out += `\n---\n\n`;

  // Question 4: Long board name
  out += `Question 4:\n`;
  out += `[ID: 4]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Board: বিএএফ শাহীন কলেজ, তেজগাঁও, ঢাকা]\n`;
  out += `Stem: ABC একটি ত্রিভুজ।\n`;
  out += `A. প্রমাণ করো। (2)\n`;
  out += `B. দেখাও যে। (4)\n`;
  out += `C. প্রমাণ করো। (4)\n`;
  out += `Answer:\n`;
  out += `A. উত্তর।\n`;
  out += `B. উত্তর।\n`;
  out += `C. উত্তর।\n`;
  out += `\n---\n\n`;

  // Question 5: with --- separator
  out += `Question 5:\n`;
  out += `[ID: 5]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Board: সিলেট বোর্ড]\n`;
  out += `Stem: ABC একটি সমকোণী ত্রিভুজ।\n`;
  out += `A. প্রমাণ করো পিথাগোরাসের উপপাদ্য। (2)\n`;
  out += `B. প্রয়োগ করো। (4)\n`;
  out += `Answer:\n`;
  out += `A. ধাপ ১: সমকোণী ত্রিভুজে অতিভুজ বর্গ।\n`;
  out += `B. ধাপ ১: প্রয়োগ করে দেখাও।\n`;
  out += `\n---\n\n`;

  // Question 6: multi-paragraph stem
  out += `Question 6:\n`;
  out += `[ID: 6]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Board: যশোর বোর্ড]\n`;
  out += `Stem: দৃশ্যপট-I: ABC-এ, B এবং C-এর দ্বিখণ্ডক O বিন্দুতে ছেদ করে।\n`;
  out += `দৃশ্যপট-II: ABC এবং DEF সদৃশ ত্রিভুজ।\n`;
  out += `A. অনুরূপ বাহু লেখো। (2)\n`;
  out += `B. ক্ষেত্রফলের অনুপাত প্রমাণ করো। (4)\n`;
  out += `C. BOC = 90° + A/2 প্রমাণ করো। (4)\n`;
  out += `Answer:\n`;
  out += `A. AB ↔ DE, BC ↔ EF।\n`;
  out += `B. প্রমাণ: ABC ~ DEF।\n`;
  out += `C. প্রমাণ: BOC = 90° + A/2।\n`;
  out += `\n---\n\n`;

  // Question 7: simple
  out += `Question 7:\n`;
  out += `[ID: 7]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Board: বগুড়া বোর্ড]\n`;
  out += `Stem: PQR একটি ত্রিভুজ।\n`;
  out += `A. অঙ্কন করো। (2)\n`;
  out += `B. প্রমাণ করো। (4)\n`;
  out += `Answer:\n`;
  out += `A. অঙ্কন।\n`;
  out += `B. প্রমাণ।\n`;
  out += `\n---\n\n`;

  // Question 8: same format as first
  out += `Question 8:\n`;
  out += `[ID: 8]\n`;
  out += `[Subject: সাধারণ গণিত]\n`;
  out += `[Chapter: অনুপাত এবং সদৃশতা]\n`;
  out += `[Board: চট্টগ্রাম বোর্ড-২০১৭]\n`;
  out += `Stem: ABC-এ, AD একটি মধ্যমা।\n`;
  out += `A. প্রমাণ করো AB + AC > 2AD। (2)\n`;
  out += `B. দেখাও যে মধ্যমাত্রয় 2:1 অনুপাতে বিভক্ত। (4)\n`;
  out += `Answer:\n`;
  out += `A. ধাপ ১: AD-কে E পর্যন্ত বর্ধিত করি।\n`;
  out += `B. ধাপ ১: মধ্যমা AD এবং BE।\n`;

  return out;
}
