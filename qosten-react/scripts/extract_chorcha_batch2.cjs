const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BATCH2_PATH = 'D:\\Study\\apps\\com.chorcha.ai\\2nd_Batch_MMKV_Dump.json';
const OUTPUT_FILE = 'D:\\Study\\apps\\com.chorcha.ai\\chorcha_batch2_clean.json';

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function normalize(q, subjectBucket) {
  const isMCQ = q.type === 'MCQ';
  const hasParts = !!(q.A || q.B || q.C || q.D || q.E);

  const tags = Array.isArray(q.tags) ? q.tags : (typeof q.tags === 'string' ? q.tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : []);
  const board = q.bucket_name || tags[0] || null;

  const base = {
    id: q._id,
    type: isMCQ ? 'mcq' : hasParts ? 'cq' : 'other',
    subject: subjectBucket ? subjectBucket.trim() : null,
    chapter: q.topic || null,
    tags: tags,
    board: board,
    language: 'bn',
    created_at: q.createdAt || null,
    updated_at: q.updatedAt || null,
  };

  if (isMCQ) {
    var options = [];
    var letters = ['A', 'B', 'C', 'D', 'E'];
    for (var li = 0; li < letters.length; li++) {
      var letter = letters[li];
      if (q[letter] != null && q[letter] !== '') {
        options.push({ label: letter.toLowerCase(), text: stripHtml(q[letter]) });
      }
    }
    return Object.assign({}, base, {
      question: stripHtml(q.question) || null,
      question_text: stripHtml(q.question) || null,
      options: options,
      correct_answer: q.answer ? q.answer.toLowerCase() : null,
      answer: null,
      parts: [],
      explanation: null,
    });
  }

  if (hasParts) {
    var parts = [];
    var letters2 = ['A', 'B', 'C', 'D', 'E'];
    for (var pi = 0; pi < letters2.length; pi++) {
      var l = letters2[pi];
      if (q[l] != null && q[l] !== '') {
        var answer = '';
        if (q.solution) {
          try {
            var sol = typeof q.solution === 'string' ? JSON.parse(q.solution) : q.solution;
            if (sol[l]) answer = stripHtml(sol[l]);
          } catch (e) {}
        }
        parts.push({ letter: l.toLowerCase(), text: stripHtml(q[l]), marks: 0, answer: answer });
      }
    }
    var answer = parts.length ? parts.map(function(p) { return p.letter + ') ' + p.answer; }).join('\n\n') : null;
    return Object.assign({}, base, {
      question: stripHtml(q.question) || null,
      question_text: stripHtml(q.question) || null,
      parts: parts,
      answer: answer,
      options: [],
      correct_answer: null,
      explanation: null,
    });
  }

  return Object.assign({}, base, {
    question: stripHtml(q.question) || null,
    question_text: stripHtml(q.question) || null,
    options: [],
    parts: [],
    answer: null,
    correct_answer: null,
    explanation: null,
  });
}

async function extractQuestions() {
  console.log('Extracting from 2nd_Batch_MMKV_Dump.json...');
  var fileSize = fs.statSync(BATCH2_PATH).size;

  var inStream = fs.createReadStream(BATCH2_PATH, { encoding: 'utf8', highWaterMark: 4 * 1024 * 1024 });
  var rl = readline.createInterface({ input: inStream, crlfDelay: Infinity });

  var seen = new Set();
  var allQuestions = [];
  var lineCount = 0;
  var inValue = false;
  var valueLines = [];
  var braceDepth = 0;
  var bracketDepth = 0;
  var inString = false;
  var escapeNext = false;
  var processedKeys = 0;
  var parseErrors = 0;
  var bytesRead = 0;

  inStream.on('data', function(chunk) { bytesRead += chunk.length; });

  for await (const line of rl) {
    lineCount++;

    if (!inValue) {
      var trimmed = line.trim();
      if (trimmed.startsWith('"offline.read.') && trimmed.indexOf('questions.persist.v1') > 0) {
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

    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
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
      var rawJson = valueLines.join('\n');
      var colonIdx = rawJson.indexOf(':');
      if (colonIdx < 0) continue;

      try {
        var val = rawJson.substring(colonIdx + 1).trim();
        if (val.charAt(val.length - 1) === ',') val = val.slice(0, -1).trim();
        var outerArr = JSON.parse(val);
        if (Array.isArray(outerArr) && outerArr.length > 0 && typeof outerArr[0] === 'string') {
          var innerData = JSON.parse(outerArr[0]);
          if (innerData.data && innerData.data.buckets) {
            for (var bi = 0; bi < innerData.data.buckets.length; bi++) {
              var bucket = innerData.data.buckets[bi];
              if (!bucket.questions) continue;
              for (var qi = 0; qi < bucket.questions.length; qi++) {
                var entry = bucket.questions[qi];
                var q = entry.q || entry;
                if (q && q._id && !seen.has(q._id)) {
                  seen.add(q._id);
                  var normalized = normalize(q, bucket.name);
                  if (normalized) allQuestions.push(normalized);
                }
              }
            }
          }
        }
      } catch (err) {
        parseErrors++;
        if (parseErrors <= 3) {
          var preview = rawJson.substring(colonIdx + 1, Math.min(colonIdx + 201, rawJson.length));
          console.error('\nParse error #' + parseErrors + ': ' + err.message.substring(0, 80));
          console.error('  Preview: ' + preview.substring(0, 120));
        }
      }

      if (processedKeys % 50 === 0) {
        var pct = (bytesRead / fileSize * 100).toFixed(1);
        process.stdout.write('\r  Progress: ' + pct + '% | Found: ' + allQuestions.length + ' questions | Keys: ' + processedKeys + ' | Errors: ' + parseErrors);
      }
    }
  }

  console.log('\n\nProcessed ' + lineCount + ' lines, ' + processedKeys + ' offline keys, ' + parseErrors + ' parse errors.');
  return allQuestions;
}

extractQuestions().then(function(questions) {
  console.log('Extracted ' + questions.length + ' unique questions');

  var tree = {};
  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var subj = q.subject || 'Uncategorized';
    var ch = q.chapter || 'General';
    if (!tree[subj]) tree[subj] = {};
    if (!tree[subj][ch]) tree[subj][ch] = { mcq: [], cq: [], other: [] };
    if (tree[subj][ch][q.type]) tree[subj][ch][q.type].push(q);
  }

  var output = { generatedAt: new Date().toISOString(), totalQuestions: questions.length, tree: tree };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log('Written to: ' + OUTPUT_FILE);

  console.log('\n=== Summary ===');
  var subjKeys = Object.keys(tree).sort();
  for (var si = 0; si < subjKeys.length; si++) {
    var subj = subjKeys[si];
    var chapters = tree[subj];
    var mcq = 0, cq = 0, other = 0;
    var chKeys = Object.keys(chapters);
    for (var ci = 0; ci < chKeys.length; ci++) {
      var info = chapters[chKeys[ci]];
      mcq += info.mcq ? info.mcq.length : 0;
      cq += info.cq ? info.cq.length : 0;
      other += info.other ? info.other.length : 0;
    }
    var total = mcq + cq + other;
    if (!total) continue;
    var parts = [];
    if (mcq) parts.push('mcq:' + mcq);
    if (cq) parts.push('cq:' + cq);
    if (other) parts.push('other:' + other);
    console.log('\n' + subj + ' (' + total + ') [' + parts.join(', ') + ']');
    for (var ci2 = 0; ci2 < chKeys.length; ci2++) {
      var info2 = chapters[chKeys[ci2]];
      var c = [];
      if (info2.mcq && info2.mcq.length) c.push('mcq:' + info2.mcq.length);
      if (info2.cq && info2.cq.length) c.push('cq:' + info2.cq.length);
      if (info2.other && info2.other.length) c.push('other:' + info2.other.length);
      console.log('  ' + chKeys[ci2].substring(0, 60) + ' [' + c.join(', ') + ']');
    }
  }
}).catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
