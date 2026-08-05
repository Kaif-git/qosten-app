import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const BATCH2_PATH = 'D:\\Study\\apps\\com.chorcha.ai\\2nd_Batch_MMKV_Dump.json';
const OUTPUT_DIR = 'D:\\Study\\apps\\com.chorcha.ai';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'chorcha_batch2_clean.json');

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function normalize(q, subjectBucket) {
  const isMCQ = q.type === 'MCQ';
  const isCQ = q.type === 'CQ' || q.type === 'CQ_3' || q.type === 'CQ_4';
  const isWritten = q.type === 'WRITTEN' || q.type === 'SQ';

  const tags = Array.isArray(q.tags) ? q.tags : (typeof q.tags === 'string' ? q.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
  const board = q.bucket_name || tags[0] || null;

  const base = {
    id: q._id,
    type: isMCQ ? 'mcq' : (isCQ || (!isMCQ && !isWritten && q.A) ? 'cq' : isWritten ? 'sq' : 'other'),
    subject: subjectBucket ? subjectBucket.trim() : null,
    chapter: q.topic || null,
    tags,
    board,
    language: 'bn',
    created_at: q.createdAt || null,
    updated_at: q.updatedAt || null,
  };

  if (isMCQ) {
    const options = [];
    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      if (q[letter] != null && q[letter] !== '') {
        options.push({ label: letter.toLowerCase(), text: stripHtml(q[letter]) });
      }
    }
    return { ...base, question: stripHtml(q.question) || null, question_text: stripHtml(q.question) || null, options, correct_answer: q.answer ? q.answer.toLowerCase() : null, answer: null, parts: [], explanation: null };
  }

  if (isCQ || isWritten || q.A) {
    const parts = [];
    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      if (q[letter] != null && q[letter] !== '') {
        let answer = '';
        if (q.solution) {
          try {
            const sol = typeof q.solution === 'string' ? JSON.parse(q.solution) : q.solution;
            if (sol[letter]) answer = stripHtml(sol[letter]);
          } catch {}
        }
        parts.push({ letter: letter.toLowerCase(), text: stripHtml(q[letter]), marks: 0, answer });
      }
    }
    const answer = parts.length ? parts.map(p => `${p.letter}) ${p.answer}`).join('\n\n') : null;
    return { ...base, question: stripHtml(q.question) || null, question_text: stripHtml(q.question) || null, parts, answer, options: [], correct_answer: null, explanation: null };
  }

  return base;
}

async function extractQuestions() {
  console.log('Extracting questions from 2nd_Batch_MMKV_Dump.json (580 MB)...\n');
  const fileSize = fs.statSync(BATCH2_PATH).size;

  const inStream = fs.createReadStream(BATCH2_PATH, { encoding: 'utf8', highWaterMark: 4 * 1024 * 1024 });
  const rl = createInterface({ input: inStream, crlfDelay: Infinity });

  let lineCount = 0;
  let inValue = false;
  let valueLines = [];
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;
  let processedKeys = 0;

  for await (const line of rl) {
    lineCount++;

    if (!inValue) {
      const trimmed = line.trim();
      if (trimmed.startsWith('"offline.read.') && trimmed.includes('.questions.persist.v1")) {
        inValue = true;
        valueLines = [line];
        braceDepth = 0;
        bracketDepth = 1;
        inString = false;
        escapeNext = false;
      }
      continue;
    }

    valueLines.push(line);

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === '\\' && inString) { escapeNext = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
      if (ch === '[') bracketDepth++;
      if (ch === ']') bracketDepth--;
    }

    if (braceDepth === 0 && bracketDepth === 0) {
      inValue = false;
      processedKeys++;
      const rawJson = valueLines.join('\n');
      const match = rawJson.match(/:(\s*\[[\s\S]*)$/);
      if (!match) continue;

      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed[0]) {
          let data = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
          if (data.data?.buckets) {
            for (const bucket of data.data.buckets) {
              if (!bucket.questions) continue;
              for (const entry of bucket.questions) {
                const q = entry.q || entry;
                if (q._id && !seen.has(q._id)) {
                  seen.add(q._id);
                  const normalized = normalize(q, bucket.name);
                  if (normalized) allQuestions.push(normalized);
                }
              }
            }
          }
        }
      } catch (err) {
        // skip malformed
      }

      if (processedKeys % 50 === 0) {
        const pct = (inStream.bytesRead / fileSize * 100).toFixed(1);
        process.stdout.write(`  Progress: ${pct}% | Found: ${allQuestions.length} questions | Keys: ${processedKeys}\r`);
      }
    }
  }

  console.log(`\n\nDone. Processed ${lineCount} lines, ${processedKeys} offline keys.`);
  return allQuestions;
}

const seen = new Set();
let allQuestions = [];

extractQuestions().then(questions => {
  console.log(`Extracted ${questions.length} unique questions`);

  // Organize
  const tree = {};
  for (const q of questions) {
    const subj = q.subject || 'Uncategorized';
    const ch = q.chapter || 'General';
    if (!tree[subj]) tree[subj] = {};
    if (!tree[subj][ch]) tree[subj][ch] = { mcq: [], cq: [], sq: [], other: [] };
    tree[subj][ch][q.type].push(q);
  }

  const output = { generatedAt: new Date().toISOString(), totalQuestions: questions.length, tree };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Written to: ${OUTPUT_FILE}`);

  // Summary
  console.log('\n=== Summary by Subject ===');
  for (const [subj, chapters] of Object.entries(tree).sort()) {
    let mcq = 0, cq = 0, sq = 0;
    for (const ch of Object.values(chapters)) {
      mcq += ch.mcq?.length || 0;
      cq += ch.cq?.length || 0;
      sq += ch.sq?.length || 0;
    }
    const total = mcq + cq + sq;
    if (!total) continue;
    const parts = [];
    if (mcq) parts.push(`mcq:${mcq}`);
    if (cq) parts.push(`cq:${cq}`);
    if (sq) parts.push(`sq:${sq}`);
    console.log(`\n${subj} (${total}) [${parts.join(', ')}]`);
    for (const [ch, info] of Object.entries(chapters).sort()) {
      const c = [];
      if (info.mcq?.length) c.push(`mcq:${info.mcq.length}`);
      if (info.cq?.length) c.push(`cq:${info.cq.length}`);
      if (info.sq?.length) c.push(`sq:${info.sq.length}`);
      if (info.other?.length) c.push(`other:${info.other.length}`);
      console.log(`  ${ch.substring(0, 60)} [${c.join(', ')}]`);
    }
  }
}).catch(err => { console.error('Fatal:', err); process.exit(1); });
