import fetch from 'node-fetch';

const API = 'https://questions-api.edventure.workers.dev';

async function fetchAllByChapter(subject, chapter, type) {
  const all = [];
  let page = 0;
  while (true) {
    const params = new URLSearchParams({ subject, chapter, type, page: String(page), limit: '500', brief: 'true' });
    const res = await fetch(`${API}/questions?${params}`);
    const data = await res.json();
    const batch = Array.isArray(data) ? data : [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 500) break;
    page++;
  }
  return all;
}

// Fixเฉพาะ chapters that need it
const fixes = [
  { chapter: 'সুভা', types: ['mcq'] },
  { chapter: 'সুভা', types: ['sq'] },
  { chapter: 'রানার', types: ['sq'] },
];

let sql = '';
for (const fix of fixes) {
  for (const type of fix.types) {
    const questions = await fetchAllByChapter('বাংলা প্রথম পত্র', fix.chapter, type);
    if (questions.length === 0) continue;

    const existingPremium = questions.filter(q => q.is_premium).length;
    console.log(`${fix.chapter} ${type}: ${questions.length} total, ${existingPremium} premium already`);

    const shuffled = questions.sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    const premiumIds = shuffled.slice(0, half).map(q => q.id);
    const freeIds = shuffled.slice(half).map(q => q.id);

    for (const id of premiumIds) {
      const q = questions.find(x => x.id === id);
      if (!q.is_premium) sql += `UPDATE questions SET is_premium = 1 WHERE id = ${id};\n`;
    }
    for (const id of freeIds) {
      const q = questions.find(x => x.id === id);
      if (q.is_premium) sql += `UPDATE questions SET is_premium = 0 WHERE id = ${id};\n`;
    }
  }
}

import fs from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

if (sql.trim()) {
  const lines = sql.trim().split('\n');
  console.log(`\n${lines.length} updates needed`);

  const BATCH_SIZE = 50;
  for (let i = 0; i < lines.length; i += BATCH_SIZE) {
    const batch = lines.slice(i, i + BATCH_SIZE).join('\n');
    const tmpFile = path.join(os.tmpdir(), `fix_premium_${i}.sql`);
    fs.writeFileSync(tmpFile, batch, 'utf8');
    console.log(`Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(lines.length/BATCH_SIZE)}...`);
    try {
      execSync(`npx wrangler d1 execute questions-db --remote --file="${tmpFile}" -y`,
        { cwd: 'E:\\cloudbase\\questions-api', encoding: 'utf8', timeout: 60000 });
    } catch (e) {
      console.error('  ❌', e.message.substring(0, 100));
    }
    try { fs.unlinkSync(tmpFile); } catch {}
  }
} else {
  console.log('No fixes needed');
}

console.log('\n✅ Done');
