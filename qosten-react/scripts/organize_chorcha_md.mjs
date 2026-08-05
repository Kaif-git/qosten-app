import fs from 'fs';
import path from 'path';

const SOURCE_DIR = 'D:\\Study\\apps\\com.chorcha.ai\\Recovered_2nd_Batch_By_Chapter';
const OUTPUT_FILE = path.resolve('D:\\Study\\apps\\com.chorcha.ai\\chorcha_organized.json');

function stripHtml(text) {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function parseHeader(line) {
  const info = { chapter: '', section: '', tags: [] };
  const parts = line.replace(/^>\s*/, '').split('|');
  for (const part of parts) {
    const [key, ...val] = part.split(':');
    const trimmedKey = key.trim();
    const trimmedVal = val.join(':').trim();
    if (trimmedKey === 'Chapter/Topic') info.chapter = trimmedVal;
    else if (trimmedKey === 'Section') info.section = trimmedVal;
    else if (trimmedKey === 'Tags') info.tags = trimmedVal.split(',').map(t => t.trim()).filter(Boolean);
  }
  return info;
}

function parseMcqStimulus(lines) {
  const text = lines.join('\n');
  let question = text;
  const options = [];
  let correct_answer = null;

  const correctMatch = text.match(/\*\*Correct Option:\s*([A-Ea-e])\*\*/);
  if (correctMatch) correct_answer = correctMatch[1].toLowerCase();

  const optionRegex = /Option\s+([A-Ea-e])\s*:\s*([^\n]*?)(?=\nOption\s+[A-Ea-e]\s*:|\n\*\*Correct Option|\n---|$)/g;
  let match;
  while ((match = optionRegex.exec(text)) !== null) {
    options.push({ label: match[1].toLowerCase(), text: match[2].trim() });
  }

  question = text
    .replace(/Option\s+[A-Ea-e]\s*:\s*[^\n]*/g, '')
    .replace(/\*\*Correct Option:\s*[A-Ea-e]\*\*/g, '')
    .replace(/###\s*Stimulus\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { question, options, correct_answer };
}

function parseCq(lines) {
  const text = lines.join('\n');
  const parts = [];

  // Extract parts A/B/C/D
  const partRegex = /\*\*Part\s+([A-Ea-e])\s*:?\*\*/g;
  let match;
  const partSegments = [];
  let lastLetter = '';
  let lastIndex = -1;

  while ((match = partRegex.exec(text)) !== null) {
    if (lastLetter) partSegments.push({ letter: lastLetter, start: lastIndex, end: match.index });
    lastLetter = match[1].toLowerCase();
    lastIndex = partRegex.lastIndex;
  }
  if (lastLetter) partSegments.push({ letter: lastLetter, start: lastIndex, end: text.length });

  for (const seg of partSegments) {
    const raw = text.substring(seg.start, seg.end).trim();
    const clean = raw.replace(/\*\*Part\s+[A-Ea-e]\s*:?\*\*/, '').trim();
    // Cut at next section boundary
    const boundary = clean.search(/\n(?=###|--)/);
    const partText = boundary > 0 ? clean.substring(0, boundary).trim() : clean;
    parts.push({ letter: seg.letter, text: partText, marks: 0, answer: '' });
  }

  // Stimulus is everything before first part
  const stimMatch = text.match(/^([\s\S]*?)(?=\*\*Part\s+[A-Ea-e]\s*:?\*\*)/);
  const stimulus = stimMatch ? stimMatch[1].trim() : text.trim();
  const question = stimulus.replace(/^###\s*Stimulus\s*/i, '').trim();

  return { question, parts };
}

function parseSolution(lines) {
  if (!lines || lines.length === 0) return {};
  const text = lines.join('\n');
  const solutions = {};
  const solRegex = /\*\*Sol\s+([A-Ea-e])\s*:?\*\*/g;
  let match;
  const segments = [];
  let lastLetter = '';
  let lastIndex = -1;

  while ((match = solRegex.exec(text)) !== null) {
    if (lastLetter) segments.push({ letter: lastLetter, start: lastIndex, end: match.index });
    lastLetter = match[1].toLowerCase();
    lastIndex = solRegex.lastIndex;
  }
  if (lastLetter) segments.push({ letter: lastLetter, start: lastIndex, end: text.length });

  for (const seg of segments) {
    const raw = text.substring(seg.start, seg.end).trim();
    const clean = raw.replace(/\*\*Sol\s+[A-Ea-e]\s*:?\*\*/, '').trim();
    solutions[seg.letter] = clean;
  }

  return solutions;
}

function normalizeSection(section) {
  if (!section) return '';
  let s = section.trim();

  // Map Bengali section prefixes to standard subject names
  const subjectMap = {
    'পদার্থবিজ্ঞান': 'Physics',
    'রসায়ন': 'Chemistry',
    'জীববিজ্ঞান': 'Biology',
    'গণিত': 'Math',
    'বাংলা': 'Bangla',
    'ইংরেজি': 'English',
    'তথ্য': 'ICT',
    'আইসিটি': 'ICT',
    'পৌরনীতি': 'Civics',
    'অর্থনীতি': 'Economics',
    'ভূগোল': 'Geography',
    'ইতিহাস': 'History',
    'সমাজ': 'Social Science',
    'ধর্ম': 'Religion',
    'হিন্দুধর্ম': 'Hindu Religion',
    'ইসলাম': 'Islamic Studies',
  };

  for (const [bn, en] of Object.entries(subjectMap)) {
    if (s.includes(bn)) return en;
  }

  // Extract Bengali section name if it has ":" delimiter
  if (s.includes(':')) {
    const parts = s.split(':');
    for (const p of parts) {
      const trimmed = p.trim();
      for (const [bn, en] of Object.entries(subjectMap)) {
        if (trimmed.includes(bn)) return en;
      }
    }
  }

  return s;
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error('Source directory not found:', SOURCE_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.md')).sort();
  console.log(`\nFound ${files.length} markdown files\n`);

  const allQuestions = [];
  let parsed = 0, errors = 0;

  for (const file of files) {
    const filePath = path.join(SOURCE_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    // Split by "## Question" boundary (more reliable than --- which appears in math)
    const blocks = content.split(/\n(?=## Question)/);

    for (const block of blocks) {
      const lines = block.split('\n');
      const headerMatch = block.match(/^##\s*Question\s+\d+\s*\(ID:\s*([^)]+)\)\s*\[([^\]]+)\]/m);
      if (!headerMatch) continue;

      parsed++;
      const id = headerMatch[1].trim();
      const rawType = headerMatch[2].trim().toLowerCase();
      const type = rawType === 'mcq' ? 'mcq' : rawType === 'cq' ? 'cq' : 'sq';

      // Parse header info
      let chapter = '', section = '', tags = [];
      const infoMatch = block.match(/^>\s*(.*?)$/m);
      if (infoMatch) {
        const info = parseHeader(infoMatch[1]);
        chapter = info.chapter;
        section = info.section;
        tags = info.tags;
      }

      const subject = normalizeSection(section) || file.replace(/\.md$/, '').replace(/_Batch_\d+/g, '').trim();

      let question = '', options = [], parts = [], correct_answer = null, answer = '';

      if (type === 'mcq') {
        const stimMatch = block.match(/###\s*Stimulus\s*\n([\s\S]*?)(?:\n###\s*Solution|\n---|$)/);
        if (stimMatch) {
          const lines = stimMatch[1].split('\n').filter(l => l.trim());
          const mcq = parseMcqStimulus(lines);
          question = mcq.question;
          options = mcq.options;
          correct_answer = mcq.correct_answer;
        }
        const solMatch = block.match(/###\s*Solution\s*\n([\s\S]*?)(?:\n---|$)/);
        if (solMatch) answer = solMatch[1].trim();
      } else {
        const stimMatch = block.match(/###\s*Stimulus\s*\n([\s\S]*?)(?:\n###\s*Solution|\n---|$)/);
        if (stimMatch) {
          const lines = stimMatch[1].split('\n').filter(l => l.trim());
          const cq = parseCq(lines);
          question = cq.question;
          parts = cq.parts;
        }
        const solMatch = block.match(/###\s*Solution\s*\n([\s\S]*?)(?:\n---|$)/);
        if (solMatch) {
          const solLines = solMatch[1].split('\n').filter(l => l.trim());
          const solutions = parseSolution(solLines);
          for (const part of parts) {
            if (solutions[part.letter]) part.answer = solutions[part.letter];
          }
        }
        if (parts.length > 0) {
          answer = parts.map(p => `${p.letter}) ${p.answer}`).join('\n\n');
        }
      }

      allQuestions.push({
        id,
        type,
        subject,
        section,
        chapter,
        tags,
        question,
        options,
        correct_answer,
        parts,
        answer,
      });
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = allQuestions.filter(q => {
    if (seen.has(q.id)) return false;
    seen.add(q.id);
    return true;
  });

  console.log(`Parsed ${parsed} questions, ${unique.length} unique`);

  // Organize by subject -> chapter -> type
  const tree = {};
  for (const q of unique) {
    const subj = q.subject || 'Uncategorized';
    const ch = q.chapter || 'General';

    if (!tree[subj]) tree[subj] = {};
    if (!tree[subj][ch]) tree[subj][ch] = { mcq: [], cq: [], sq: [] };

    const entry = {
      id: q.id,
      type: q.type,
      question: q.question,
    };
    if (q.options.length) entry.options = q.options;
    if (q.correct_answer) entry.correct_answer = q.correct_answer;
    if (q.parts.length) entry.parts = q.parts.map(p => ({ letter: p.letter, text: p.text }));
    if (q.answer) entry.answer = q.answer;
    if (q.tags.length) entry.tags = q.tags;

    tree[subj][ch][q.type].push(entry);
  }

  // Full output with all question data
  const output = {
    generatedAt: new Date().toISOString(),
    totalQuestions: unique.length,
    tree,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Written to: ${OUTPUT_FILE}`);

  // Print summary
  console.log('\n=== Subject Summary ===');
  for (const [subj, chapters] of Object.entries(tree).sort()) {
    let mcq = 0, cq = 0, sq = 0;
    for (const ch of Object.values(chapters)) {
      mcq += ch.mcq.length;
      cq += ch.cq.length;
      sq += ch.sq.length;
    }
    const total = mcq + cq + sq;
    if (total === 0) continue;
    const parts = [];
    if (mcq) parts.push(`mcq:${mcq}`);
    if (cq) parts.push(`cq:${cq}`);
    if (sq) parts.push(`sq:${sq}`);
    console.log(`\n${subj} (${total}) [${parts.join(', ')}]`);
    for (const [ch, info] of Object.entries(chapters).sort()) {
      const c = [];
      if (info.mcq.length) c.push(`mcq:${info.mcq.length}`);
      if (info.cq.length) c.push(`cq:${info.cq.length}`);
      if (info.sq.length) c.push(`sq:${info.sq.length}`);
      console.log(`  ${ch.substring(0, 55)} [${c.join(', ')}]`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
