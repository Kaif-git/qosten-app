const fs = require('fs');
const eng = fs.readFileSync('D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_ENGLISH.txt', 'utf-8');

console.log('Original file length:', eng.length);

// Strategy: Split the file into questions by "Question N:" patterns
// For each question, extract the content until the next "Question N:" or end
// Clean up any gibberish/instruction notes inside each question

// First, find all question boundaries
const questionHeaders = [];
const re = /Question \d+:/g;
let m;
while ((m = re.exec(eng)) !== null) {
  questionHeaders.push({ text: m[0], index: m.index });
}

console.log('Found', questionHeaders.length, 'question headers');

// Split into question blocks
const questionBlocks = [];
for (let i = 0; i < questionHeaders.length; i++) {
  const start = questionHeaders[i].index;
  const end = (i < questionHeaders.length - 1) ? questionHeaders[i + 1].index : eng.length;
  questionBlocks.push(eng.substring(start, end));
}

console.log('Number of blocks:', questionBlocks.length);

// Now process each block
function cleanBlock(block) {
  // Remove lines/notes that contain AI instructions
  // These are typically note blocks that start with "*" or contain instructions
  
  // Split into potential lines by "---" first
  const parts = block.split('---');
  
  // Keep only question-relevant parts:
  // - Question header line
  // - [ID: ...] 
  // - [Subject: ...]
  // - [Chapter: ...]
  // - [Lesson: ...]
  // - [Board: ...]
  // - Stem: ...
  // - A. ... B. ... C. ...
  // - Answer: ...
  // - Answer content (A. ..., B. ..., C. ...)
  // - Result: [Proved] or [Ans.]
  
  // The gibberish is typically in parts that are NOT part of the question structure
  // Let's identify: a block starts with Question N: and contains the question
  // After the answer (Result), any content after the proper ending is gibberish
  
  // Strategy: find the question content and keep only what's between Question header and the last "---"
  // For blocks that have only one "---" at the end (separator), keep everything before that
  
  return block; // We'll handle this differently
}

// Actually, let me take a different approach.
// The gibberish is specifically at:
// 1. After Question 5's Answer section (positions 15078-24392): AI notes about extraction
// 2. After Question 10's Answer section (positions 37765-38616): AI notes 
// 3. After Question 16 (positions 52309-60952): AI notes and discussions
// 4. After Question 21 (positions 72567-84574): AI notes and discussions
// 5. Various "No answer provided" notes that are properly placed within questions

// Let me just remove content between "---" that contains AI instruction text
// And properly insert newlines everywhere

// Simple approach: 
// 1. Replace all "---" with newlines + "---" + newlines to get line-based structure
// 2. Filter out lines that contain instruction keywords
// 3. For question blocks, ensure proper formatting

// Step 1: Insert newlines at strategic points
let fixed = eng;

// First convert the existing formatting markers to newlines
// Each question starts with "Question N:" which should be on its own line
fixed = fixed.replace(/(Question \d+:)/g, '\n$1');

// [ID: N] should be on own line
fixed = fixed.replace(/(\[ID: \d+\])/g, '\n$1');

// [Subject: ...] etc should be on own line
fixed = fixed.replace(/(\[Subject: [^\]]*\])/g, '\n$1');
fixed = fixed.replace(/(\[Chapter: [^\]]*\])/g, '\n$1');
fixed = fixed.replace(/(\[Lesson: [^\]]*\])/g, '\n$1');
fixed = fixed.replace(/(\[Board: [^\]]*\])/g, '\n$1');

// "Stem:" should be on own line
fixed = fixed.replace(/(Stem:)/g, '\n$1');

// "Answer:" should be on own line
fixed = fixed.replace(/(Answer:)/g, '\n$1');

// "---" should be on own line
fixed = fixed.replace(/---/g, '\n---\n');

// A. B. C. parts should be on own lines (but be careful not to split answers)
// Actually let's handle the three parts
fixed = fixed.replace(/(\nA\. |^A\. )/g, '\nA. ');
fixed = fixed.replace(/(\nB\. |^B\. )/g, '\nB. ');
fixed = fixed.replace(/(\nC\. |^C\. )/g, '\nC. ');

// Now split into lines
let lines = fixed.split('\n');

// Filter out lines that are AI instruction gibberish
const instructionPatterns = [
  /Ensure subject/i,
  /Ensure chapter/i,
  /Ensure Board/i,
  /Check formatting/i,
  /Math tutor extracting/i,
  /Extract CQ/i,
  /No vague filler/i,
  /Inline math/i,
  /specific layout/i,
  /One step per line/i,
  /Handle missing answers/i,
  /Verify and correct/i,
  /Beginner-friendly/i,
  /Correct errors silently/i,
  /Self-Correction/i,
  /Page \d+:/i,
  /Final Check/i,
  /specifics per question/i,
  /^\s*\* /,  // lines starting with * (bullet points)
  /^\s*Decision:/i,
  /^\s*\(Note:/i,
  /^3 pages of/i,
  /^Two images/i,
  /^Subject, Chapter/i,
  /^Reference page/i,
  /^Q\d+[A-Z] is missing/i,
  /^Q\d+[A-Z] is a reference/i,
  /^Q\d+[A-Z] solution is missing/i,
  /^\s*Wait,/i,
  /source is empty/i,
  /is unreadable/i,
  /no answer,/i,
  /no answers,/i,
  /still extract/i,
  /specific Format/i,
  /Correct format/i,
  /Keep it/i,
  /I will/i,
  /I'll stick/i,
  /I will list/i,
  /to be safe/i,
  /as the prompt/i,
  /as the extraction/i,
  /Decision:/,
  /^\s*\- /,
  /Math tutor/,
  /Panjeree/,
];

const cleanLines = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) {
    // Keep empty lines
  }
  
  // Check if it's an instruction line
  let isInstruction = false;
  for (const pat of instructionPatterns) {
    if (pat.test(line)) {
      isInstruction = true;
      break;
    }
  }
  
  if (!isInstruction) {
    cleanLines.push(line);
  }
}

// Join back
let result = cleanLines.join('\n');

// Fix multiple consecutive empty lines
result = result.replace(/\n{3,}/g, '\n\n');

// Fix: Result: [Proved] should be followed by \n\n---\n
result = result.replace(/(Result: \[Proved\]|Result: \[Ans\.\]|Result: \[\Ans\.\]|Result: \[Showed\]|Result: \d+)/g, '$1\n');

// Ensure proper spacing around ---
result = result.replace(/\n---\n\n---\n/g, '\n---\n');

// Trim start
result = result.trim();

// Write output
fs.writeFileSync('D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch3_CQ\\Ch3_CQ_ENGLISH.txt', result, 'utf-8');
console.log('Output length:', result.length);
console.log('Done!');
