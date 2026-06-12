import fs from 'fs';
import fetch from 'node-fetch';

const API = 'https://questions-api.edventure.workers.dev';
const BACKUP_FILE = 'backup_questions_dwighata.json';

// ============================================================
// STEP 1: Parse and fix metadata
// ============================================================
function fixQuestion(q) {
  const fixed = { ...q };

  // Fix language (all are Bengali, not English)
  fixed.language = 'bn';

  // Check if metadata is embedded in question_text
  const qt = q.question_text || '';
  const metaRegex = /^\[ID:\s*(\d+)\],\s*\[Subject:\s*(.*?)\],\s*\[Chapter:\s*(.*?)\],\s*\[Lesson:\s*(.*?)\],\s*\[Board:\s*(.*?)\],\s*/;
  const match = qt.match(metaRegex);

  if (match) {
    // Extract metadata from question_text
    const [, origId, origSubject, origChapter, origLesson, origBoard] = match;
    fixed.question_text = qt.replace(metaRegex, '').trim();
    if (!fixed.subject || fixed.subject === 'N/A') fixed.subject = origSubject;
    if (!fixed.chapter || fixed.chapter === 'N/A') fixed.chapter = origChapter;
    if (!fixed.lesson) fixed.lesson = origLesson;
    if (!fixed.board) fixed.board = origBoard;
  }

  // Ensure proper fields
  if (!fixed.subject) fixed.subject = 'উচ্চতর গণিত';
  if (!fixed.chapter) fixed.chapter = 'দ্বিঘাত সমীকরণ';
  if (!fixed.explanation) fixed.explanation = '';
  if (fixed.is_verified === undefined) fixed.is_verified = 0;
  if (fixed.is_flagged === undefined) fixed.is_flagged = 0;
  if (fixed.is_premium === undefined) fixed.is_premium = 0;

  // Keep only fields the API expects for upload
  const clean = {
    type: fixed.type || 'mcq',
    subject: fixed.subject,
    chapter: fixed.chapter,
    lesson: fixed.lesson || '',
    board: fixed.board || '',
    language: fixed.language,
    question_text: fixed.question_text,
    options: fixed.options,
    correct_answer: fixed.correct_answer,
    explanation: fixed.explanation,
    is_verified: fixed.is_verified,
    is_flagged: fixed.is_flagged,
    in_review_queue: fixed.in_review_queue || 0,
  };

  return clean;
}

// ============================================================
// STEP 2: Delete all questions from DB
// ============================================================
async function deleteQuestions(ids) {
  console.log(`\n=== DELETING ${ids.length} questions ===`);
  let success = 0, failed = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const resp = await fetch(`${API}/questions/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        success++;
      } else {
        const text = await resp.text();
        console.error(`  ✗ Failed to delete ${id}: ${resp.status} ${text.substring(0, 100)}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ Error deleting ${id}: ${err.message}`);
      failed++;
    }
    if ((i + 1) % 20 === 0 || i === ids.length - 1) {
      console.log(`  Progress: ${i + 1}/${ids.length} (${success} ok, ${failed} failed)`);
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`\nDeletion complete: ${success} deleted, ${failed} failed`);
  return { success, failed };
}

// ============================================================
// STEP 3: Upload fixed questions
// ============================================================
async function uploadQuestions(questions) {
  console.log(`\n=== UPLOADING ${questions.length} fixed questions ===`);
  let success = 0, failed = 0;
  const failedPayloads = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const resp = await fetch(`${API}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(q),
      });
      if (resp.ok) {
        success++;
      } else {
        const text = await resp.text();
        console.error(`  ✗ Failed to upload #${i + 1}: ${resp.status} ${text.substring(0, 150)}`);
        failed++;
        failedPayloads.push({ index: i, payload: q, error: text.substring(0, 200) });
      }
    } catch (err) {
      console.error(`  ✗ Error uploading #${i + 1}: ${err.message}`);
      failed++;
      failedPayloads.push({ index: i, payload: q, error: err.message });
    }
    if ((i + 1) % 20 === 0 || i === questions.length - 1) {
      console.log(`  Progress: ${i + 1}/${questions.length} (${success} ok, ${failed} failed)`);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  if (failedPayloads.length > 0) {
    fs.writeFileSync('upload_failed_dwighata.json', JSON.stringify(failedPayloads, null, 2), 'utf8');
    console.log(`\nSaved ${failedPayloads.length} failed payloads to upload_failed_dwighata.json`);
  }

  console.log(`\nUpload complete: ${success} uploaded, ${failed} failed`);
  return { success, failed };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'help';

  if (mode === 'help') {
    console.log(`
Usage: node fix_dwighata_samikaran.mjs <command>

Commands:
  backup        - Backup current questions from API
  delete        - Delete ALL questions from the backup file
  upload        - Fix metadata and upload to API
  full          - backup + delete + upload (full cycle)
  show-fixed    - Show fixed question previews
`);
    return;
  }

  // Load backup
  let all = [];
  if (mode === 'backup') {
    console.log('Fetching questions from API...');
    let page = 0;
    const PAGE_SIZE = 500;
    while (true) {
      const params = new URLSearchParams();
      params.append('chapter', 'দ্বিঘাত সমীকরণ');
      params.append('limit', String(PAGE_SIZE));
      params.append('page', String(page));
      const resp = await fetch(`${API}/questions?${params.toString()}`);
      const data = await resp.json();
      const batch = Array.isArray(data) ? data : (data.data || []);
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(all, null, 2), 'utf8');
    console.log(`Backed up ${all.length} questions to ${BACKUP_FILE}`);
    return;
  }

  // Load from backup file
  if (!fs.existsSync(BACKUP_FILE)) {
    console.error(`Backup file ${BACKUP_FILE} not found. Run 'backup' first.`);
    return;
  }
  all = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));

  if (mode === 'show-fixed' || mode === 'full') {
    console.log(`\n=== Showing fixed question preview ===`);
    console.log(`Total: ${all.length} questions`);
    all.forEach((q, i) => {
      const fixed = fixQuestion(q);
      const wasFixed = (q.question_text || '').includes('[ID:');
      console.log(`\n${i + 1}. [${q.id}] ${wasFixed ? '⚠️ METADATA FIXED' : 'OK'} lang: ${q.language}→${fixed.language}`);
      if (wasFixed) {
        console.log(`   Before: ${(q.question_text || '').substring(0, 120)}...`);
        console.log(`   After:  ${fixed.question_text.substring(0, 120)}...`);
        console.log(`   Lesson: "${q.lesson}" → "${fixed.lesson}"`);
        console.log(`   Board:  "${q.board}" → "${fixed.board}"`);
      }
    });
    if (mode === 'show-fixed') return;
  }

  if (mode === 'delete' || mode === 'full') {
    const ids = all.map(q => q.id);
    console.log(`\nPreparing to delete ${ids.length} questions:`);
    ids.forEach(id => console.log(`  ${id}`));
    console.log('\nPress Ctrl+C within 5 seconds to abort...');
    await new Promise(r => setTimeout(r, 5000));
    await deleteQuestions(ids);
  }

  if (mode === 'upload' || mode === 'full') {
    const fixed = all.map(fixQuestion);
    // Save fixed questions for inspection
    fs.writeFileSync('fixed_questions_dwighata.json', JSON.stringify(fixed, null, 2), 'utf8');
    console.log(`\nSaved fixed questions to fixed_questions_dwighata.json`);
    await uploadQuestions(fixed);
  }

  if (mode === 'full') {
    console.log('\n=== FULL CYCLE COMPLETE ===');
    console.log('1. ✓ Backed up original questions');
    console.log('2. ✓ Deleted questions from DB');
    console.log('3. ✓ Fixed metadata and re-uploaded');
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
