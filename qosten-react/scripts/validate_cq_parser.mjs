import { parseCQQuestions } from '../src/utils/cqParser.js';
import fs from 'fs';
import path from 'path';

const ROOT = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics';

function walkCqFiles() {
  const results = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'BACKUP_CQ_FILES') continue;
    const dir = path.join(ROOT, entry.name);
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('_ENGLISH.txt') || file.endsWith('_BANGLA.txt')) {
        results.push(path.join(dir, file));
      }
    }
  }
  return results.sort();
}

function countCharsInParsed(questions) {
  let partTextChars = 0;
  let answerChars = 0;
  let stemChars = 0;
  let emptyParts = 0;
  let emptyAnswers = 0;
  let totalParts = 0;

  for (const q of questions) {
    stemChars += (q.questionText || '').length;
    for (const p of (q.parts || [])) {
      totalParts++;
      const pt = (p.text || '').trim();
      const pa = (p.answer || '').trim();
      partTextChars += pt.length;
      answerChars += pa.length;
      if (!pt) emptyParts++;
      if (!pa) emptyAnswers++;
    }
  }
  return { partTextChars, answerChars, stemChars, emptyParts, emptyAnswers, totalParts };
}

function countCharsInSource(text) {
  return text.length;
}

console.log('╔══════════════════════════════════════════════════════════════════════════╗');
console.log('║  CQ Parser Validation                                                  ║');
console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

const files = walkCqFiles();
let allPass = true;

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const isBangla = file.endsWith('_BANGLA.txt');
  const lang = isBangla ? 'bn' : 'en';
  const text = fs.readFileSync(file, 'utf8');
  const srcChars = countCharsInSource(text);

  const questions = parseCQQuestions(text, lang);

  const stats = countCharsInParsed(questions);

  const totalParsedChars = stats.stemChars + stats.partTextChars + stats.answerChars;

  const mismatch = srcChars - totalParsedChars;
  const mismatchPct = srcChars > 0 ? ((mismatch / srcChars) * 100).toFixed(1) : '0.0';
  const hasIssues = stats.emptyParts > 0 || stats.emptyAnswers > 0 || mismatch > 50;

  const flag = hasIssues ? '⚠️' : '✅';
  if (hasIssues) allPass = false;

  console.log(`${flag} ${rel} (${lang})`);
  console.log(`   Source chars: ${srcChars} | Parsed chars: ${totalParsedChars} (stem=${stats.stemChars}, text=${stats.partTextChars}, ans=${stats.answerChars})`);
  console.log(`   Diff: ${mismatch >= 0 ? '+' : '-'}${Math.abs(mismatch)} (${mismatchPct}%)`);
  console.log(`   Questions: ${questions.length} | Parts: ${stats.totalParts} | Empty texts: ${stats.emptyParts} | Empty answers: ${stats.emptyAnswers}`);

  if (stats.emptyParts > 0 || stats.emptyAnswers > 0) {
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      for (const p of (q.parts || [])) {
        const issues = [];
        if (!(p.text || '').trim()) issues.push('empty text');
        if (!(p.answer || '').trim()) issues.push('empty answer');
        if (issues.length) {
          console.log(`   ❌ Q${qi + 1} part ${p.letter}: ${issues.join(', ')}`);
        }
      }
    }
  }

  if (mismatch > 50) {
    console.log(`   ⚠️ Character mismatch > 50 chars — possible data loss`);
  }
  console.log('');
}

console.log('══════════════════════════════════════════════════════════════════════════');
console.log(allPass ? '✅ ALL PASS' : '⚠️ SOME FILES HAVE ISSUES');
