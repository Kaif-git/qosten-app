import { parseCQQuestions } from '../src/utils/cqParser.js';
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
    params.append('type', 'cq');
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
    type: 'cq',
    subject: q.subject || 'N/A',
    chapter: q.chapter || 'N/A',
    lesson: q.lesson || 'N/A',
    board: q.board || 'N/A',
    language: q.language || 'bn',
    question_text: q.questionText || '',
    stem: q.stem || q.questionText || '',
    parts: JSON.stringify((q.parts || []).map(p => ({
      letter: p.letter || p.label || '',
      label: p.label || p.letter || '',
      text: p.text || '',
      marks: p.marks || 0,
      answer: p.answer || '',
      image: null
    }))),
    is_verified: 1,
    is_flagged: 0,
    in_review_queue: 0
  };
}

function normalizeText(t) {
  return (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

const placeholderPatterns = [
  /\[not provided\]/i, /\[not mentioned\]/i, /\[not specified\]/i,
  /\[no text\]/i, /\[missing\]/i, /not provided/i, /n\/a/i,
  /\[stem not provided/i, /\[answer not present/i,
  /stem not provided/i, /answer not present/i,
  /not provided in the (text|image)/i,
  /not present in the (text|image)/i,
  /--- batch \d+ ---/i,
  /\(not specified\)/i,
  /\(n\/a\)/i,
  /not provided in image/i,
];

const aiAnalysisPatterns = [
  /according to your instructions/i,
  /i have reproduced/i,
  /based on the book content/i,
  /logically consistent/i,
  /only answers are present/i,
  /not provided in the text/i,
  /here is the reproduced/i,
  /all (the )?provided (creative )?questions/i,
  /analysis (summary|result)[:\s]/i,
  /verdict[:\s]/i,
  /core logic[:\s]/i,
  /thematic accuracy[:\s]/i,
  /contextual alignment[:\s]/i,
  /technical accuracy[:\s]/i,
  /textual interpretation[:\s]/i,
  /based on my analysis/i,
  /here (is|are) the review/i,
  /the answers correctly (identify|reference|apply|distinguish)/i,
  /the logic is sound/i,
  /no reproduction is required/i,
  /all cqs? are ok/i,
  /the gist is correct/i,
  /### (category|mcq|sq|cq)\b/i,
  /overview of a topic/i,
  /textbook content/i,
  /\(note:.*\)/i,
  /the stem.*is missing/i,
  /answers are given/i,
];

function hasBangla(t) {
  return /[\u0980-\u09FF]/.test(t);
}

function isEnglishOnly(t) {
  if (!t || !t.trim()) return false;
  return /[a-zA-Z]/.test(t) && !hasBangla(t);
}

function isPlaceholder(t) {
  return !t || !t.trim() || placeholderPatterns.some(p => p.test(t));
}

function hasAiGarbage(t) {
  return aiAnalysisPatterns.some(p => p.test(t));
}

function isGarbage(t) {
  return hasAiGarbage(t) || isEnglishOnly(t);
}

function isComplete(q) {
  if (!q.parts || q.parts.length === 0) return false;
  const questionText = (q.questionText || '').trim();
  const stem = (q.stem || '').trim();
  if (!questionText && !stem) return false;
  if (isGarbage(questionText) || isGarbage(stem)) return false;
  for (const p of q.parts) {
    const pt = (p.text || '').trim();
    const pa = (p.answer || '').trim();
    if (!pt || !pa) return false;
    if (isPlaceholder(pt) || isPlaceholder(pa)) return false;
    if (isEnglishOnly(pt) || isEnglishOnly(pa)) return false;
    if (hasAiGarbage(pt) || hasAiGarbage(pa)) return false;
  }
  return true;
}

async function performUpload(sourcePath, questions, mapperFn, chapterName) {
  const mapped = questions.map(mapperFn);
  let successCount = 0, failedCount = 0;
  const failedPayloads = [];
  const CONCURRENCY = 3;

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
      try { await createQuestion(f.payload); retryOk++; } catch { retryFail++; }
    }
    successCount += retryOk;
    failedCount = retryFail;
    console.log(`Retry: ${retryOk} recovered, ${retryFail} still failed`);
  }

  console.log(`\nFinal: ${successCount} uploaded, ${failedCount} failed`);

  if (failedCount > 0) {
    if (!fs.existsSync(RETRY_DIR)) fs.mkdirSync(RETRY_DIR, { recursive: true });
    const retryFile = path.join(RETRY_DIR, `${chapterName}_cq_failed.json`);
    fs.writeFileSync(retryFile, JSON.stringify(failedPayloads.map(f => f.payload), null, 2), 'utf8');
    console.log(`   💾 Saved ${failedCount} failed payloads to ${retryFile}`);
  } else {
    const hiddenPath = sourcePath.replace(/\\/g, '/').replace(/combined_CQ\.txt$/, '_combined_CQ.done');
    try { fs.renameSync(sourcePath, hiddenPath); console.log('   📦 All done — removed from menu\n'); } catch (e) { console.log('   ⚠️ Could not hide file:', e.message); }
  }

  const logFile = path.join(COMBINED_DIR, '_upload_log.txt');
  const logEntry = `[${new Date().toISOString()}] CQ ${chapterName}: uploaded ${successCount}/${mapped.length}\n`;
  fs.appendFileSync(logFile, logEntry, 'utf8');
  return true;
}

async function fetchHierarchy() {
  const res = await fetchWithRetry(`${API_BASE_URL}/hierarchy`);
  const data = await res.json();
  return data;
}

const bnToRoman = {
  'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou',
  'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'ch','জ':'j','ঝ':'jh','ঞ':'n',
  'ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n',
  'প':'p','ফ':'f','ব':'b','ভ':'bh','ম':'m','য':'j','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s',
  'হ':'h','ড়':'r','ঢ়':'rh','য়':'y','ং':'ng','ঃ':'h','ঁ':'n',
  'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou',
  '০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9',
};

function transliterateBn(text) {
  let result = '';
  for (const ch of text) {
    result += bnToRoman[ch] || ch;
  }
  return result;
}

function transliterateBnAlt(text) {
  let result = '';
  for (const ch of text) {
    if (ch === 'ভ') result += 'v';
    else result += bnToRoman[ch] || ch;
  }
  return result;
}

function normalizeForMatch(text) {
  return text.toLowerCase().replace(/[\s\-_()\[\]'",.]+/g, '').replace(/[^a-z0-9]/g, '');
}

function diceCoeff(a, b) {
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substring(i, i + 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substring(i, i + 2);
    const count = bigrams.get(bg) || 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }
  const total = a.length + b.length - 2;
  return total === 0 ? 0 : (2 * intersection) / total;
}

function matchChapter(folderName, apiChapters) {
  const folderNorm = normalizeForMatch(folderName);
  let best = null, bestScore = 0;
  for (const ch of apiChapters) {
    const romanized = transliterateBn(ch.name);
    const romanizedAlt = transliterateBnAlt(ch.name);
    const chNorm = normalizeForMatch(romanized);
    const chNormAlt = normalizeForMatch(romanizedAlt);
    const directNorm = normalizeForMatch(ch.name);
    const score = Math.max(
      diceCoeff(folderNorm, chNorm),
      diceCoeff(folderNorm, chNormAlt),
      diceCoeff(folderNorm, directNorm)
    );
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return bestScore >= 0.35 ? { chapter: best, score: bestScore } : null;
}

async function autoMode() {
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║           AUTO MODE - Delete & Reupload All CQs             ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  console.log('Fetching subject hierarchy...');
  const hierarchy = await fetchHierarchy();
  const subject = hierarchy.find(s => s.name === 'বাংলা প্রথম পত্র');
  if (!subject) { console.log('❌ Could not find বাংলা প্রথম পত্র in hierarchy.\n'); return; }
  const apiChapters = subject.chapters;
  console.log(`   ✅ Found subject "${subject.name}" with ${apiChapters.length} chapters\n`);

  const allDirs = [];
  for (const searchDir of [COMBINED_DIR, path.join(COMBINED_DIR, '1 Completed')]) {
    const found = findSources(searchDir);
    for (const d of found) {
      const donePath = path.join(d.path, '_combined_CQ.done');
      const txtPath = path.join(d.path, 'combined_CQ.txt');
      if (d.done) {
        try { fs.renameSync(donePath, txtPath); } catch {}
      }
      allDirs.push(d);
    }
  }

  console.log(`Found ${allDirs.length} chapter folders\n`);

  let totalSuccess = 0, totalFail = 0, totalSkipped = 0;

  for (let idx = 0; idx < allDirs.length; idx++) {
    const d = allDirs[idx];
    const folderName = path.basename(d.path);
    const cqPath = path.join(d.path, 'combined_CQ.txt');
    if (!fs.existsSync(cqPath)) { totalSkipped++; continue; }

    const match = matchChapter(folderName, apiChapters);
    if (!match) {
      console.log(`  [${idx+1}/${allDirs.length}] ⏭️ ${folderName} — could not match to API chapter`);
      totalSkipped++;
      continue;
    }

    const apiChapterName = match.chapter.name;
    console.log(`\n  [${idx+1}/${allDirs.length}] 📘 ${folderName} → "${apiChapterName}" (score: ${match.score.toFixed(2)})`);

    const text = fs.readFileSync(cqPath, 'utf8');
    const raw = parseCQQuestions(text);

    const seen = new Set();
    const deduped = [];
    raw.forEach(q => {
      const key = normalizeText(q.questionText || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push(q);
    });

    const clean = deduped.filter(q => {
      const qt = (q.questionText || '').trim();
      const st = (q.stem || '').trim();
      if (!qt && !st) return false;
      if (isGarbage(qt) || isGarbage(st)) return false;
      if (!q.parts || q.parts.length === 0) return false;
      return q.parts.every(p => {
        const pt = (p.text || '').trim();
        const pa = (p.answer || '').trim();
        return pt && pa && !isPlaceholder(pt) && !isPlaceholder(pa)
          && !isEnglishOnly(pt) && !isEnglishOnly(pa)
          && !hasAiGarbage(pt) && !hasAiGarbage(pa);
      });
    });

    console.log(`     Parsed: ${raw.length} → ${deduped.length} unique → ${clean.length} clean`);

    clean.forEach(q => {
      q.subject = subject.name;
      q.chapter = apiChapterName;
      q.language = 'bn';
    });

    const existing = await getExistingForChapter(subject.name, apiChapterName);
    if (existing.length > 0) {
      console.log(`     Deleting ${existing.length} existing CQs...`);
      for (let i = 0; i < existing.length; i++) {
        try {
          await fetch(`${API_BASE_URL}/questions/${existing[i].id}`, { method: 'DELETE' });
          if ((i + 1) % 100 === 0) process.stdout.write(`       ${i+1}/${existing.length}\r`);
        } catch {}
      }
      console.log(`       ✅ Deleted`);
    }

    const mapped = clean.map(mapParsedToDb);
    let successCount = 0, failedCount = 0;
    const failedPayloads = [];

    console.log(`     Uploading ${mapped.length} questions...`);
    for (let i = 0; i < mapped.length; i += 3) {
      const chunk = mapped.slice(i, i + 3);
      const promises = chunk.map(q =>
        createQuestion(q)
          .then(() => successCount++)
          .catch(err => { failedCount++; failedPayloads.push({ payload: q, error: err.message }); })
      );
      await Promise.all(promises);
      process.stdout.write(`       ${Math.min(i + 3, mapped.length)}/${mapped.length} (${successCount} ok, ${failedCount} failed)\r`);
    }

    console.log(`\n       Initial: ${successCount} ok, ${failedCount} failed`);

    if (failedPayloads.length > 0) {
      console.log(`       Retrying ${failedPayloads.length} serially...`);
      for (const f of failedPayloads) {
        try { await createQuestion(f.payload); successCount++; } catch { failedCount = (failedCount || 0) + 1; }
      }
      console.log(`       Final: ${successCount} uploaded, ${failedCount} failed`);
    }

    if (failedCount > 0) {
      if (!fs.existsSync(RETRY_DIR)) fs.mkdirSync(RETRY_DIR, { recursive: true });
      fs.writeFileSync(path.join(RETRY_DIR, `${folderName}_cq_failed.json`), JSON.stringify(failedPayloads.map(f => f.payload), null, 2), 'utf8');
    } else {
      const hiddenPath = cqPath.replace(/\\/g, '/').replace(/combined_CQ\.txt$/, '_combined_CQ.done');
      try { fs.renameSync(cqPath, hiddenPath); } catch {}
    }

    totalSuccess += successCount;
    totalFail += failedCount;
    console.log(`     ✅ Done — ${successCount} uploaded, ${failedCount} failed\n`);
  }

  console.log(`╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  AUTO MODE COMPLETE                                         ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝`);
  console.log(`   Total uploaded: ${totalSuccess}`);
  console.log(`   Total failed:   ${totalFail}`);
  console.log(`   Total skipped:  ${totalSkipped}\n`);
}

async function processChapter(chapterDir) {
  const cqPath = path.join(chapterDir, 'combined_CQ.txt');
  if (!fs.existsSync(cqPath)) {
    console.log('   ⚠️ No combined_CQ.txt found.');
    return false;
  }

  const chapterName = path.basename(chapterDir);
  const text = fs.readFileSync(cqPath, 'utf8');

  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║  ${chapterName.padEnd(55)}║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  const raw = parseCQQuestions(text);
  console.log(`   → ${raw.length} questions parsed\n`);

  const seen = new Set();
  const deduped = [];
  raw.forEach(q => {
    const key = normalizeText(q.questionText || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(q);
  });
  console.log(`   → ${deduped.length} unique (${raw.length - deduped.length} dedup removed)\n`);

  const beforeFilter = deduped.length;
  const clean = deduped.filter(q => {
    const qt = (q.questionText || '').trim();
    const st = (q.stem || '').trim();
    if (!qt && !st) return false;
    if (isGarbage(qt) || isGarbage(st)) return false;
    if (!q.parts || q.parts.length === 0) return false;
    return q.parts.every(p => {
      const pt = (p.text || '').trim();
      const pa = (p.answer || '').trim();
      return pt && pa && !isPlaceholder(pt) && !isPlaceholder(pa)
        && !isEnglishOnly(pt) && !isEnglishOnly(pa)
        && !hasAiGarbage(pt) && !hasAiGarbage(pa);
    });
  });
  const garbageCount = beforeFilter - clean.length;
  if (garbageCount > 0) console.log(`   🗑️ ${garbageCount} garbage/placeholder questions removed\n`);

  const subjCounts = {}, chapCounts = {};
  clean.forEach(q => {
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

  clean.forEach(q => {
    q.subject = defaultSubject;
    q.chapter = defaultChapter;
    if (!q.language) q.language = 'bn';
  });

  const orphansDir = path.join(COMBINED_DIR, '_orphans');

  console.log(`\n   ✅ Ready to upload: ${clean.length}`);

  console.log(`\nFetching existing questions from DB for "${defaultChapter}"...`);
  const existing = await getExistingForChapter(defaultSubject, defaultChapter);
  console.log(`   Found ${existing.length} existing CQs`);

  const existingTexts = new Set(existing.map(q => normalizeText(q.question_text || '')));

  const missing = clean.filter(q => {
    const key = normalizeText(q.questionText || '');
    return !existingTexts.has(key);
  });

  const alreadyInDb = clean.length - missing.length;
  console.log(`   Already in DB: ${alreadyInDb}`);
  console.log(`   Missing (to upload): ${missing.length}\n`);

  if (existing.length > 0) {
    const mode = await ask(`Delete ${existing.length} existing + reupload all ${clean.length}? Or upload ${missing.length} missing only? (delete/upload/skip): `);
    if (mode.toLowerCase() === 'delete') {
      console.log(`\nDeleting ${existing.length} existing CQs...`);
      for (let i = 0; i < existing.length; i++) {
        try {
          await fetch(`${API_BASE_URL}/questions/${existing[i].id}`, { method: 'DELETE' });
          if ((i + 1) % 50 === 0) process.stdout.write(`   ${i+1}/${existing.length}\r`);
        } catch { process.stdout.write('x'); }
      }
      console.log(`   ✅ Deleted`);
      const ok = await ask(`\nUpload all ${clean.length} questions? (yes/no): `);
      if (ok.toLowerCase() !== 'yes') { console.log('   Skipped.\n'); return false; }
      return await performUpload(cqPath, clean, mapParsedToDb, chapterName);
    }
    if (mode.toLowerCase() !== 'upload') { console.log('   Skipped.\n'); return false; }
  }

  if (missing.length === 0) {
    console.log('✅ All questions already in database.\n');
    const hiddenPath = cqPath.replace(/\\/g, '/').replace(/combined_CQ\.txt$/, '_combined_CQ.done');
    try { fs.renameSync(cqPath, hiddenPath); console.log('   📦 Hidden from menu\n'); } catch (e) { console.log('   ⚠️ Could not hide:', e.message); }
    return true;
  }

  const ok = await ask(`Upload ${missing.length} missing questions? (yes/no): `);
  if (ok.toLowerCase() !== 'yes') { console.log('   Skipped.\n'); return false; }
  return await performUpload(cqPath, missing, mapParsedToDb, chapterName);
}

function findSources(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const subPath = path.join(dir, entry.name);
    const cqPath = path.join(subPath, 'combined_CQ.txt');
    const donePath = path.join(subPath, '_combined_CQ.done');
    try {
      if (fs.existsSync(cqPath)) results.push({ name: entry.name, path: subPath, done: false });
      else if (fs.existsSync(donePath)) results.push({ name: entry.name, path: subPath, done: true });
    } catch {}
  }
  return results;
}

async function main() {
  console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
  console.log(`║           CQ UPLOADER - Interactive Mode                   ║`);
  console.log(`╚═══════════════════════════════════════════════════════════════╝\n`);

  while (true) {
    const dirs = [];

    const completed = findSources(path.join(COMBINED_DIR, 'CQ_Completed'));
    for (const d of completed) dirs.push({ ...d, source: 'CQ_Completed' });

    const root = findSources(COMBINED_DIR);
    for (const d of root) {
      if (!dirs.some(x => x.path === d.path)) dirs.push({ ...d, source: 'root' });
    }

    const oneDir = path.join(COMBINED_DIR, '1 Completed');
    if (fs.existsSync(oneDir)) {
      const subs = findSources(oneDir);
      for (const d of subs) dirs.push({ name: `1 Completed/${d.name}`, path: d.path, source: 'root' });
    }

    if (dirs.length === 0) {
      console.log('No chapter directories with combined_CQ.txt found.');
      break;
    }

    console.log('Available chapters:');
    console.log('  0) Exit');
    console.log('  r) Reveal all completed chapters');
    console.log('  a) AUTO MODE — delete & reupload ALL chapters');
    dirs.forEach((d, i) => {
      const tag = d.done ? ' (done)' : (d.source === 'CQ_Completed' ? ' (retry)' : '');
      console.log(`  ${i+1}) ${d.name}${tag}`);
    });
    console.log('');

    const choice = await ask('Select chapter number: ');
    const trimmed = choice.trim().toLowerCase();

    if (trimmed === 'a') {
      await autoMode();
      continue;
    }

    if (trimmed === 'r') {
      let revealed = 0;
      for (const d of dirs) {
        if (!d.done) continue;
        const donePath = path.join(d.path, '_combined_CQ.done');
        const txtPath = path.join(d.path, 'combined_CQ.txt');
        try { fs.renameSync(donePath, txtPath); revealed++; } catch {}
      }
      console.log(`   ✅ Revealed ${revealed} chapters\n`);
      continue;
    }

    const num = parseInt(choice);

    if (num === 0 || isNaN(num)) { console.log('\nGoodbye!'); break; }
    if (num < 1 || num > dirs.length) { console.log('Invalid choice.\n'); continue; }

    const selected = dirs[num - 1];
    if (selected.done) {
      const donePath = path.join(selected.path, '_combined_CQ.done');
      const txtPath = path.join(selected.path, 'combined_CQ.txt');
      try { fs.renameSync(donePath, txtPath); console.log('   🔄 Reopened\n'); } catch (e) { console.log('   ⚠️ Could not reopen:', e.message); }
    }

    await processChapter(selected.path);

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
