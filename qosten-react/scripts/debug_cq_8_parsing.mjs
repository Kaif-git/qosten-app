/**
 * Debug script: Test parsing 8 Bangla CQ questions
 * 
 * The user reports: "in bangla cq, if i add 8 cqs, it parses only 7"
 * 
 * This script:
 * 1. Creates 8 Bangla CQ questions in the same format the user pastes
 * 2. Runs them through parseCQQuestions
 * 3. Reports which question numbers are found and which are missing
 * 4. Provides a detailed line-by-line trace
 */

import { parseCQQuestions } from '../src/utils/cqParser.js';

// ── Helpers ──────────────────────────────────────────────────────────
const BH = '='.repeat(70);
const SH = '-'.repeat(50);

function showParsed(q, idx) {
  console.log(`\n  Question ${idx}: ${q.subject || '(no subject)'} | Board: ${q.board || '(none)'}`);
  console.log(`  Stem: ${(q.questionText || '').substring(0, 80)}...`);
  console.log(`  Parts (${q.parts.length}): ${q.parts.map(p => `${p.letter}`).join(', ')}`);
}

function showSummary(questions) {
  console.log(`\n${SH}`);
  console.log('  SUMMARY');
  console.log(`${SH}`);
  console.log(`  Total parsed: ${questions.length}`);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`  [${i + 1}] ID=${q.id || 'N/A'}, Board=${q.board || 'N/A'}, Parts=${q.parts.length}`);
  }
}

// ── Create 8 Bangla CQ Test Questions ────────────────────────────────
// Format matches what the user pastes (Bangla format with "Question X:" header,
// metadata without brackets, stem, sub-questions, answers)

const testInput = generate8CQs();

console.log(BH);
console.log('  DEBUG: Parsing 8 Bangla CQ Questions');
console.log(BH);
console.log(`\nInput length: ${testInput.length} chars`);

// Parse all at once (how the user does it)
const questions = parseCQQuestions(testInput, 'bn');

console.log(`\n${BH}`);
console.log(`  RESULT: Parsed ${questions.length} out of 8`);
console.log(`${BH}`);

showSummary(questions);

// Count how many are missing
if (questions.length < 8) {
  console.log(`\n  ❌ BUG CONFIRMED: Only ${questions.length}/8 questions parsed!`);
  const missing = 8 - questions.length;
  console.log(`     ${missing} question(s) missing!`);
} else if (questions.length === 8) {
  console.log(`\n  ✅ All 8 questions parsed successfully`);
} else {
  console.log(`\n  ⚠️ Unexpected: ${questions.length} questions parsed`);
}

// ── Now try parsing one at a time to check if each individual parse works ──
console.log(`\n${BH}`);
console.log('  INDIVIDUAL PARSING TEST (parse each CQ separately)');
console.log(`${BH}`);

// Split input by "Question X:" boundaries
const splitPattern = /(?=Question\s+\d+:)/i;
const blocks = testInput.split(splitPattern).filter(b => b.trim());
console.log(`\nTotal blocks found by split: ${blocks.length}`);

for (let i = 0; i < blocks.length; i++) {
  const singleResult = parseCQQuestions(blocks[i], 'bn');
  const header = (blocks[i].match(/Question\s+\d+/i) || ['?'])[0];
  console.log(`  ${header}: parsed ${singleResult.length} question(s)`);
  if (singleResult.length === 0) {
    console.log(`    ❌ BLOCK FAILED TO PARSE!`);
    console.log(`    First 200 chars: ${blocks[i].trim().substring(0, 200)}`);
  } else {
    const q = singleResult[0];
    console.log(`    Board: ${q.board}, Parts: ${q.parts.length}`);
  }
}

// ── Detailed trace for the block that fails ─────────────────────────
console.log(`\n${BH}`);
console.log('  DETAILED TRACE');
console.log(`${BH}`);

// Find which block fails
for (let i = 0; i < blocks.length; i++) {
  const singleResult = parseCQQuestions(blocks[i], 'bn');
  if (singleResult.length === 0) {
    console.log(`\n⚠️ Block ${i + 1} FAILED. Tracing...\n`);
    traceParsing(blocks[i], i + 1);
  }
}

function traceParsing(text, blockNum) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  console.log(`  Block ${blockNum} has ${lines.length} non-empty lines`);
  lines.forEach((l, idx) => {
    console.log(`  [L${idx}] ${l.substring(0, 120)}`);
  });
}

// ── Input generation function ────────────────────────────────────────
function generate8CQs() {
  return `Question 1:
[ID: 1]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: দিনাজপুর বোর্ড-২০১৭]
Stem: ABC একটি ত্রিভুজ। D হলো BC-এর মধ্যবিন্দু।
A. প্রমাণ করো যে ত্রিভুজের যেকোনো দুই বাহুর সমষ্টি তৃতীয় বাহু অপেক্ষা বড়। (2)
B. প্রমাণ করো যে, AB + AC > 2AD। (4)
C. প্রমাণ করো যে, ABC ত্রিভুজের মধ্যমাত্রয় পরস্পরকে 2:1 অনুপাতে বিভক্ত করে। (4)
Answer:
A. ধাপ ১: মনে করি ABC একটি ত্রিভুজ।
ধাপ ২: AB এর বর্ধিতাংশে B বিন্দুর পর BE = AC নিয়ে E বিন্দু চিহ্নিত করি।
ধাপ ৩: C এবং E যোগ করি।
ধাপ ৪: ACE ত্রিভুজে, AC = BE এবং AB সাধারণ বাহু।
ধাপ ৫: সুতরাং, AB + AC > BC।
[Proved]

B. ধাপ ১: AD মধ্যমা।
ধাপ ২: AB + AC > 2AD প্রমাণ করতে হবে।
ধাপ ৩: ত্রিভুজ ABD-এ, AB + BD > AD।
ধাপ ৪: ত্রিভুজ ACD-এ, AC + CD > AD।
ধাপ ৫: যোগ করে পাই, AB + AC + (BD + CD) > 2AD।
ধাপ ৬: BD + CD = BC, এবং BC > 0।
ধাপ ৭: AB + AC > 2AD।
[Proved]

C. ধাপ ১: AD, BE, CF তিনটি মধ্যমা।
ধাপ ২: তারা G বিন্দুতে ছেদ করে।
ধাপ ৩: প্রমাণিত যে AG : GD = 2 : 1।
ধাপ ৪: একইভাবে BG : GE = 2 : 1 এবং CG : GF = 2 : 1।
ধাপ ৫: সুতরাং মধ্যমাত্রয় পরস্পরকে 2 : 1 অনুপাতে বিভক্ত করে।
[Proved]

---

Question 2:
[ID: 2]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: কুমিল্লা বোর্ড-২০১৭]
Stem: ABC এবং DEF দুটি সমকোণ বিশিষ্ট ত্রিভুজ। AG এবং DH যথাক্রমে BC এবং EF-এর উপর লম্ব।
A. উদ্দীপকের আলোকে চিত্রটি অঙ্কন করো। (2)
B. প্রমাণ করো যে AG : DH = AB : DE। (4)
C. প্রমাণ করো যে Area(ABC) : Area(DEF) = BC^2 : EF^2। (4)
Answer:
A. ধাপ ১: একই কোণ বিশিষ্ট দুটি ত্রিভুজ ABC এবং DEF অঙ্কন করো।
ধাপ ২: A থেকে BC-এর উপর লম্ব AG অঙ্কন করো।
ধাপ ৩: D থেকে EF-এর উপর লম্ব DH অঙ্কন করো।
[Ans.]

B. ধাপ ১: ABG এবং DEH-এ, B = E এবং AGB = DHE = 90°।
ধাপ ২: সুতরাং তৃতীয় কোণ BAG = EDH।
ধাপ ৩: ABG ~ DEH (AAA সদৃশতা)।
ধাপ ৪: AG/DH = AB/DE।
[Proved]

C. ধাপ ১: Area(ABC) = 1/2 × BC × AG, Area(DEF) = 1/2 × EF × DH।
ধাপ ২: Area(ABC)/Area(DEF) = (BC × AG)/(EF × DH)।
ধাপ ৩: B অংশ থেকে AG/DH = AB/DE এবং ABC ~ DEF বলে AB/DE = BC/EF।
ধাপ ৪: সুতরাং Area(ABC)/Area(DEF) = BC²/EF²।
[Proved]

---

Question 3:
[ID: 3]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: কুমিল্লা ক্যাডেট কলেজ, কুমিল্লা]
Stem: ABC-এ, AB-কে E পর্যন্ত এবং AC-কে F পর্যন্ত বর্ধিত করা হয়েছে এবং EBC ও FCB-এর দ্বিখণ্ডকদ্বয় O বিন্দুতে মিলিত হয়।
A. প্রমাণ করো যে, একটি ত্রিভুজের যে কোনো দুটি বাহুর দৈর্ঘ্যের অন্তর তৃতীয় বাহু অপেক্ষা ছোট। (2)
B. প্রমাণ করো যে, BOC = 90° - 1/2 A। (4)
C. প্রমাণ করো যে, A + B + C = 180°। (4)
Answer:
A. ধাপ ১: ABC ত্রিভুজে, AB > AC ধরি।
ধাপ ২: AB থেকে AD = AC কেটে নিই। C, D যোগ করি।
ধাপ ৩: ADC-এ, AD = AC বলে ACD = ADC।
ধাপ ৪: BDC-এ, BDC > BCD।
ধাপ ৫: BC > BD = AB - AC।
ধাপ ৬: AB - AC < BC।
[Proved]

B. ধাপ ১: EBC = 180° - ABC, OBC = 90° - ABC/2।
ধাপ ২: FCB = 180° - ACB, OCB = 90° - ACB/2।
ধাপ ৩: BOC-এ, BOC = 180° - (OBC + OCB)।
ধাপ ৪: BOC = 180° - (180° - (ABC + ACB)/2) = (ABC + ACB)/2।
ধাপ ৫: ABC + ACB = 180° - A, তাই BOC = 90° - A/2।
[Proved]

C. ধাপ ১: ABC ত্রিভুজের তিন কোণের সমষ্টি 180°।
ধাপ ২: একটি সরলরেখা BC এর সমান্তরাল করে A বিন্দু দিয়ে একটি রেখা টানি।
ধাপ ৩: একান্তর কোণ ও অনুরূপ কোণের ধর্ম ব্যবহার করে প্রমাণ করা যায়।
[Proved]

---

Question 4:
[ID: 4]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: সিলেট ক্যাডেট কলেজ, সিলেট]
Stem: ABC-এর মধ্যমা AP, BQ এবং CR পরস্পরকে G বিন্দুতে ছেদ করে এবং GM || PQ।
A. একটি সমদ্বিবাহু ত্রিভুজ অঙ্কন করো যার সমান বাহু এবং পরিসীমা ইচ্ছামতো। (2)
B. দেখাও যে, AC = 6QM। (4)
C. প্রমাণ করো যে, AB + AC + BC > AP + BQ + CR। (4)
Answer:
A. ধাপ ১: সমান বাহু a এবং পরিসীমা s ধরি।
ধাপ ২: BC = s - 2a।
ধাপ ৩: AB = AC = a এবং BC = s - 2a নিয়ে ABC অঙ্কন করো।
[Ans.]

B. ধাপ ১: APQ-এ, GM || PQ বলে AM/MQ = AG/GP।
ধাপ ২: AG/GP = 2/1 (ভরকেন্দ্র)।
ধাপ ৩: AM/MQ = 2/1, AM = 2MQ।
ধাপ ৪: AQ = AM + MQ = 3MQ।
ধাপ ৫: Q মধ্যমা বলে AC = 2AQ = 6MQ।
[Proved]

C. ধাপ ১: AP-কে E পর্যন্ত বর্ধিত করি যেন PE = AP হয়।
ধাপ ২: ABP ≅ ECP (SAS)।
ধাপ ৩: ACE-এ, AC + CE > AE।
ধাপ ৪: AC + AB > 2AP।
ধাপ ৫: একইভাবে, অন্যান্য মধ্যমার জন্যও একই ফলাফল।
ধাপ ৬: যোগ করে, AB + AC + BC > AP + BQ + CR।
[Proved]

---

Question 5:
[ID: 5]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: ভিকারুননিসা নুন স্কুল অ্যান্ড কলেজ, ঢাকা]
Stem: ABC-এ, A-এর দ্বিখণ্ডক AD বাহু BC-কে D বিন্দুতে ছেদ করে এবং ABC ও PQR সমকোণ বিশিষ্ট ত্রিভুজ।
A. একটি নির্দিষ্ট রেখাংশকে 2 : 3 অনুপাতে ভাগ করো। (2)
B. প্রমাণ করো যে, AB : AC = BD : DC। (4)
C. প্রমাণ করো যে, Area(ABC)/Area(PQR) = BC²/QR²। (4)
Answer:
A. ধাপ ১: AB রেখাংশ অঙ্কন করো।
ধাপ ২: AX রশ্মি অঙ্কন করো এবং ৫টি সমান বিন্দু চিহ্নিত করো।
ধাপ ৩: ৫ম বিন্দুকে B-এর সাথে যোগ করো এবং ২য় বিন্দুগামী সমান্তরাল রেখা অঙ্কন করো।
ধাপ ৪: D বিন্দুটি AB-কে 2 : 3 অনুপাতে ভাগ করে।
[Ans.]

B. ধাপ ১: AD, A-এর অভ্যন্তরীণ দ্বিখণ্ডক।
ধাপ ২: অভ্যন্তরীণ কোণ দ্বিখণ্ডক উপপাদ্য অনুযায়ী, BD/DC = AB/AC।
[Proved]

C. ধাপ ১: ABC ও PQR সমকোণ বিশিষ্ট ত্রিভুজ, তাই তারা সদৃশ।
ধাপ ২: সদৃশ ত্রিভুজের ক্ষেত্রফলের অনুপাত অনুরূপ বাহুর অনুপাতের বর্গের সমান।
ধাপ ৩: Area(ABC)/Area(PQR) = BC²/QR²।
[Proved]

---

Question 6:
[ID: 6]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: বিএএফ শাহীন কলেজ, তেজগাঁও, ঢাকা]
Stem: ABC এবং DEF দুটি সদৃশ ত্রিভুজ।
A. ত্রিভুজদ্বয়ের অনুরূপ বাহু এবং অনুরূপ কোণগুলোর নাম লেখো। (2)
B. প্রমাণ করো যে, Area(ABC)/Area(DEF) = AB²/DE² = AC²/DF² = BC²/EF²। (4)
C. যদি BC = 3 cm, EF = 8 cm, B = 60°, BC/AB = 3/2 এবং ABC-এর ক্ষেত্রফল 3 বর্গ সেমি হয়, তবে DEF ত্রিভুজটি অঙ্কন করো এবং এর ক্ষেত্রফল নির্ণয় করো। (4)
Answer:
A. ধাপ ১: AB → DE, BC → EF, AC → DF অনুরূপ বাহু।
ধাপ ২: A → D, B → E, C → F অনুরূপ কোণ।
[Ans.]

B. ধাপ ১: ABC ~ DEF।
ধাপ ২: সদৃশ ত্রিভুজের ক্ষেত্রফলের অনুপাত অনুরূপ বাহুর অনুপাতের বর্গের সমান।
ধাপ ৩: Area(ABC)/Area(DEF) = (AB/DE)² = (BC/EF)² = (AC/DF)²।
[Proved]

C. ধাপ ১: BC/AB = 3/2, BC = 3, AB = 2 cm।
ধাপ ২: k = EF/BC = 8/3।
ধাপ ৩: Area(DEF) = 3 × (8/3)² = 64/3 ≈ 21.33 sq cm।
ধাপ ৪: DE = AB × k = 16/3 ≈ 5.33 cm, EF = 8 cm, E = 60° দিয়ে DEF অঙ্কন।
[Ans: Area = 21.33 sq cm]

---

Question 7:
[ID: 7]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: Millennium Scholastic School & College, Bogura]
Stem: ABC-এ, B এবং C-এর দ্বিখণ্ডকদ্বয় O বিন্দুতে ছেদ করে।
A. ত্রিভুজের অনুরূপ বাহু এবং অনুরূপ কোণগুলোর নাম লেখো। (2)
B. প্রমাণ করো যে, BOC = 90° + A/2। (4)
C. প্রমাণ করো যে, A + B + C = 180°। (4)
Answer:
A. ধাপ ১: ABC ও DEF সদৃশ ত্রিভুজ।
ধাপ ২: AB ↔ DE, BC ↔ EF, AC ↔ DF অনুরূপ বাহু।
ধাপ ৩: A ↔ D, B ↔ E, C ↔ F অনুরূপ কোণ।
[Ans.]

B. ধাপ ১: ABC-এ, A + B + C = 180°।
ধাপ ২: B/2 + C/2 = 90° - A/2।
ধাপ ৩: BOC-এ, BOC + B/2 + C/2 = 180°।
ধাপ ৪: BOC = 180° - (90° - A/2) = 90° + A/2।
[Proved]

C. ধাপ ১: ABC ত্রিভুজের তিন কোণের সমষ্টি 180°।
ধাপ ২: A দিয়ে BC-এর সমান্তরাল রেখা টানলে একান্তর কোণ ও অনুরূপ কোণের সাহায্যে প্রমাণ করা যায়।
[Proved]

---

Question 8:
[ID: 8]
[Subject: সাধারণ গণিত]
[Chapter: অনুপাত, সদৃশতা এবং প্রতিসাম্য]
[Lesson: ত্রিভুজের সদৃশতা]
[Board: রাজশাহী বোর্ড-২০১৭]
Stem: PQR-এ, P-এর দ্বিখণ্ডক PS, QR-কে S বিন্দুতে ছেদ করে। RT, SP-এর সমান্তরাল যা QP-এর বর্ধিত অংশকে T বিন্দুতে ছেদ করে।
A. দেখাও যে, যদি দুটি ত্রিভুজের ভূমি সমান হয়, তবে তাদের উচ্চতা এবং ক্ষেত্রফল সমানুপাতিক হয়। (2)
B. প্রমাণ করো যে, QS : SR = PQ : PR। (4)
C. যদি QR-এর সমান্তরাল একটি রেখাংশ PQ এবং PR-কে যথাক্রমে M এবং N বিন্দুতে ছেদ করে, তবে প্রমাণ করো যে, QS : SR = MQ : NR। (4)
Answer:
A. ধাপ ১: মনে করি দুটি ত্রিভুজের ভূমি সমান b এবং উচ্চতা h1 ও h2।
ধাপ ২: Area1 = 1/2 × b × h1, Area2 = 1/2 × b × h2।
ধাপ ৩: Area1/Area2 = h1/h2।
ধাপ ৪: সুতরাং ক্ষেত্রফলগুলো তাদের উচ্চতার সমানুপাতিক।
[Proved]

B. ধাপ ১: SP || RT এবং PR ছেদক বলে PTR = QPS এবং PRT = RPS।
ধাপ ২: PS দ্বিখণ্ডক বলে QPS = RPS, তাই PTR = PRT।
ধাপ ৩: PRT-এ, PR = PT।
ধাপ ৪: থ্যালিসের উপপাদ্য অনুযায়ী, QS/SR = PQ/PT = PQ/PR।
[Proved]

C. ধাপ ১: B থেকে QS/SR = PQ/PR।
ধাপ ২: MN || QR বলে PM/MQ = PN/NR।
ধাপ ৩: PM = k·PN এবং MQ = k·NR ধরি।
ধাপ ৪: PQ/PR = (PM+MQ)/(PN+NR) = k(PN+NR)/(PN+NR) = k = MQ/NR।
ধাপ ৫: QS/SR = PQ/PR = MQ/NR।
[Proved]
`;
}
