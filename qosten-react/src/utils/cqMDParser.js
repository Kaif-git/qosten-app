const IMG_REGEX = /<div\s+style='text-align:\s*center;'>\s*<img\s+src='([^']+)'[^>]*\/>\s*<\/div>|<img\s+src='([^']+)'[^>]*\/?>/gi;

function extractImgs(text) {
  const urls = [];
  let match;
  const re = new RegExp(IMG_REGEX.source, 'gi');
  while ((match = re.exec(text)) !== null) urls.push(match[1] || match[2]);
  return urls;
}

function stripImgs(text) {
  return text.replace(IMG_REGEX, '').trim();
}

function extractMarks(pt) {
  const m = pt.match(/[([{]\s*(\d+)\s*[\])}]\s*$/);
  if (m) return { marks: parseInt(m[1]), text: pt.slice(0, -m[0].length).trim() };
  const s = pt.match(/\s+(\d+)\s*$/);
  if (s) return { marks: parseInt(s[1]), text: pt.slice(0, -s[0].length).trim() };
  return { marks: 0, text: pt.trim() };
}

const PART_RE = /^([a-d])[.)\s]\s*(.+)/i;

/**
 * Parse a CQ markdown block into structured parts (text + marks).
 * Scans lines for a. b. c. d. patterns.
 */
function extractParts(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const parts = [];
  for (const line of lines) {
    const m = line.match(PART_RE);
    if (m) {
      const letter = m[1].toLowerCase();
      const { marks, text: txt } = extractMarks(m[2].trim());
      parts.push({ letter, text: txt, marks, answer: '', answerImage: null, image: null });
    }
  }
  return parts;
}

const PART_SPLIT = /^([b-d])[.\s)]/i;

/**
 * Parse answer text, splitting by part markers and extracting images per part.
 */
function parseAnswers(answerText, parts) {
  const lines = answerText.split('\n');
  const ans = { a: '', b: '', c: '', d: '' };
  const ansImgs = { a: [], b: [], c: [], d: [] };
  let cur = 'a';

  for (const line of lines) {
    const t = line.trim();
    if (!t) { if (ans[cur]) ans[cur] += '\n'; continue; }
    const imgs = extractImgs(t);
    const clean = stripImgs(t);

    // Detect part marker (b, c, d) at line start
    const pm = t.match(PART_SPLIT);
    if (pm && t.replace(/^[b-d][.\s)]*\s*/i, '').trim().length < 60) {
      cur = pm[1].toLowerCase();
      const after = t.replace(/^[b-d][.\s)]*\s*/i, '').trim();
      const afterClean = stripImgs(after);
      if (afterClean) ans[cur] = afterClean;
    } else {
      if (clean) ans[cur] = ans[cur] ? ans[cur] + '\n' + clean : clean;
    }
    if (imgs.length > 0) ansImgs[cur].push(...imgs);
  }

  const assigned = new Set();
  return parts.map((p, idx) => {
    const letter = p.letter.toLowerCase();
    let partImg = ansImgs[letter]?.[0] || null;
    if (partImg) assigned.add(partImg);
    // Fallback: assign unassigned images by order
    if (!partImg) {
      const allImgs = extractImgs(answerText);
      const unassigned = allImgs.filter(i => !assigned.has(i));
      if (idx < unassigned.length) {
        partImg = unassigned[idx];
        assigned.add(partImg);
      }
    }
    return {
      ...p,
      answer: ans[letter] ? ans[letter].trim() : '',
      answerImage: partImg,
      image: partImg
    };
  });
}

export function parseCQFromMD(mdText, language = 'en') {
  const text = mdText.replace(/\r\n/g, '\n');

  // Find all Ques and Answer markers with their positions
  const MARKER = /^(?:##\s*)?(?:Ques\.?\s*[►>]?\s*|Answer to the question(?: no)?\.?\s*[►>]?\s*)(\d+)/gim;
  const markers = [];
  let m;
  while ((m = MARKER.exec(text)) !== null) {
    markers.push({
      index: m.index,
      num: parseInt(m[1]),
      isQues: /(?:^|\s)Ques/i.test(m[0]),
      match: m[0]
    });
  }

  if (markers.length === 0) return [];

  // Build content sections: from each marker to the next
  const sections = [];
  for (let i = 0; i < markers.length; i++) {
    const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
    sections.push({
      num: markers[i].num,
      isQues: markers[i].isQues,
      raw: text.substring(markers[i].index + markers[i].match.length, end)
    });
  }

  // Map question numbers to their sections
  // A question can have a Ques section, an Answer section, both, or only an Answer section
  const qSections = {};

  for (const sec of sections) {
    if (!qSections[sec.num]) qSections[sec.num] = { quesRaw: '', ansRaw: '' };
    if (sec.isQues) {
      qSections[sec.num].quesRaw = sec.raw;
    } else {
      qSections[sec.num].ansRaw = sec.raw;
    }
  }

  // For questions that only have an Answer section (no Ques section),
  // look in the PREVIOUS section for their question text + parts
  const sortedNums = Object.keys(qSections).map(Number).sort((a, b) => a - b);
  const questions = [];
  const LEGACY = { c: 'answerimage1', d: 'answerimage2', a: 'answerimage3', b: 'answerimage4' };

  for (const qNum of sortedNums) {
    const entry = qSections[qNum];
    let quesRaw = entry.quesRaw;
    const ansRaw = entry.ansRaw;

    // If no Ques section, try to extract parts from the previous section's leftover
    if (!quesRaw && ansRaw) {
      // The parts for this question are in the raw text between the previous
      // section and this answer section. We already have them in ansRaw prefix
      // (since the raw content for Q4's answer starts after Q3's answer header
      // and includes Q4's part text before Q4's answer content)
      // Actually, ansRaw for Q4 IS the answer, and the parts are in the section
      // right before it (Q3's answer section contains Q4's parts).

      // Find the previous sections's raw text
      const prevNum = sortedNums[sortedNums.indexOf(qNum) - 1];
      if (prevNum !== undefined && qSections[prevNum]) {
        const prevEntry = qSections[prevNum];
        // Try to extract parts from the previous answer section
        // (since that's where orphan parts hide)
        const partsFromPrevAns = extractParts(prevEntry.ansRaw || '');
        if (partsFromPrevAns.length > 0) {
          const stemImgs = extractImgs(prevEntry.ansRaw || '');
          const stemText = stripImgs(prevEntry.ansRaw || '');
          const boardM = stemText.match(/^([A-Za-z\s-]+?\d{4})/m);
          const board = boardM ? boardM[1].trim() : undefined;

          questions.push({
            type: 'cq',
            language,
            questionText: stemText,
            image: stemImgs[0] || null,
            stem: stemText,
            board,
            parts: parseAnswers(ansRaw || '', partsFromPrevAns),
            answerimage1: null,
            answerimage2: null,
            answerimage3: null,
            answerimage4: null
          });
          continue;
        }
      }
    }

    // Normal path: has Ques section
    const stemImgs = extractImgs(quesRaw || '');
    const stemText = stripImgs(quesRaw || '');
    const boardM = stemText.match(/^([A-Za-z\s-]+?\d{4})/m);
    const board = boardM ? boardM[1].trim() : undefined;
    const parts = extractParts(quesRaw || '');

    if (parts.length === 0) {
      // Try extracting parts from the answer section (for cases like Q14 where 
      // parts are at end of stem area mixed with answer)
      const partsFromAns = extractParts(ansRaw || '');
      if (partsFromAns.length > 0) {
        const q = {
          type: 'cq',
          language,
          questionText: stemText,
          image: stemImgs[0] || null,
          stem: stemText,
          board,
          parts: parseAnswers(ansRaw || '', partsFromAns),
          answerimage1: null,
          answerimage2: null,
          answerimage3: null,
          answerimage4: null
        };
        for (const p of q.parts) {
          const col = LEGACY[p.letter.toLowerCase()];
          if (col && p.answerImage) q[col] = p.answerImage;
        }
        questions.push(q);
      }
      continue;
    }

    const q = {
      type: 'cq',
      language,
      questionText: stemText,
      image: stemImgs[0] || null,
      stem: stemText,
      board,
      parts: parseAnswers(ansRaw || '', parts),
      answerimage1: null,
      answerimage2: null,
      answerimage3: null,
      answerimage4: null
    };

    for (const p of q.parts) {
      const col = LEGACY[p.letter.toLowerCase()];
      if (col && p.answerImage) q[col] = p.answerImage;
    }

    questions.push(q);
  }

  return questions;
}
