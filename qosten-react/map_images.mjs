import fs from 'fs';

const md = fs.readFileSync('New Format/Physics ch11 cq-2026-05-18_06-22-28.md', 'utf8');

const IMG = /<img\s+src='([^']+)'/gi;

// Find section headers: Ques or Answer
const HEADER = /^(?:##\s*)?(Ques\.?\s*[►>]?\s*\d+|Answer to the question[\s\S]*?\d+)/gim;

const sections = [];
let m;
while ((m = HEADER.exec(md)) !== null) {
  const raw = m[1];
  const isQues = /^Ques/i.test(raw);
  const num = parseInt(raw.match(/\d+/)[0], 10);
  sections.push({ index: m.index, num, isQues, raw });
}

// Walk each section and collect images belonging to it
const imgs = [];

for (let i = 0; i < sections.length; i++) {
  const cur = sections[i];
  const nextIdx = i + 1 < sections.length ? sections[i + 1].index : md.length;
  // Content starts after the marker itself
  const contentStart = cur.index + md.slice(cur.index).indexOf('\n') + 1;
  const segment = md.substring(contentStart, nextIdx);

  // For answer sections, further subdivide by part markers
  let partId = cur.isQues ? 'stem' : 'ans';

  const lines = segment.split('\n');
  for (const line of lines) {
    const partM = line.trim().match(/^([a-d])[.\s)]/i);
    if (partM && !cur.isQues) {
      partId = `ans-${partM[1].toLowerCase()}`;
    }

    const imgM = line.match(/<img\s+src='([^']+)'/i);
    if (imgM) {
      imgs.push({
        location: `Q${cur.num} ${partId}`,
        url: imgM[1].length > 80 ? imgM[1].substring(0, 80) + '...' : imgM[1]
      });
    }
  }
}

// Print grouped
let lastQ = '';
for (const r of imgs) {
  const qTag = r.location.split(' ')[0];
  if (qTag !== lastQ) { lastQ = qTag; console.log(''); }
  console.log(`  ${r.location}: ${r.url}`);
}
