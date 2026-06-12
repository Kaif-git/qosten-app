import fs from 'fs';
import path from 'path';

const REVIEW_DIR = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\review_output';
const COMBINED_DIR = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\combined';

function extractQuestions(text) {
  const lines = text.split('\n');
  const questions = [];
  let current = [];
  let inSummary = false;

  for (const line of lines) {
    if (line.startsWith('### **Summary') || line.startsWith('***')) {
      inSummary = true;
      continue;
    }
    if (inSummary) continue;

    if (line.startsWith('---') && current.length > 1) {
      questions.push(current.join('\n'));
      current = [];
      continue;
    }

    if (line.match(/^###\s*---\s*Batch/i)) continue;

    current.push(line);
  }

  if (current.length > 1) questions.push(current.join('\n'));
  return questions;
}

function stripIntroLines(text) {
  const lines = text.split('\n');
  const startIdx = lines.findIndex(l => l.startsWith('Question ') || l.startsWith('['));
  return startIdx > 0 ? lines.slice(startIdx).join('\n') : text;
}

async function main() {
  const reviewDirs = fs.readdirSync(REVIEW_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .map(d => d.name);

  console.log('Processing review outputs for upload...\n');

  let totalQuestions = 0;
  let chapterCount = 0;

  for (const chapter of reviewDirs) {
    // Merge all batch review files
    const chapterDir = path.join(REVIEW_DIR, chapter);
    const batchFiles = fs.readdirSync(chapterDir).filter(f => f.startsWith('MCQ_review') && f.endsWith('.txt'));
    if (batchFiles.length === 0) continue;

    let allText = '';
    for (const f of batchFiles) {
      allText += fs.readFileSync(path.join(chapterDir, f), 'utf-8') + '\n';
    }

    const cleanText = stripIntroLines(allText);
    const questionBlocks = extractQuestions(cleanText);

    if (questionBlocks.length === 0) {
      console.log(`  ⚠️  ${chapter}: No questions found`);
      continue;
    }

    const combinedDir = path.join(COMBINED_DIR, chapter);
    if (!fs.existsSync(combinedDir)) fs.mkdirSync(combinedDir, { recursive: true });

    const outputPath = path.join(combinedDir, 'combined_MCQ.txt');
    const output = questionBlocks.join('\n\n---\n\n');
    fs.writeFileSync(outputPath, output, 'utf-8');

    totalQuestions += questionBlocks.length;
    chapterCount++;
    console.log(`  ✅ ${chapter}: ${questionBlocks.length} questions → combined/${chapter}/combined_MCQ.txt`);
  }

  console.log(`\nDone: ${chapterCount} chapters, ${totalQuestions} total questions prepared for upload.`);
  console.log(`\nRun the upload now:\n  cd E:\\Qosten\\qosten-react\n  node scripts/interactive_mcq_upload.mjs\n`);
}

main().catch(console.error);
