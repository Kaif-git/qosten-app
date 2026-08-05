import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline';

const MMKV_DIR = 'D:\\Study\\apps\\com.chorcha.ai';
const OUTPUT_FILE = path.join(MMKV_DIR, 'chorcha_questions_clean.json');

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function normalize(q, subjectBucket) {
  const isMCQ = q.type === 'MCQ';
  const isCQ = q.type?.startsWith('CQ') || (q.A && !isMCQ);
  const isWritten = q.type === 'WRITTEN' || q.type === 'SQ';

  // Parse tags
  const tags = Array.isArray(q.tags) ? q.tags : (typeof q.tags === 'string' ? q.tags.split(',').map(t => t.trim()).filter(Boolean) : []);
  const board = q.bucket_name || tags[0] || null;

  const base = {
    id: q._id,
    type: isMCQ ? 'mcq' : isCQ ? 'cq' : isWritten ? 'sq' : null,
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
    return {
      ...base,
      question: stripHtml(q.question) || null,
      question_text: stripHtml(q.question) || null,
      options,
      correct_answer: q.answer ? q.answer.toLowerCase() : null,
      answer: null,
      parts: [],
      explanation: null,
    };
  }

  if (isCQ || isWritten) {
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
        parts.push({
          letter: letter.toLowerCase(),
          text: stripHtml(q[letter]),
          marks: 0,
          answer,
        });
      }
    }
    const answer = parts.length ? parts.map(p => `${p.letter}) ${p.answer}`).join('\n\n') : null;
    return {
      ...base,
      question: stripHtml(q.question) || null,
      question_text: stripHtml(q.question) || null,
      parts,
      answer,
      options: [],
      correct_answer: null,
      explanation: null,
    };
  }

  return null;
}

function extractFromObject(mmkvObj) {
  const questions = [];
  for (const [key, val] of Object.entries(mmkvObj)) {
    if (!key.startsWith('offline.read.') || !key.endsWith('.questions.persist.v1')) continue;
    if (!Array.isArray(val) || !val[0]) continue;
    let data = typeof val[0] === 'string' ? JSON.parse(val[0]) : val[0];
    if (!data.data?.buckets) continue;
    for (const bucket of data.data.buckets) {
      if (!bucket.questions) continue;
      for (const entry of bucket.questions) {
        const q = entry.q || entry;
        if (q._id) {
          const normalized = normalize(q, bucket.name);
          if (normalized) questions.push(normalized);
        }
      }
    }
  }
  return questions;
}

async function extractBatch2Streaming(filePath) {
  console.log('  Processing 2nd_Batch_MMKV_Dump.json (580 MB, streaming)...');
  const questions = [];
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1024 * 1024 });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let buffer = '';
  let currentKey = '';
  let inKey = false;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;
  let collectingValue = false;
  let valueBuffer = '';
  let keyBuffer = '';

  for await (const line of rl) {
    if (!collectingValue) {
      // Look for a key line: "offline.read.XXX.questions.persist.v1": [
      const match = line.match(/"offline\.read\.[^"]+\.questions\.persist\.v1":\s*\[/);
      if (match) {
        collectingValue = true;
        valueBuffer = line.substring(match.index + match[0].length - 1); // start from '['
        braceDepth = 0;
        bracketDepth = 1;
        inString = false;
        escapeNext = false;
        continue;
      }
    } else {
      valueBuffer += '\n' + line;
      // Track JSON depth to know when the value ends
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
        collectingValue = false;
        try {
          const parsed = JSON.parse(valueBuffer);
          if (Array.isArray(parsed) && parsed[0]) {
            let data = typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0];
            if (data.data?.buckets) {
              for (const bucket of data.data.buckets) {
                if (!bucket.questions) continue;
                for (const entry of bucket.questions) {
                  const q = entry.q || entry;
                  if (q._id) {
                    const normalized = normalize(q, bucket.name);
                    if (normalized) questions.push(normalized);
                  }
                }
              }
            }
          }
        } catch (err) {
          // Skip malformed entries
        }
        valueBuffer = '';
      }
    }
  }

  return questions;
}

async function main() {
  console.log('Extracting questions from Chorcha MMKV dumps...\n');

  let allQuestions = [];
  const seen = new Set();

  // Batch 1: load entirely
  const batch1Path = path.join(MMKV_DIR, 'MMKV_Dump.json');
  if (fs.existsSync(batch1Path)) {
    console.log(`  Loading ${batch1Path}...`);
    const mmkv1 = JSON.parse(fs.readFileSync(batch1Path, 'utf8'));
    const q1 = extractFromObject(mmkv1);
    console.log(`  ✅ Batch 1: ${q1.length} questions`);
    for (const q of q1) {
      if (!seen.has(q.id)) { seen.add(q.id); allQuestions.push(q); }
    }
  }

  // Batch 2: stream
  const batch2Path = path.join(MMKV_DIR, '2nd_Batch_MMKV_Dump.json');
  if (fs.existsSync(batch2Path)) {
    const q2 = await extractBatch2Streaming(batch2Path);
    console.log(`  ✅ Batch 2: ${q2.length} questions`);
    for (const q of q2) {
      if (!seen.has(q.id)) { seen.add(q.id); allQuestions.push(q); }
    }
  }

  console.log(`\nTotal unique questions: ${allQuestions.length}`);

  // Organize by subject -> chapter -> type
  const tree = {};
  for (const q of allQuestions) {
    const subj = q.subject || 'Uncategorized';
    const ch = q.chapter || 'General';
    if (!tree[subj]) tree[subj] = {};
    if (!tree[subj][ch]) tree[subj][ch] = { mcq: [], cq: [], sq: [] };
    tree[subj][ch][q.type].push(q);
  }

  // Write full output
  const output = { generatedAt: new Date().toISOString(), totalQuestions: allQuestions.length, tree };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nWritten to: ${OUTPUT_FILE}`);

  // Print summary by subject
  console.log('\n=== Summary by Subject ===');
  for (const [subj, chapters] of Object.entries(tree).sort()) {
    let mcq = 0, cq = 0, sq = 0;
    for (const ch of Object.values(chapters)) {
      mcq += ch.mcq?.length || 0;
      cq += ch.cq?.length || 0;
      sq += ch.sq?.length || 0;
    }
    const total = mcq + cq + sq;
    if (total === 0) continue;
    const parts = [];
    if (mcq) parts.push(`mcq:${mcq}`);
    if (cq) parts.push(`cq:${cq}`);
    if (sq) parts.push(`sq:${sq}`);
    console.log(`\n${subj} (${total}) [${parts.join(', ')}]`);
    const chapterList = Object.keys(chapters).sort();
    for (const ch of chapterList) {
      const info = chapters[ch];
      const c = [];
      if (info.mcq?.length) c.push(`mcq:${info.mcq.length}`);
      if (info.cq?.length) c.push(`cq:${info.cq.length}`);
      if (info.sq?.length) c.push(`sq:${info.sq.length}`);
      console.log(`  ${ch.substring(0, 55)} [${c.join(', ')}]`);
    }
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
