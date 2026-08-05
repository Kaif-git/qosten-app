import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = 'https://questions-api.edventure.workers.dev';
const BATCH_SIZE = 100;

let idCounter = 0;
function generateId() {
  return `${Date.now()}_${++idCounter}`;
}

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function makeOptions(...optionFields) {
  const labels = ['a', 'b', 'c', 'd', 'e'];
  return optionFields
    .filter((v, i) => v != null && v !== '')
    .map((text, i) => ({ label: labels[i], text: String(text) }));
}

function defineBase(q) {
  const now = new Date().toISOString();
  return {
    type: null,
    language: 'bn',
    is_quizzable: 1,
    tags: [],
    options: [],
    parts: [],
    image: null,
    answer: null,
    second_answer: null,
    answerimage1: null,
    answerimage2: null,
    answerimage3: null,
    answerimage4: null,
    explanation: null,
    synced: 0,
    is_flagged: 0,
    is_premium: 0,
    flagged: 0,
    is_verified: 0,
    in_review_queue: 0,
    version: null,
    counterpart: null,
    board: null,
    lesson: null,
    question_text: null,
    correct_answer: null,
    created_at: now,
    updated_at: now,
    ...q,
    id: q.id || generateId(),
  };
}

// ─── Converters ───────────────────────────────────────────────────────────────

const converters = {

  // prostuti MCQ + HSC MCQ: option_a/b/c/d, correct_option, question_text, explanation, subject, chapter, (session|board|year)
  mcq_options(raw) {
    const options = makeOptions(raw.option_a, raw.option_b, raw.option_c, raw.option_d, raw.option_e);
    return defineBase({
      id: raw.id,
      type: 'mcq',
      question: raw.question_text,
      question_text: raw.question_text,
      options,
      correct_answer: raw.correct_option || null,
      explanation: raw.explanation || null,
      subject: raw.subject || null,
      chapter: raw.chapter || null,
      board: raw.board || raw.session || raw.year || raw.sessionId || null,
      created_at: raw.createdAt || null,
      updated_at: raw.updatedAt || null,
      image: raw.question_image || null,
    });
  },

  // prostuti written: question_text, answer_text, subjectName, session
  written(raw) {
    return defineBase({
      id: raw.id,
      type: 'sq',
      question: raw.question_text,
      question_text: raw.question_text,
      answer: raw.answer_text || null,
      subject: raw.subjectName || null,
      board: raw.session || null,
      created_at: raw.createdAt || null,
    });
  },

  // HSC CQ: stimulus, q_a/ans_a, q_b/ans_b, q_c/ans_c, subject, chapter, board, paper, year
  hsc_cq(raw) {
    const parts = [];
    for (const letter of ['a', 'b', 'c']) {
      const qKey = `q_${letter}`;
      const ansKey = `ans_${letter}`;
      if (raw[qKey]) {
        parts.push({ letter, text: raw[qKey], marks: 0, answer: raw[ansKey] || '' });
      }
    }
    const question = raw.stimulus || '';
    const answer = parts.map(p => `${p.letter}) ${p.answer}`).join('\n\n');
    return defineBase({
      id: raw.id,
      type: 'cq',
      question,
      question_text: question,
      parts,
      answer: answer || null,
      subject: raw.subject || null,
      chapter: raw.chapter || null,
      board: raw.board || raw.year || null,
      lesson: raw.paper || null,
    });
  },

  // Chorcha CQ/MCQ/WRITTEN from MMKV dump
  chorcha(raw) {
    const isCQ = raw.type?.startsWith('CQ') || raw.A;
    const isMCQ = raw.type === 'MCQ';
    const isWritten = raw.type === 'WRITTEN';

    const parts = [];
    if (isCQ || isWritten) {
      for (const letter of ['A', 'B', 'C', 'D', 'E']) {
        if (raw[letter]) {
          const text = stripHtml(raw[letter]);
          let answer = '';
          if (raw.solution) {
            try {
              const sol = typeof raw.solution === 'string' ? JSON.parse(raw.solution) : raw.solution;
              answer = stripHtml(sol[letter] || '');
            } catch {}
          }
          parts.push({ letter: letter.toLowerCase(), text, marks: 0, answer });
        }
      }
    }

    let question = stripHtml(raw.question);
    const answer = parts.length ? parts.map(p => `${p.letter}) ${p.answer}`).join('\n\n') : null;

    let options = [];
    let correct_answer = null;
    if (isMCQ && raw.options) {
      options = raw.options.map((text, i) => ({ label: String.fromCharCode(97 + i), text }));
      correct_answer = raw.answer ? String(raw.answer).toLowerCase() : null;
    }

    const tags = Array.isArray(raw.tags) ? raw.tags : (typeof raw.tags === 'string' ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    const board = raw.bucket_name || tags[0] || null;

    return defineBase({
      id: raw._id,
      type: isCQ ? 'cq' : isMCQ ? 'mcq' : isWritten ? 'sq' : null,
      question: question || null,
      question_text: question || null,
      subject: raw._subjectBucket ? raw._subjectBucket.trim() : null,
      chapter: raw.topic || null,
      tags,
      board,
      parts: parts.length ? parts : [],
      options,
      correct_answer,
      answer,
      explanation: null,
      created_at: raw.createdAt || null,
      updated_at: raw.updatedAt || null,
    });
  },

  // already standard format (e.g. question-bank-full)
  standard(raw) {
    const q = { ...raw };
    delete q._state;
    delete q.questionNumber;
    if (q.correctAnswer !== undefined) {
      q.correct_answer = q.correctAnswer;
      delete q.correctAnswer;
    }
    if (!q.question && q.questionText) q.question = q.questionText;
    if (!q.question_text && q.question) q.question_text = q.question;
    if (typeof q.options === 'string') { try { q.options = JSON.parse(q.options); } catch { q.options = []; } }
    if (!Array.isArray(q.options)) q.options = [];
    if (typeof q.parts === 'string') { try { q.parts = JSON.parse(q.parts); } catch { q.parts = []; } }
    if (!Array.isArray(q.parts)) q.parts = [];
    if (!q.answer && q.parts.length > 0) {
      q.answer = q.parts.map(p => `${p.letter || ''}) ${p.answer || ''}`).join('\n\n');
    }
    return defineBase(q);
  },
};

// ─── File definitions ─────────────────────────────────────────────────────────

const SOURCE_DIR = 'C:\\Users\\Warp\\Downloads';

const FILE_DEFS = [
  { file: 'prostutidb_eng_questions.json',       converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'prostutidb_eng_mqb_questions.json',   converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'prostutidb_med_questions.json',        converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'prostutidb_med_onu_questions.json',    converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'prostutidb_var_questions.json',        converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'prostutidb_var_mqb_questions.json',    converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'prostutidb_eng_written_questions.json', converter: 'written',    source: SOURCE_DIR },
  { file: 'prostutidb_var_written_questions.json', converter: 'written',    source: SOURCE_DIR },
  { file: 'hsc_mcqs_dump.json',                   converter: 'mcq_options', source: SOURCE_DIR },
  { file: 'hsc_cqs_dump.json',                    converter: 'hsc_cq',      source: SOURCE_DIR },
  { file: 'hsc_college_cqs_dump.json',            converter: 'hsc_cq',      source: SOURCE_DIR },
];

const MMKV_FILES = [
  { file: 'MMKV_Dump.json', converter: 'chorcha', source: 'D:\\Study\\apps\\com.chorcha.ai', format: 'mmkv' },
];

const CHORCHA_CLEAN_FILES = [
  { file: 'chorcha_batch2_clean.json', converter: 'standard', source: 'D:\\Study\\apps\\com.chorcha.ai', format: 'chorcha_tree' },
];

// ─── Load MMKV dump (Chorcha format) ──────────────────────────────────────────

function loadMmkvFile(filePath, converterName) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const converter = converters[converterName];
  if (!converter) throw new Error(`Unknown converter: ${converterName}`);

  const questions = [];
  for (const [key, val] of Object.entries(raw)) {
    if (!key.startsWith('offline.read.') || !key.endsWith('.questions.persist.v1')) continue;
    if (!Array.isArray(val) || !val[0]) continue;
    let data = typeof val[0] === 'string' ? JSON.parse(val[0]) : val[0];
    if (!data.data?.buckets) continue;
    for (const bucket of data.data.buckets) {
      if (!bucket.questions) continue;
      for (const entry of bucket.questions) {
        const q = entry.q || entry;
        if (q._id) {
          questions.push(converter({ ...q, _subjectBucket: bucket.name }));
        }
      }
    }
  }
  return questions;
}

// ─── Load Chorcha clean tree format ────────────────────────────────────────────

function loadChorchaTreeFile(filePath, converterName) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const converter = converters[converterName];
  if (!converter) throw new Error(`Unknown converter: ${converterName}`);

  const questions = [];
  const tree = raw.tree;
  if (!tree) throw new Error('Missing tree in chorcha clean file');

  for (const [subject, chapters] of Object.entries(tree)) {
    for (const [chapter, types] of Object.entries(chapters)) {
      for (const type of ['mcq', 'cq', 'other']) {
        const list = types[type];
        if (!Array.isArray(list)) continue;
        for (const q of list) {
          questions.push(converter(q));
        }
      }
    }
  }
  return questions;
}

// ─── Load & convert ────────────────────────────────────────────────────────────

function loadFile(filePath, converterName) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const converter = converters[converterName];
  if (!converter) throw new Error(`Unknown converter: ${converterName}`);

  // question-progress format: { version, timestamp, questions: [...] }
  if (raw.questions && Array.isArray(raw.questions)) {
    return raw.questions.map(q => converter(q));
  }
  // standard array
  if (Array.isArray(raw)) {
    return raw.map(q => converter(q));
  }

  console.warn(`  ⚠️  Unknown structure in ${path.basename(filePath)}, trying top-level keys as array`);
  return [];
}

// ─── Upload ───────────────────────────────────────────────────────────────────

async function uploadBatch(batch, batchIndex, totalBatches) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/questions/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`  ⚠️  Batch ${batchIndex + 1}/${totalBatches} failed (attempt ${attempt}), retrying in ${Math.round(delay)}ms...`);
        console.warn(`  Error: ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📂 Checking source files...\n');

  const fileStats = [];
  let allQuestions = [];

  function processFileDef(def) {
    const filePath = path.join(def.source, def.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠️  NOT FOUND: ${def.file}`);
      fileStats.push({ file: def.file, count: 0, sizeMB: '0.0', status: 'not found' });
      return;
    }
    const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);
    try {
      let questions;
      if (def.format === 'mmkv') {
        questions = loadMmkvFile(filePath, def.converter);
      } else if (def.format === 'chorcha_tree') {
        questions = loadChorchaTreeFile(filePath, def.converter);
      } else {
        questions = loadFile(filePath, def.converter);
      }
      allQuestions.push(...questions);
      fileStats.push({ file: def.file, count: questions.length, sizeMB, status: 'ok' });
      console.log(`  ✅ ${def.file.padEnd(45)} ${String(questions.length).padStart(6)} questions (${sizeMB} MB)`);
    } catch (err) {
      fileStats.push({ file: def.file, count: 0, sizeMB, status: 'error' });
      console.error(`  ❌ ${def.file.padEnd(45)} ERROR: ${err.message}`);
    }
  }

  for (const def of FILE_DEFS) processFileDef(def);
  for (const def of MMKV_FILES) processFileDef(def);
  for (const def of CHORCHA_CLEAN_FILES) processFileDef(def);

  const totalLoaded = allQuestions.length;
  if (totalLoaded === 0) {
    console.log('\n❌ No questions loaded. Exiting.');
    process.exit(1);
  }

  // Deduplicate by ID
  const seen = new Set();
  const unique = [];
  for (const q of allQuestions) {
    if (!seen.has(q.id)) { seen.add(q.id); unique.push(q); }
  }
  const dupeCount = totalLoaded - unique.length;
  if (dupeCount > 0) console.log(`\n🧹 Removed ${dupeCount} duplicate questions (by ID)`);

  allQuestions = unique;
  const total = allQuestions.length;
  const batches = Math.ceil(total / BATCH_SIZE);

  console.log(`\n📊 ${total} unique questions ready for upload (${batches} batches of ${BATCH_SIZE})\n`);

  // ── Confirm ──
  console.log('Files to process:');
  for (const s of fileStats) {
    const icon = s.status === 'ok' ? '✅' : s.status === 'not found' ? '⚠️' : '❌';
    console.log(`  ${icon} ${s.file.padEnd(45)} ${String(s.count).padStart(6)} qs (${s.sizeMB} MB)`);
  }
  console.log(`\n🚀 Run migration? This will upload ${total} questions to ${API_BASE}`);
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  await new Promise(r => setTimeout(r, 5000));

  // ── Upload ──
  console.log(`\n🚀 Uploading ${total} questions...\n`);
  let successCount = 0;
  let failCount = 0;
  const failIds = [];

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = allQuestions.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE);
    const progress = `${String(batchIndex + 1).padStart(String(batches).length)}/${batches}`;

    try {
      await uploadBatch(batch, batchIndex, batches);
      successCount += batch.length;
      process.stdout.write(`  ✅ Batch ${progress} — ${batch.length} questions uploaded\r`);
    } catch (err) {
      failCount += batch.length;
      failIds.push(...batch.map(q => q.id));
      process.stdout.write(`  ❌ Batch ${progress} — FAILED: ${err.message.substring(0, 80)}\n`);
    }

    if (i + BATCH_SIZE < total) await new Promise(r => setTimeout(r, 200));
  }

  // ── Summary ──
  console.log(`\n\n📋 Migration Complete`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed:  ${failCount}`);

  const summary = {
    timestamp: new Date().toISOString(),
    files: fileStats,
    totalLoaded,
    duplicatesRemoved: dupeCount,
    totalUploaded: successCount,
    failedCount,
  };
  const summaryFile = path.resolve(__dirname, '..', 'migration_summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`   📊 Summary: ${summaryFile}`);

  if (failIds.length > 0) {
    const failFile = path.resolve(__dirname, '..', 'migration_failed_ids.json');
    fs.writeFileSync(failFile, JSON.stringify(failIds, null, 2));
    console.log(`   📝 Failed IDs: ${failFile}`);
  }
}

main().catch(err => {
  console.error('\n❌ Script failed:', err);
  process.exit(1);
});
