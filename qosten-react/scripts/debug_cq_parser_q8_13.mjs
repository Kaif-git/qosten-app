/**
 * Debug script: Trace why questions 8-13 have missing subquestion answers
 * when parsing Ch3_CQ_BANGLA.txt
 * 
 * Root causes identified:
 * 1. Part letters (ক, খ, গ) embedded mid-line after stem text (no newline before them)
 * 2. উত্তর: appended at end of last sub-question line (no newline before it)
 * 3. Part ক never created (embedded in stem line), so when it appears in answer
 *    section, parser treats it as "new part" and exits answer mode
 */

import { parseCQQuestions } from '../src/utils/cqParser.js';
import fs from 'fs';

const FILE = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\General_Mathematics\\Ch3_CQ\\Ch3_CQ_BANGLA.txt';

// ── Helpers ──────────────────────────────────────────────────────────
const BH = '='.repeat(70);
const SH = '-'.repeat(50);

function showParsed(q, idx) {
  console.log(`\n${SH}`);
  console.log(`  Question ${idx}: ${q.subject || '(no subject)'} | Board: ${q.board || '(none)'}`);
  console.log(`  Stem (${(q.questionText || '').length} chars):`);
  if (q.questionText) {
    const lines = q.questionText.split('\n');
    lines.forEach((l, i) => console.log(`    [L${i}] ${l.substring(0, 120)}`));
  }
  console.log(`  Parts (${q.parts.length}):`);
  q.parts.forEach(p => {
    const t = (p.text || '').trim();
    const a = (p.answer || '').trim();
    console.log(`    ${p.letter}. text=${t.substring(0, 80)}${t.length > 80 ? '...' : ''}`);
    console.log(`        marks=${p.marks}, answer=${a ? a.substring(0, 80) + (a.length > 80 ? '...' : '') : '*** EMPTY ***'}`);
  });
}

// ── Parse and show results ──────────────────────────────────────────
console.log(BH);
console.log('  CQ Parser Debug: Questions 8-13 Subquestion Answer Analysis');
console.log(BH);

const text = fs.readFileSync(FILE, 'utf8');
console.log(`\n📄 File: ${FILE}`);
console.log(`📏 Total chars: ${text.length}`);

// Parse the full file
const questions = parseCQQuestions(text, 'bn');

console.log(`\n${BH}`);
console.log('  PARSED RESULTS - Questions 8-13');
console.log(BH);

// Questions are 0-indexed in array; first 7 should be Q1-7, then Q8-13
for (let i = 7; i <= 12 && i < questions.length; i++) {
  showParsed(questions[i], i + 1);
}

// ── Detailed line-by-line trace for Question 8 ──────────────────────
console.log(`\n${BH}`);
console.log('  LINE-BY-LINE STATE TRACE for Question 8 (lines 335-389)');
console.log(BH);

const lines = text.split('\n').map(l => l.trim());
const traceLines = lines.slice(334, 390); // 0-indexed: line 335-389

// Simulate the key state transitions
let state = {
  inStimulusSection: false,
  inQuestionSection: false,
  inAnswerSection: false,
  hasStartedParts: false,
  currentAnswerPart: null,
  useBulletPointFormat: false,
  stimulusLines: [],
  questionTextLines: []
};

let parts = [];

const BENGALI_TO_ENGLISH = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };

traceLines.forEach((line, i) => {
  const realLineNum = 335 + i;
  
  if (!line) {
    console.log(`  [L${realLineNum}] EMPTY LINE`);
    return;
  }
  
  console.log(`  [L${realLineNum}] ${line.substring(0, 130)}`);
  
  // 1. Stem header check
  const isStemHeader = /^(Stem|স্টেম|উদ্দীপক)\s*[:ঃ]/i.test(line);
  if (isStemHeader) {
    console.log(`    → STEM HEADER detected`);
    state.inStimulusSection = true;
    state.inQuestionSection = false;
    state.inAnswerSection = false;
    state.stimulusLines = [];
    state.hasStartedParts = false;
    return;
  }

  // 2. Part check (starting with part letter)
  const partMatch = line.match(/^(?:Part\s+)?([a-dক-ঘ])[:.)।]\s*(.+)/i);
  
  // 3. Answer header check
  const answerHdrMatch = line.match(/(?:(?:answer)(?!s)|উত্তরপত্র|(?:উত্তর)(?!ের)|সমাধান(?=\s*[:=ঃ])|উঃ|\bans\b)\s*[:=ঃ]?/i);
  
  if (state.inStimulusSection) {
    // Check if this line starts with a part letter -> exit stimulus
    if (partMatch) {
      console.log(`    → EXIT stimulus mode (part '${partMatch[1]}' found at line start)`);
      state.inStimulusSection = false;
    } else {
      // Check if line has embedded part letter (mid-line)
      const embeddedPart = line.match(/([ক-ঘ])[:.)]\s*(.+)/);
      if (embeddedPart) {
        console.log(`    ⚠️ EMBEDDED part letter '${embeddedPart[1]}' found mid-line but NOT at start! Part will be LOST in stimulus.`);
      }
      state.stimulusLines.push(line);
      console.log(`    → Added to stimulus (${state.stimulusLines.length} lines)`);
      return;
    }
  }

  if (answerHdrMatch && !state.inAnswerSection) {
    const hdrIdx = answerHdrMatch.index;
    const preText = line.substring(0, hdrIdx).trim();
    const postText = line.substring(hdrIdx + answerHdrMatch[0].length).trim();
    
    console.log(`    → ANSWER HEADER '${answerHdrMatch[0]}' at idx ${hdrIdx}`);
    console.log(`      preHeader="${preText.substring(0, 80)}"`);
    console.log(`      postHeader="${postText.substring(0, 80)}"`);
    
    if (preText) {
      const prePart = preText.match(/^(?:Part\s+)?([a-dক-ঘ])[:.)।]\s*(.+)/i);
      if (prePart) {
        let letter = prePart[1].toLowerCase();
        if (BENGALI_TO_ENGLISH[letter]) letter = BENGALI_TO_ENGLISH[letter];
        const existing = parts.find(p => p.letter === letter);
        if (!existing) {
          parts.push({ letter, text: prePart[2].trim(), marks: 0, answer: '' });
          state.hasStartedParts = true;
          console.log(`    ✅ Part '${letter}' created from pre-header text`);
        } else {
          console.log(`    ⚠️ Part '${letter}' already exists, skipping duplicate`);
        }
      }
    }
    
    state.inStimulusSection = false;
    state.inQuestionSection = false;
    state.inAnswerSection = true;
    state.currentAnswerPart = null;
    
    if (postText) {
      // Process post-text as answer content
      console.log(`    → Post-header text to process as answer`);
    }
    console.log(`    ✅ ENTERED answer section`);
    
    if (!postText) return;
  }

  if (state.inAnswerSection) {
    const ansPartMatch = line.match(/^(?:Part\s+)?([a-dক-ঘ])[:.)।]\s*(.*)/i);
    
    if (ansPartMatch) {
      let letter = ansPartMatch[1].toLowerCase();
      if (BENGALI_TO_ENGLISH[letter]) letter = BENGALI_TO_ENGLISH[letter];
      const content = ansPartMatch[2].trim();
      const existing = parts.find(p => p.letter === letter);
      
      if (existing) {
        existing.answer = content;
        state.currentAnswerPart = existing;
        console.log(`    ✅ Assigned answer to existing part ${letter}`);
      } else {
        // NEW PART in answer section - THIS IS THE BUG
        console.log(`    ⚠️⚠️⚠️ Part '${letter}' NOT FOUND in existing parts!`);
        console.log(`      → Parser will EXIT answer section and create as new part!`);
        console.log(`      → Answer content will be LOST (stored as text, not answer)!`);
        state.inAnswerSection = false;
        parts.push({ letter, text: content, marks: 0, answer: '' });
        state.hasStartedParts = true;
        console.log(`      → Created NEW part '${letter}' with text="${content.substring(0, 60)}"`);
      }
    } else {
      // Inline sub-part marker like [উত্তর]খ.
      const inlineMatch = line.match(/(\[[^\]]*\])\s*([a-dক-ঘ])[\.:]\s*/i);
      if (inlineMatch) {
        let letter = BENGALI_TO_ENGLISH[inlineMatch[2]] || inlineMatch[2].toLowerCase();
        const afterText = line.substring(inlineMatch.index + inlineMatch[0].length);
        console.log(`    → Inline sub-part marker: [${inlineMatch[1]}]${inlineMatch[2]}.`);
        const existing = parts.find(p => p.letter === letter);
        if (existing) {
          existing.answer = afterText;
          state.currentAnswerPart = existing;
          console.log(`    ✅ Assigned inline answer to part ${letter}`);
        }
      } else {
        console.log(`    → Continuation line in answer`);
      }
    }
    return;
  }

  // Not in answer section, not in stimulus - check for parts
  if (!state.inAnswerSection) {
    const partMatch2 = line.match(/^(?:Part\s+)?([a-dক-ঘ])[:.)।]\s*(.+)/i);
    if (partMatch2) {
      let letter = partMatch2[1].toLowerCase();
      if (BENGALI_TO_ENGLISH[letter]) letter = BENGALI_TO_ENGLISH[letter];
      
      const existing = parts.find(p => p.letter === letter);
      if (existing) {
        console.log(`    ⚠️⚠️⚠️ DUPLICATE part '${letter}' - will be treated as continuation`);
        // Append to last part's text
        const last = parts[parts.length - 1];
        if (last) {
          last.text += ' ' + line;
          console.log(`      → Appended to part '${last.letter}' text`);
        }
      } else {
        parts.push({ letter, text: partMatch2[2].trim(), marks: 0, answer: '' });
        state.hasStartedParts = true;
        console.log(`    ✅ Created part '${letter}'`);
      }
    } else {
      if (state.hasStartedParts) {
        console.log(`    → Continuation (appended to last part text): "${line.substring(0, 60)}"`);
        const last = parts[parts.length - 1];
        if (last) last.text += ' ' + line;
      } else {
        console.log(`    → Added to stem/question text`);
        state.questionTextLines.push(line);
      }
    }
  }
});

console.log(`\n${SH}`);
console.log('  Result of trace for Question 8:');
console.log(`  Stimulus lines: ${state.stimulusLines.length}`);
console.log(`  Parts found: ${parts.length}`);
parts.forEach(p => {
  console.log(`    ${p.letter}: text="${(p.text||'').substring(0,60)}" | answer="${(p.answer||'*** EMPTY ***').substring(0,60)}"`);
});

// ── Root Cause Analysis ──────────────────────────────────────────────
console.log(`\n${BH}`);
console.log('  ROOT CAUSE ANALYSIS');
console.log(BH);

console.log(`
The parsing fails for questions 8-13 due to a FORMAT DIFFERENCE between
questions 1-7 and questions 8-13:

Questions 1-7 use this format (each part on its own line, উত্তর: on its own line):
  স্টেম: some stem text
  A. question text (2)
  B. question text (4)
  C. question text (4)
  উত্তর:
  A. answer text
  B. answer text
  C. answer text

Questions 8-13 use this format (parts MID-LINE after stem, উত্তর: at end of last part line):
  স্টেম: some stem text।ক. subquestion 1 (২)
  খ. subquestion 2 (৪)
  গ. subquestion 3 (৪)উত্তর:

THREE ROOT CAUSES:

ROOT CAUSE #1: Mid-line part letters (লাইন ৩৩৭, ৩৯৫, ৪৩৪, ৪৭৬, ৫২১, ৫৬৮)
  The part letter 'ক.' is on the SAME line as the stem text, not at the start.
  Example line 337:
    (ii) x + 1/x = 4, যেখানে x > 0।ক. উৎপাদকে বিশ্লেষণ করো: ... (২)
  The part regex requires ^ (start of line): /^([a-dক-ঘ])[:.)]/
  Since 'ক.' is mid-line (preceded by '0।'), it does NOT match as a part.
  Instead, the entire line gets swallowed into the stimulus/stem text.
  Part 'ক' (letter 'a') is NEVER CREATED as a question part.

ROOT CAUSE #2: উত্তর: on same line as last part (লাইন ৩৩৯, ৩৯৭, ৪৩৬, ৪৭৮, ৫২৩, ৫৭০)
  The answer header is appended AFTER the last part's text on the same line:
    গ. ... (৪)উত্তর:
  The answerHeaderRegex matches 'উত্তর:' mid-line.
  The pre-header text (গ.) creates part 'গ' (c).
  But this creates an empty answer section.

ROOT CAUSE #3: Missing part 'ক' causes answer section corruption (লাইন ৩৪০)
  When the answer section starts (after উত্তর:), the FIRST answer line is:
    ক. x^2 + 10x + 16...
  The parser looks for a part with letter 'ক' (a) — but part 'ক' was NEVER
  CREATED (see RC#1). Since the part doesn't exist, the handler at line 560
  treats it as a NEW PART and EXITS answer section. The answer content
  for 'ক' gets stored as the part TEXT instead of the part ANSWER. All
  subsequent answer lines for ক are appended to part ক's text, not its answer.
  Then when 'খ.' appears later, it's treated as a duplicate part (since খ
  already exists from line 338), and its content gets appended to the 
  previous part's text instead.
`);

// ── Summary table ────────────────────────────────────────────────────
console.log(`\n${BH}`);
console.log('  SUMMARY - Missing Answers in Questions 8-13');
console.log(BH);
console.log('  Q#  | Part | Part Text Found? | Answer Found? | Why?');
console.log('  ' + '-'.repeat(58));
for (let i = 7; i <= 12 && i < questions.length; i++) {
  const q = questions[i];
  q.parts.forEach(p => {
    const hasText = (p.text || '').trim() ? 'YES' : 'NO ';
    const hasAns  = (p.answer || '').trim() ? 'YES' : 'NO ';
    console.log(`  Q${i+1} | ${p.letter}    | ${hasText}            | ${hasAns}         | ${!hasAns.trim() ? 'ক not parsed as part → answer stored as text' : ''}`);
  });
}

console.log(`\n${BH}`);
console.log('  FIX SUGGESTIONS');
console.log(BH);
console.log(`Option 1: Fix the INPUT FILE by adding newlines before 'ক.' / 'উত্তর:'
   - Insert newline between stem text and 'ক.' for all questions 8-13
   - Insert newline between 'গ.' and 'উত্তর:' for all questions 8-13

Option 2: Fix the PARSER to handle mid-line part letters
   - Change part regex to match mid-line (remove ^ anchor) in the stimulus
     section, so embedded part letters are detected
   - Handle the part creation and split the line accordingly

Option 3: Fix the PARSER to handle উত্তর: appended after last part
   - Detect উত্তর: at end of a part line, split it off, and enter
     answer section properly

Option 4: Fix the PARSER to handle missing part 'ক' in answer section
   - When a part letter is found in answer section that doesn't exist,
     create the part with the answer content as ANSWER instead of TEXT,
     and don't exit answer section
`);
