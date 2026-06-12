/**
 * Debug: Test what happens when Question 1 is prepended to the existing 7 questions
 * The file currently has Q2-Q7+Q2 (7 questions). 
 * User is adding more CQs - what happens when Q1 is added at the start?
 */

import { parseCQQuestions } from '../src/utils/cqParser.js';
import fs from 'fs';

const FILE = "D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\General_Mathematics\\Ch14_CQ\\Ch14_CQ_BANGLA.txt";

const original = fs.readFileSync(FILE, 'utf8');

// Test: Prepend Question 1 (making 8 total)
const q1 = `Question 1:
[ID: 1]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: ঢাকা বোর্ড-২০১৭]
Stem: ABC একটি সমবাহু ত্রিভুজ।
A. প্রমাণ করো যে ত্রিভুজটির কোণগুলো সমান। (2)
B. দেখাও যে ত্রিভুজটির মধ্যমা ও শীর্ষলম্ব একই। (4)
Answer:
A. ধাপ ১: সমবাহু ত্রিভুজের তিন বাহু সমান।
B. ধাপ ১: মধ্যমা ও শীর্ষলম্ব একই সরলরেখায় অবস্থিত।

---

`;

const testText = q1 + original;

console.log('='.repeat(70));
console.log('  TEST: Prepend Question 1 to existing 7 questions');
console.log('='.repeat(70));
console.log(`Input length: ${testText.length} chars`);

const headers = testText.match(/^Question \d+:/gm) || [];
console.log(`Headers found: ${headers.length}`);
headers.forEach((h, i) => console.log(`  ${i+1}: ${h}`));

const questions = parseCQQuestions(testText, 'bn');
console.log(`\nParsed: ${questions.length}/8`);
if (questions.length < 8) {
  console.log('❌ BUG: Missing question(s)!');
  questions.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}"`));
} else {
  console.log('✅ All 8 parsed successfully!');
}

// Test: What if the very first question has DIFFERENT format?
// E.g., what if it starts with metadata without a Question header first?
console.log(`\n${'='.repeat(70)}`);
console.log('  TEST: Prepended content with NO Question header (just metadata)');
console.log('='.repeat(70));

const q1_noheader = `[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা]
[Board: ঢাকা বোর্ড]
Stem: ABC একটি ত্রিভুজ।
A. প্রমাণ করো। (2)
B. দেখাও যে। (4)
Answer:
A. উত্তর ক।
B. উত্তর খ।

---

`;

const testText2 = q1_noheader + original;
const headers2 = testText2.match(/^Question \d+:/gm) || [];
console.log(`Headers found: ${headers2.length}`);
headers2.forEach((h, i) => console.log(`  ${i+1}: ${h}`));

const questions2 = parseCQQuestions(testText2, 'bn');
console.log(`\nParsed: ${questions2.length}`);
questions2.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));

// Test: What if Question 1 and Question 2 are NOT separated by --- ?
console.log(`\n${'='.repeat(70)}`);
console.log('  TEST: Missing --- separator between Q1 and Q2');
console.log('='.repeat(70));

const q1_nosep = `Question 1:
[ID: 1]
[Subject: সাধারণ গণিত]
[Board: ঢাকা বোর্ড]
Stem: ABC একটি ত্রিভুজ।
A. প্রমাণ করো। (2)
B. দেখাও যে। (4)
Answer:
A. উত্তর ক।
B. উত্তর খ।

`;
// No --- between Q1 and Q2
const testText3 = q1_nosep + original;
const headers3 = testText3.match(/^Question \d+:/gm) || [];
console.log(`Headers found: ${headers3.length}`);

const questions3 = parseCQQuestions(testText3, 'bn');
console.log(`\nParsed: ${questions3.length}/8`);
if (questions3.length < 8) {
  console.log('❌ BUG: Missing question(s)!');
  questions3.forEach((q, i) => console.log(`  [${i+1}] board="${q.board}", parts=${q.parts.length}`));
} else {
  console.log('✅ All 8 parsed successfully!');
}
