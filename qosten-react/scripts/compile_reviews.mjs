import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, '..', 'mcq_processed');
const outPath = path.resolve(__dirname, '..', 'mcq_processed', 'all_review_results.txt');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.response.txt'));

let all = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(dir, f), 'utf-8');
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    let m = trimmed.match(/(\d{10,})\s+(correct:[a-d]|delete|logical\s+error)/i);
    if (m) {
      all.push(m[1] + ' ' + m[2].toLowerCase());
    }
  }
}

const seen = {};
for (const entry of all) {
  const id = entry.split(' ')[0];
  seen[id] = entry;
}

const result = Object.values(seen).sort((a, b) => a.localeCompare(b));
fs.writeFileSync(outPath, result.join('\n') + '\n');

let deletes = 0, corrects = 0, errors = 0;
for (const r of result) {
  const cmd = r.split(' ').slice(1).join(' ');
  if (cmd.startsWith('delete')) deletes++;
  else if (cmd.startsWith('correct')) corrects++;
  else if (cmd.startsWith('logical')) errors++;
}

console.log('Total unique commands:', result.length);
console.log('  correct:*  :', corrects);
console.log('  delete     :', deletes);
console.log('  logical error:', errors);
console.log('Wrote to:', outPath);
