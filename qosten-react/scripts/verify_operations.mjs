import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsFile = path.resolve(__dirname, '..', 'mcq_processed', 'all_review_results.txt');
const API = 'https://questions-api.edventure.workers.dev';

const text = fs.readFileSync(resultsFile, 'utf-8');
const lines = text.trim().split('\n');

const deleteIds = [];
const updateIds = [];
for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  if (parts.length >= 2) {
    if (parts[1] === 'delete') deleteIds.push(parts[0]);
    else if (parts[1].startsWith('correct:')) updateIds.push({ id: parts[0], expected: parts[1].split(':')[1] });
  }
}

console.log('=== VERIFY DELETES ===');
let delOk = 0, delFail = 0;
// Check a sample of deletes (every 50th)
for (let i = 0; i < deleteIds.length; i += 50) {
  const id = deleteIds[i];
  const res = await fetch(`${API}/questions/${id}`);
  if (res.status === 404) { delOk++; }
  else if (res.ok) {
    const q = await res.json();
    console.log(`  DELETE FAIL - ID ${id} still exists (answer: ${q.correct_answer})`);
    delFail++;
  }
}
if (delFail === 0) console.log(`  Sampled ${delOk} deleted IDs - all confirmed gone (404)`);

console.log('\n=== VERIFY UPDATES (spot-check 20) ===');
let updOk = 0, updFail = 0;
const sample = [];
for (let i = 0; i < updateIds.length && sample.length < 20; i += Math.floor(updateIds.length / 20)) {
  sample.push(updateIds[i]);
}
for (const { id, expected } of sample) {
  const res = await fetch(`${API}/questions/${id}`);
  if (!res.ok) {
    console.log(`  FAIL - ID ${id} returned ${res.status} (expected correct: ${expected})`);
    updFail++;
    continue;
  }
  const q = await res.json();
  if (q.correct_answer === expected) {
    updOk++;
  } else {
    console.log(`  FAIL - ID ${id} has correct_answer="${q.correct_answer}", expected "${expected}"`);
    updFail++;
  }
}
if (updFail === 0) console.log(`  All ${updOk} sampled questions have correct correct_answer`);

console.log(`\n=== SUMMARY ===`);
console.log(`Deletes checked: ${delOk} confirmed gone, ${delFail} still exist`);
console.log(`Updates checked: ${updOk} correct, ${updFail} mismatch`);
