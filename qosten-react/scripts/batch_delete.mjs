import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsFile = path.resolve(__dirname, '..', 'mcq_processed', 'all_review_results.txt');
const API = 'https://questions-api.edventure.workers.dev';

// Read all review results
const text = fs.readFileSync(resultsFile, 'utf-8');
const lines = text.trim().split('\n');

// Collect only "delete" commands
const deleteIds = [];
for (const line of lines) {
  const parts = line.trim().split(/\s+/);
  if (parts.length >= 2 && parts[1] === 'delete') {
    deleteIds.push(parts[0]);
  }
}

console.log('Total questions marked for deletion:', deleteIds.length);

let success = 0;
let alreadyDeleted = 0;
let failed = 0;

for (let i = 0; i < deleteIds.length; i++) {
  const id = deleteIds[i];
  try {
    const res = await fetch(`${API}/questions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      success++;
    } else if (res.status === 404) {
      alreadyDeleted++;
    } else {
      const err = await res.text();
      console.error(`[${i + 1}/${deleteIds.length}] FAIL ${id}: ${res.status} ${err}`);
      failed++;
    }
  } catch (err) {
    console.error(`[${i + 1}/${deleteIds.length}] ERROR ${id}: ${err.message}`);
    failed++;
  }

  if ((i + 1) % 100 === 0) {
    console.log(`[${i + 1}/${deleteIds.length}] ok=${success} gone=${alreadyDeleted} fail=${failed}`);
  }
}

console.log('\n=== Done ===');
console.log('Deleted:', success);
console.log('Already deleted (404):', alreadyDeleted);
console.log('Failed:', failed);
