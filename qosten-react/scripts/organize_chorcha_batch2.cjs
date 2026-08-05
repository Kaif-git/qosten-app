const fs = require('fs');
const path = require('path');

const INPUT = 'D:\\Study\\apps\\com.chorcha.ai\\chorcha_batch2_clean.json';
const OUTPUT = 'D:\\chorcha_sorted';

const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const tree = data.tree;

let total = 0;
for (const [subject, chapters] of Object.entries(tree)) {
  const subjDir = path.join(OUTPUT, sanitize(subject));
  fs.mkdirSync(subjDir, { recursive: true });

  for (const [chapter, types] of Object.entries(chapters)) {
    const chDir = path.join(subjDir, sanitize(chapter));
    fs.mkdirSync(chDir, { recursive: true });

    for (const type of ['mcq', 'cq', 'other']) {
      const list = types[type];
      if (!Array.isArray(list) || list.length === 0) continue;

      const outFile = path.join(chDir, type + '.json');
      const outData = [];
      for (const q of list) {
        outData.push({
          id: q.id,
          question: q.question,
          options: q.options || [],
          correct_answer: q.correct_answer || null,
          answer: q.answer || null,
          parts: q.parts || [],
          tags: q.tags || [],
          board: q.board || null,
          created_at: q.created_at,
          updated_at: q.updated_at,
        });
        total++;
      }
      fs.writeFileSync(outFile, JSON.stringify(outData, null, 2), 'utf8');
    }
  }
}

console.log('Done. ' + total + ' questions written to ' + OUTPUT);

function sanitize(name) {
  if (!name) return '_empty';
  return String(name).replace(/[<>:"\/\\|?*]/g, '_').trim().substring(0, 100) || '_empty';
}
