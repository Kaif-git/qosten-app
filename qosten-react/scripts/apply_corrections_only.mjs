import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsFile = path.resolve(__dirname, '..', 'mcq_processed', 'all_review_results.txt');
const backupDir = path.resolve(__dirname, '..', 'mcq_processed', 'backups');
const API = 'https://questions-api.edventure.workers.dev';

fs.mkdirSync(backupDir, { recursive: true });

const text = fs.readFileSync(resultsFile, 'utf-8');
const lines = text.trim().split('\n');

const correctEntries = [];
for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  if (parts.length >= 2 && parts[1].startsWith('correct:')) {
    const label = parts[1].split(':')[1];
    if (label && /^[a-d]$/i.test(label)) {
      correctEntries.push({ id: parts[0], label: label.toLowerCase() });
    }
  }
}

console.log('Questions to correct:', correctEntries.length);

let success = 0;
let failed = 0;
let skipped = 0;

for (let i = 0; i < correctEntries.length; i++) {
  const { id, label } = correctEntries[i];
  const prefix = `[${i + 1}/${correctEntries.length}] ID ${id} -> ${label}`;

  try {
    // Fetch current question
    const res = await fetch(`${API}/questions/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        console.log(`${prefix} SKIP (not found)`);
        skipped++;
      } else {
        const err = await res.text();
        console.error(`${prefix} FAIL fetch: ${res.status} ${err}`);
        failed++;
      }
      continue;
    }
    const q = await res.json();

    // Backup
    fs.writeFileSync(path.join(backupDir, `${id}.json`), JSON.stringify(q, null, 2));

    // Update correct_answer only
    const updated = { ...q, correct_answer: label };
    const putRes = await fetch(`${API}/questions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error(`${prefix} FAIL update: ${putRes.status} ${err}`);
      failed++;
    } else {
      success++;
    }
  } catch (err) {
    console.error(`${prefix} ERROR: ${err.message}`);
    failed++;
  }

  if ((i + 1) % 200 === 0 || i === correctEntries.length - 1) {
    console.log(`[${i + 1}/${correctEntries.length}] ok=${success} skip=${skipped} fail=${failed}`);
  }
}

console.log('\n=== Done ===');
console.log('Updated:', success);
console.log('Skipped (404):', skipped);
console.log('Failed:', failed);
