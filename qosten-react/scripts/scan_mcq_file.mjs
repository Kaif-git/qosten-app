/**
 * SCAN ONLY: Parse, validate, and compare original vs parsed for MCQ files
 * No DB operations.
 * 
 * Usage: node scripts/scan_mcq_file.mjs <path-to-txt-file>
 */

import { parseMCQQuestions, validateMCQQuestion } from '../src/utils/mcqQuestionParser.js';
import { formatMultipleMCQs } from '../src/utils/mcqFormatter.js';
import fs from 'fs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/scan_mcq_file.mjs <path-to-txt-file>');
  process.exit(1);
}

const text = fs.readFileSync(filePath, 'utf8');
const fileName = filePath.split(/[/\\]/).pop();
console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
console.log(`║  MCQ SCAN REPORT: ${fileName.padEnd(38)}║`);
console.log(`╚═══════════════════════════════════════════════════════════════╝`);
console.log(`📂 File: ${filePath}`);
console.log(`📄 Size: ${text.length} chars\n`);

// ─── Parse ─────────────────────────────────────────────────────────────────────
const parsed = parseMCQQuestions(text);
console.log(`\n✅ Parsed ${parsed.length} questions total\n`);

// ─── Validate each question ────────────────────────────────────────────────────
console.log('─── VALIDATION REPORT ───');
console.log('');

const results = parsed.map((q, i) => {
  const v = validateMCQQuestion(q);
  const hasExplanation = !!q.explanation;
  const issues = [];
  if (!v.isValid) issues.push(...v.errors);
  if (!hasExplanation) issues.push('Explanation is missing');
  return { index: i + 1, question: q, isValid: v.isValid && hasExplanation, issues };
});

const healthy = results.filter(r => r.isValid);
const minorIssues = results.filter(r => !r.explanation);
const majorIssues = results.filter(r => !r.question.subject || !r.question.chapter);

if (majorIssues.length > 0) {
  console.log(`❌ MAJOR ISSUES (${majorIssues.length} questions):`);
  console.log('   These will be SKIPPED during upload.');
  console.log('');
  majorIssues.forEach((r, idx) => {
    console.log(`   #${r.index}: ${r.question.questionText?.substring(0, 60)}`);
    console.log(`      Subject: ${r.question.subject || '(empty)'} | Chapter: ${r.question.chapter || '(empty)'}`);
    console.log(`      Issues: ${r.issues.join(', ')}`);
    console.log('');
  });
}

if (minorIssues.length > 0) {
  console.log(`\n⚠️  MISSING EXPLANATION (${minorIssues.length} questions):`);
  console.log('   These CAN still be uploaded but lack explanations.');
  console.log('');
  minorIssues.forEach(r => {
    if (r.question.subject && r.question.chapter) {  // Only show if not already shown above
      console.log(`   #${r.index}: ${r.question.questionText?.substring(0, 60)}`);
      console.log(`      ${r.question.subject} / ${r.question.chapter}`);
      console.log('');
    }
  });
}

console.log(`─── SUMMARY ───`);
console.log(`   ✅ Healthy (all fields): ${healthy.length}/${parsed.length}`);
console.log(`   ⚠️  Missing explanation: ${minorIssues.filter(r => r.question.subject && r.question.chapter).length}`);
console.log(`   ❌ Missing subject/chapter: ${majorIssues.length}`);
console.log('');

// ─── Chapters found ────────────────────────────────────────────────────────────
const chapters = {};
parsed.forEach(q => {
  const key = `${q.subject || '?'} / ${q.chapter || '?'}`;
  if (!chapters[key]) chapters[key] = 0;
  chapters[key]++;
});

console.log('─── CHAPTERS FOUND ───');
Object.entries(chapters).forEach(([key, count]) => {
  console.log(`   ${key}: ${count} questions`);
});
console.log('');

// ─── Scanner: Compare original blocks vs parsed ────────────────────────────────
console.log('─── SCANNER: Detailed comparison (sample) ───');
console.log('');

// Split original into question blocks
const blocks = text.split(/(?=\[ID:|Question \d+:|^\d+[.।])/m).filter(b => b.trim());
console.log(`   Original blocks: ${blocks.length}`);
console.log(`   Parsed questions: ${parsed.length}`);

// Check for duplicates
const textSet = new Set();
const duplicates = [];
parsed.forEach((q, i) => {
  const qt = q.questionText?.trim();
  if (qt) {
    if (textSet.has(qt)) duplicates.push(i + 1);
    else textSet.add(qt);
  }
});

if (duplicates.length > 0) {
  console.log(`\n⚠️  DUPLICATE QUESTIONS DETECTED: ${duplicates.length}`);
  console.log('   The following parsed question indices appear to be duplicates:');
  const dupeTexts = {};
  parsed.forEach((q, i) => {
    const qt = q.questionText?.trim();
    if (qt) {
      if (!dupeTexts[qt]) dupeTexts[qt] = [];
      dupeTexts[qt].push(i + 1);
    }
  });
  Object.entries(dupeTexts).filter(([, indices]) => indices.length > 1).forEach(([text, indices]) => {
    console.log(`   Questions #${indices.join(', #')}: "${text.substring(0, 60)}..."`);
  });
}

console.log('\n──────────────────────────────────────────────────────────');
console.log('✅ Scan complete. No database operations were performed.');
console.log(`📝 Report ready. Share this with the user before uploading.\n`);