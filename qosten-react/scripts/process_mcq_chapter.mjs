/**
 * Process MCQ chapter: parse, dedup, fix metadata, separate orphans, upload
 * 
 * Usage:
 *   --dry-run   : Parse, fix, show report (no DB changes) [DEFAULT]
 *   --upload    : Actually delete old + upload new questions
 * 
 * Example:
 *   node scripts/process_mcq_chapter.mjs "D:\path\to\combined_MCQ.txt" --dry-run
 *   node scripts/process_mcq_chapter.mjs "D:\path\to\combined_MCQ.txt" --upload
 */

import { parseMCQQuestions, validateMCQQuestion } from '../src/utils/mcqQuestionParser.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const error = await response.text();
      console.error(`  Attempt ${i + 1} failed: ${response.status} - ${error.substring(0, 200)}`);
    } catch (err) {
      console.error(`  Attempt ${i + 1} error:`, err.message);
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Failed after ${retries} attempts`);
}

async function fetchQuestionsByChapter(subject, chapter, type = 'mcq') {
  const params = new URLSearchParams();
  if (subject) params.append('subject', subject);
  if (chapter) params.append('chapter', chapter);
  if (type) params.append('type', type);
  params.append('limit', '5000');
  const response = await fetchWithRetry(`${API_BASE_URL}/questions?${params.toString()}`);
  const data = await response.json();
  return Array.isArray(data) ? data : (data.data || []);
}

async function deleteQuestion(id) {
  await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, { method: 'DELETE' });
}

async function createQuestion(q) {
  const response = await fetch(`${API_BASE_URL}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HTTP ${response.status}: ${err.substring(0, 200)}`);
  }
  return response.json();
}

async function bulkCreateQuestions(questions) {
  const results = { successCount: 0, failedCount: 0, errors: [] };
  const CONCURRENCY = 1;
  
  for (let i = 0; i < questions.length; i += CONCURRENCY) {
    const chunk = questions.slice(i, i + CONCURRENCY);
    const promises = chunk.map(q =>
      createQuestion(q)
        .then(() => results.successCount++)
        .catch(err => {
          results.failedCount++;
          results.errors.push(`Q#${results.successCount + results.failedCount}: ${err.message}`);
        })
    );
    await Promise.all(promises);
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, questions.length)}/${questions.length}\r`);
  }
  console.log(`  ✅ ${results.successCount} uploaded, ${results.failedCount} failed`);
  return results;
}

function mapParsedToDb(q) {
  return {
    type: 'mcq',
    subject: q.subject || 'N/A',
    chapter: q.chapter || 'N/A',
    lesson: q.lesson || 'N/A',
    board: q.board || 'N/A',
    language: q.language || 'bn',
    question_text: q.questionText || q.question || '',
    options: JSON.stringify((q.options || []).map(o => ({
      label: o.label,
      text: o.text,
      image: o.image || null,
      is_correct: o.label === q.correctAnswer
    }))),
    correct_answer: q.correctAnswer || '',
    explanation: q.explanation || '',
    is_verified: 0,
    is_flagged: 0,
    in_review_queue: 1
  };
}

function textToBracketed(q) {
  const lines = [];
  if (q.id) lines.push(`[ID: ${q.id}]`);
  if (q.subject) lines.push(`[Subject: ${q.subject}]`);
  if (q.chapter) lines.push(`[Chapter: ${q.chapter}]`);
  if (q.lesson) lines.push(`[Lesson: ${q.lesson}]`);
  if (q.board) lines.push(`[Board: ${q.board}]`);
  lines.push(q.questionText || q.question || '');
  (q.options || []).forEach(o => lines.push(`${o.label}) ${o.text}`));
  lines.push(`Correct: ${q.correctAnswer}`);
  lines.push(`Explanation:\n${q.explanation || '(none)'}`);
  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = process.argv[2];
  const mode = process.argv[3] === '--upload' ? 'upload' : 'dry-run';
  const includeOrphans = process.argv.includes('--include-orphans');

  if (!filePath) {
    console.error('Usage: node scripts/process_mcq_chapter.mjs <path-to-txt-file> [--dry-run | --upload] [--include-orphans]');
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.txt');

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  MCQ PROCESSOR: ${baseName.padEnd(47)}║`);
  console.log(`║  Mode: ${mode.padEnd(55)}║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
  console.log(`📂 ${filePath}`);
  console.log(`📄 ${text.length} chars\n`);

  // ─── 1. Parse ──────────────────────────────────────────────────────────────
  console.log('─── 1. PARSING ───');
  const raw = parseMCQQuestions(text);
  console.log(`   Parsed: ${raw.length} questions\n`);

  // ─── 2. Deduplicate (keep first occurrence) ────────────────────────────────
  console.log('─── 2. DEDUPLICATING ───');
  const seen = new Set();
  const deduped = [];
  raw.forEach((q, i) => {
    const key = (q.questionText || q.question || '').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(q);
  });
  const removed = raw.length - deduped.length;
  console.log(`   Kept: ${deduped.length}, Removed duplicates: ${removed}\n`);

  // ─── 3. Fill missing subject/chapter ───────────────────────────────────────
  console.log('─── 3. FIXING METADATA ───');

  // Find the most common subject/chapter from valid questions
  const subjectCounts = {};
  const chapterCounts = {};
  deduped.forEach(q => {
    if (q.subject) subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    if (q.chapter) chapterCounts[q.chapter] = (chapterCounts[q.chapter] || 0) + 1;
  });

  const defaultSubject = 'বাংলা প্রথম পত্র';
  const defaultChapter = Object.entries(chapterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ফুলের বিবাহ';

  console.log(`   Default Subject: ${defaultSubject}`);
  console.log(`   Default Chapter: ${defaultChapter}`);

  // Force ALL questions to use the most frequent subject/chapter
  let fixedCount = 0;
  deduped.forEach(q => {
    if (q.subject !== defaultSubject) { q.subject = defaultSubject; fixedCount++; }
    if (q.chapter !== defaultChapter) { q.chapter = defaultChapter; fixedCount++; }
    if (!q.language) q.language = 'bn';
  });
  console.log(`   Normalized to most frequent: ${fixedCount} fields changed\n`);

  // ─── 4. Separate questions without explanations ────────────────────────────
  console.log('─── 4. SEPARATING ORPHANS ───');

  const withExplanation = includeOrphans ? deduped : deduped.filter(q => q.explanation && q.explanation.trim());
  const withoutExplanation = includeOrphans ? [] : deduped.filter(q => !q.explanation || !q.explanation.trim());

  console.log(`   With explanation: ${withExplanation.length}`);
  console.log(`   Without explanation: ${withoutExplanation.length}`);

  // Save orphans to a separate file
  if (withoutExplanation.length > 0) {
    const orphansDir = path.join(dir, '_orphans');
    if (!fs.existsSync(orphansDir)) fs.mkdirSync(orphansDir, { recursive: true });
    const orphanContent = withoutExplanation.map((q, i) => {
      return `--- Question ${i + 1} (orphan) ---\n${textToBracketed(q)}\n`;
    }).join('\n');
    const orphanFile = path.join(orphansDir, `${baseName}_orphans.txt`);
    fs.writeFileSync(orphanFile, orphanContent, 'utf8');
    console.log(`   📝 Orphans saved to: ${orphanFile}`);
  }

  // ─── 5. Validation summary ────────────────────────────────────────────────
  console.log('\n─── 5. FINAL SUMMARY ───');
  console.log('');
  console.log(`   Total parsed:        ${raw.length}`);
  console.log(`   Duplicates removed:   ${removed}`);
  console.log(`   After dedup:          ${deduped.length}`);
  console.log(`   ───────────────────────────`);
  console.log(`   ✅ Ready to upload:   ${withExplanation.length}`);
  console.log(`   ⚠️  Saved as orphans: ${withoutExplanation.length}`);
  console.log('');
  console.log('   Chapters in upload set:');
  const chaps = {};
  withExplanation.forEach(q => {
    const key = `${q.subject} / ${q.chapter}`;
    chaps[key] = (chaps[key] || 0) + 1;
  });
  Object.entries(chaps).forEach(([k, c]) => console.log(`     ${k}: ${c}`));
  console.log('');

  // Show sample data
  console.log('   Sample question (first upload-ready):');
  if (withExplanation.length > 0) {
    const s = withExplanation[0];
    console.log(`     Subject: ${s.subject}`);
    console.log(`     Chapter: ${s.chapter}`);
    console.log(`     Q: ${(s.questionText || '').substring(0, 70)}`);
    console.log(`     Options: ${(s.options || []).map(o => `${o.label}) ${o.text}`).join(', ').substring(0, 60)}`);
    console.log(`     Correct: ${s.correctAnswer}`);
    console.log(`     Explanation: ${(s.explanation || '').substring(0, 60)}`);
  }
  console.log('');

  // ─── 6. Upload (only in --upload mode) ────────────────────────────────────
  if (mode === 'upload') {
    console.log('─── 6. UPLOADING ───\n');

    // Step A: Delete existing questions for these chapters
    const chaptersToDelete = [...new Set(withExplanation.map(q => q.chapter))];
    const subjectToDelete = [...new Set(withExplanation.map(q => q.subject))];

    for (const chapter of chaptersToDelete) {
      const subject = withExplanation.find(q => q.chapter === chapter)?.subject || subjectToDelete[0];
      console.log(`   🔍 Fetching existing MCQs for "${chapter}"...`);
      const existing = await fetchQuestionsByChapter(subject, chapter, 'mcq');
      if (existing.length > 0) {
        console.log(`   🗑️  Deleting ${existing.length} old MCQs...`);
        for (const q of existing) {
          try {
            await deleteQuestion(q.id);
            process.stdout.write('.');
          } catch (err) {
            process.stdout.write('x');
          }
        }
        console.log(`\n   ✅ Deleted ${existing.length} questions for "${chapter}"`);
      } else {
        console.log(`   No existing MCQs for "${chapter}"`);
      }
    }

    // Step B: Upload new questions
    console.log(`\n   📤 Uploading ${withExplanation.length} questions...`);
    const mapped = withExplanation.map(mapParsedToDb);
    console.log(`   Sample upload payload:`);
    console.log(`   ${JSON.stringify(mapped[0], null, 4).substring(0, 300)}...`);

    const result = await bulkCreateQuestions(mapped);

    console.log(`\n   ✅ Upload complete!`);
    console.log(`      Success: ${result.successCount}`);
    console.log(`      Failed: ${result.failedCount}`);
    if (result.errors.length > 0) {
      console.log(`      Errors:`);
      result.errors.forEach(e => console.log(`        - ${e}`));
    }

    // Save log
    const logFile = path.join(dir, `${baseName}_upload_log.json`);
    fs.writeFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      sourceFile: filePath,
      totalParsed: raw.length,
      duplicatesRemoved: removed,
      uploaded: result.successCount,
      failed: result.failedCount,
      orphans: withoutExplanation.length,
      chapters: chaptersToDelete,
      subjects: subjectToDelete
    }, null, 2), 'utf8');
    console.log(`   📝 Log: ${logFile}`);
  } else {
    console.log('─── 6. UPLOAD ───');
    console.log('');
    console.log('   🔶 DRY RUN — no database operations performed.');
    console.log(`   To upload, run with --upload flag:`);
    console.log(`   node scripts/process_mcq_chapter.mjs "${filePath}" --upload`);
    console.log('');
    console.log('   This will:');
    const delChapters = [...new Set(withExplanation.map(q => q.chapter))];
    if (delChapters.length > 0) {
      console.log(`   🗑️  Delete existing MCQs for ${delChapters.length} chapter(s)`);
    }
    console.log(`   📤 Upload ${withExplanation.length} questions`);
    console.log(`   📝 Save ${withoutExplanation.length} orphans to _orphans/`);
    console.log('');
  }

  console.log('──────────────────────────────────────────────');
  console.log('✅ Done.\n');
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});