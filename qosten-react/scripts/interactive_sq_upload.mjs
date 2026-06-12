import { parseSQQuestions } from '../src/utils/sqQuestionParser.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const COMBINED_DIR = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\combined';
const RETRY_DIR = path.join(COMBINED_DIR, '_retry');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}

async function getExistingForChapter(subject, chapter) {
  const all = [];
  const PAGE_SIZE = 500;
  let page = 0;
  while (true) {
    const params = new URLSearchParams();
    if (subject) params.append('subject', subject);
    if (chapter) params.append('chapter', chapter);
    params.append('type', 'sq');
    params.append('limit', String(PAGE_SIZE));
    params.append('page', String(page));
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/questions?${params.toString()}`);
      const data = await response.json();
      const batch = Array.isArray(data) ? data : (data.data || []);
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    } catch { break; }
  }
  return all;
}

async function createQuestion(q) {
  const response = await fetch(`${API_BASE_URL}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err.substring(0, 200));
  }
  return response.json();
}

function mapParsedToDb(q) {
  return {
    type: 'sq',
    subject: q.subject || 'N/A',
    chapter: q.chapter || 'N/A',
    lesson: q.lesson || 'N/A',
    board: q.board || 'N/A',
    language: q.language || 'bn',
    question_text: q.question || '',
    answer: q.answer || '',
    is_verified: 1,
    is_flagged: 0,
    in_review_queue: 0
  };
}

function normalizeText(t) {
  return (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

async function performUpload(sourcePath, questions, mapperFn, chapterName, orphans, defaultSubject, defaultChapter) {
  const mapped = questions.map(mapperFn);
  let successCount = 0, failedCount = 0;
  const failedPayloads = [];
  const CONCURRENCY = 5;

  console.log(`\nUploading ${mapped.length} questions...`);
  for (let i = 0; i < mapped.length; i += CONCURRENCY) {
    const chunk = mapped.slice(i, i + CONCURRENCY);
    const promises = chunk.map(q =>
      createQuestion(q)
        .then(() => successCount++)
        .catch(err => { failedCount++; failedPayloads.push({ payload: q, error: err.message }); })
    );
    await Promise.all(promises);
    process.stdout.write(`   ${Math.min(i + CONCURRENCY, mapped.length)}/${mapped.length} (${successCount} ok, ${failedCount} failed)\r`);
  }

  console.log(`\n\nInitial upload: ${successCount} ok, ${failedCount} failed`);

  if (failedPayloads.length > 0) {
    console.log(`\nRetrying ${failedPayloads.length} failed questions serially...`);
    let retryOk = 0, retryFail = 0;
    for (const f of failedPayloads) {
      try {
        await createQuestion(f.payload);
        retryOk++;
      } catch { retryFail++; }
    }
    successCount += retryOk;
    failedCount = retryFail;
    console.log(`Retry: ${retryOk} recovered, ${retryFail} still failed`);
  }

  console.log(`\nFinal: ${successCount} uploaded, ${failedCount} failed`);

  if (failedCount > 0) {
    if (!fs.existsSync(RETRY_DIR)) fs.mkdirSync(RETRY_DIR, { recursive: true });
    const retryFile = path.join(RETRY_DIR, `${chapterName}_sq_failed.json`);
    fs.writeFileSync(retryFile, JSON.stringify(failedPayloads.map(f => f.payload), null, 2), 'utf8');
    console.log(`   💾 Saved ${failedCount} failed payloads to ${retryFile}`);
  } else {
    const hiddenPath = sourcePath.replace(/\\/g, '/').replace(/combined_SQ\.txt$/, '_combined_SQ.done');
    try { fs.renameSync(sourcePath, hiddenPath); console.log('   📦 All done — removed from menu\n'); } catch (e) { console.log('   ⚠️ Could not hide file:', e.message); }
  }

  const logFile = path.join(COMBINED_DIR, '_upload_log.txt');
  const logEntry = `[${new Date().toISOString()}] SQ ${chapterName}: uploaded ${successCount}/${mapped.length}, orphans ${orphans.length}\n`;
  fs.appendFileSync(logFile, logEntry, 'utf8');
  return true;
}

async function processChapter(chapterDir) {
  const sqPath = path.join(chapterDir, 'combined_SQ.txt');
  if (!fs.existsSync(sqPath)) {
    console.log('   ⚠️ No combined_SQ.txt found.');
    return false;
  }

  const chapterName = path.basename(chapterDir);
  const isRetry = chapterDir.includes('SQ_Completed');
  const text = fs.readFileSync(sqPath, 'utf8');

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${isRetry ? 'RETRY' : 'CHAPTER'}: ${chapterName.padEnd(51)}║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  const raw = parseSQQuestions(text);
  console.log(`   → ${raw.length} questions parsed\n`);

  const seen = new Set();
  const deduped = [];
  raw.forEach(q => {
    const key = normalizeText(q.question || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(q);
  });
  console.log(`   → ${deduped.length} unique (${raw.length - deduped.length} dedup removed)\n`);

  const subjCounts = {}, chapCounts = {};
  deduped.forEach(q => {
    if (q.subject) subjCounts[q.subject] = (subjCounts[q.subject] || 0) + 1;
    if (q.chapter) chapCounts[q.chapter] = (chapCounts[q.chapter] || 0) + 1;
  });

  let defaultSubject = Object.entries(subjCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  let defaultChapter = Object.entries(chapCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  console.log('Subject/Chapter from file:');
  console.log(`   Subject: "${defaultSubject}"`);
  console.log(`   Chapter: "${defaultChapter}"`);

  const subjAns = await ask(`   Subject [default: ${defaultSubject}]: `);
  if (subjAns.trim()) defaultSubject = subjAns.trim();
  const chapAns = await ask(`   Chapter [default: ${defaultChapter}]: `);
  if (chapAns.trim()) defaultChapter = chapAns.trim();

  deduped.forEach(q => {
    q.subject = defaultSubject;
    q.chapter = defaultChapter;
    if (!q.language) q.language = 'bn';
  });

  const withAnswer = deduped.filter(q => q.answer && q.answer.trim());
  const withoutAnswer = deduped.filter(q => !q.answer || !q.answer.trim());

  const orphansDir = path.join(COMBINED_DIR, '_orphans');
  if (withoutAnswer.length > 0) {
    if (!fs.existsSync(orphansDir)) fs.mkdirSync(orphansDir, { recursive: true });
    const orphanContent = withoutAnswer.map((q, i) =>
      `--- Orphan ${i+1} ---\nQuestion: ${q.question || ''}\nAnswer: (missing)\n`
    ).join('\n\n');
    fs.writeFileSync(path.join(orphansDir, `${chapterName}_sq_orphans.txt`), orphanContent, 'utf8');
  }

  console.log(`\n   ✅ With answer: ${withAnswer.length}`);
  console.log(`   ⚠️  Orphans (no answer): ${withoutAnswer.length}`);

  console.log(`\nFetching existing questions from DB for "${defaultChapter}"...`);
  const existing = await getExistingForChapter(defaultSubject, defaultChapter);
  console.log(`   Found ${existing.length} existing SQs`);

  const existingTexts = new Set(existing.map(q => normalizeText(q.question_text || '')));

  const missing = withAnswer.filter(q => {
    const key = normalizeText(q.question || '');
    return !existingTexts.has(key);
  });

  const alreadyInDb = withAnswer.length - missing.length;
  console.log(`   Already in DB: ${alreadyInDb}`);
  console.log(`   Missing (to upload): ${missing.length}\n`);

  if (existing.length > 0) {
    const mode = await ask(`Delete ${existing.length} existing + reupload all ${withAnswer.length}? Or upload ${missing.length} missing only? (delete/upload/skip): `);
    if (mode.toLowerCase() === 'delete') {
      console.log(`\nDeleting ${existing.length} existing SQs...`);
      for (let i = 0; i < existing.length; i++) {
        try {
          await fetch(`${API_BASE_URL}/questions/${existing[i].id}`, { method: 'DELETE' });
          if ((i + 1) % 50 === 0) process.stdout.write(`   ${i+1}/${existing.length}\r`);
        } catch { process.stdout.write('x'); }
      }
      console.log(`   ✅ Deleted`);
      const ok = await ask(`\nUpload all ${withAnswer.length} questions? (yes/no): `);
      if (ok.toLowerCase() !== 'yes') { console.log('   Skipped.\n'); return false; }
      return await performUpload(sqPath, withAnswer, mapParsedToDb, chapterName, withoutAnswer);
    }
    if (mode.toLowerCase() !== 'upload') { console.log('   Skipped.\n'); return false; }
  }

  if (missing.length === 0) {
    console.log('✅ All questions already in database.\n');
    const hiddenPath = sqPath.replace(/\\/g, '/').replace(/combined_SQ\.txt$/, '_combined_SQ.done');
    try { fs.renameSync(sqPath, hiddenPath); console.log('   📦 Hidden from menu\n'); } catch (e) { console.log('   ⚠️ Could not hide:', e.message); }
    return true;
  }

  const ok = await ask(`Upload ${missing.length} missing questions? (yes/no): `);
  if (ok.toLowerCase() !== 'yes') { console.log('   Skipped.\n'); return false; }
  return await performUpload(sqPath, missing, mapParsedToDb, chapterName, withoutAnswer);
}

function findSources(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const subPath = path.join(dir, entry.name);
    const sqPath = path.join(subPath, 'combined_SQ.txt');
    try {
      if (fs.existsSync(sqPath)) results.push({ name: entry.name, path: subPath });
    } catch { /* skip */ }
  }
  return results;
}

function findSourcesRecursive(baseDir, prefix = '', excludePrefixes = ['_', 'MCQ_']) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (excludePrefixes.some(p => entry.name.startsWith(p))) continue;
    const subPath = path.join(baseDir, entry.name);
    const label = prefix ? `${prefix}/${entry.name}` : entry.name;
    const sqPath = path.join(subPath, 'combined_SQ.txt');
    try {
      if (fs.existsSync(sqPath)) results.push({ name: label, path: subPath });
    } catch { /* skip */ }
    results.push(...findSourcesRecursive(subPath, label, excludePrefixes));
  }
  return results;
}

async function main() {
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║           SQ UPLOADER - Retry Failed Questions              ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  while (true) {
    const dirs = [];

    const completed = findSources(path.join(COMBINED_DIR, 'SQ_Completed'));
    for (const d of completed) dirs.push({ ...d, source: 'SQ_Completed' });

    const root = findSourcesRecursive(COMBINED_DIR, '', ['_orphans', 'MCQ_Completed', 'SQ_Completed', '1 Completed']);
    for (const d of root) {
      if (!dirs.some(x => x.path === d.path)) dirs.push({ ...d, source: 'root' });
    }

    const oneDir = path.join(COMBINED_DIR, '1 Completed');
    if (fs.existsSync(oneDir)) {
      const subs = findSources(oneDir);
      for (const d of subs) dirs.push({ name: `1 Completed/${d.name}`, path: d.path, source: 'root' });
    }

    if (dirs.length === 0) {
      console.log('No chapter directories with combined_SQ.txt found.');
      break;
    }

    console.log('Available chapters:');
    console.log('  0) Exit');
    dirs.forEach((d, i) => {
      const tag = d.source === 'SQ_Completed' ? ' (retry)' : '';
      console.log(`  ${i+1}) ${d.name}${tag}`);
    });
    console.log('');

    const choice = await ask('Select chapter number: ');
    const num = parseInt(choice);

    if (num === 0 || isNaN(num)) { console.log('\nGoodbye!'); break; }
    if (num < 1 || num > dirs.length) { console.log('Invalid choice.\n'); continue; }

    await processChapter(dirs[num - 1].path);

    const cont = await ask('\nProcess another chapter? (yes/no): ');
    if (cont.toLowerCase() !== 'yes') { console.log('\nGoodbye!'); break; }
    console.log('');
  }

  rl.close();
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  rl.close();
  process.exit(1);
});
