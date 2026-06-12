import fetch from 'node-fetch';
import fs from 'fs';

const API = 'https://questions-api.edventure.workers.dev';
const SUBJECT = 'বাংলা প্রথম পত্র';
const TYPES = ['mcq', 'cq', 'sq'];

async function fetchAllByChapter(subject, chapter, type) {
  const all = [];
  let page = 0;
  const PAGE_SIZE = 500;
  while (true) {
    const params = new URLSearchParams({ subject, chapter, type, page: String(page), limit: String(PAGE_SIZE), brief: 'true' });
    const res = await fetch(`${API}/questions?${params}`);
    const data = await res.json();
    const batch = Array.isArray(data) ? data : [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    page++;
  }
  return all;
}

async function main() {
  console.log('Fetching hierarchy...');
  const hierRes = await fetch(`${API}/hierarchy`);
  const hierarchy = await hierRes.json();
  const subjectData = hierarchy.find(s => s.name === SUBJECT);
  if (!subjectData) { console.log('Subject not found'); return; }

  const chapters = subjectData.chapters.map(c => c.name);
  console.log(`Found ${chapters.length} chapters\n`);

  let allUpdates = [];

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    console.log(`[${ci+1}/${chapters.length}] ${chapter}`);

    for (const type of TYPES) {
      const questions = await fetchAllByChapter(SUBJECT, chapter, type);
      if (questions.length === 0) { console.log(`  ${type}: 0 questions, skip`); continue; }

      const shuffled = questions.sort(() => Math.random() - 0.5);
      const half = Math.ceil(shuffled.length / 2);
      const premiumIds = shuffled.slice(0, half).map(q => q.id);
      const freeIds = shuffled.slice(half).map(q => q.id);

      const alreadyPremium = questions.filter(q => q.is_premium).length;
      const changes = [];

      for (const id of premiumIds) {
        const q = questions.find(x => x.id === id);
        if (!q.is_premium) changes.push({ id, set: 1 });
      }
      for (const id of freeIds) {
        const q = questions.find(x => x.id === id);
        if (q.is_premium) changes.push({ id, set: 0 });
      }

      if (changes.length > 0) {
        allUpdates.push(...changes);
      }

      console.log(`  ${type}: ${questions.length} total (${alreadyPremium} already premium), ${changes.length} toggled`);
    }
  }

  if (allUpdates.length === 0) {
    console.log('\nNo updates needed.');
    return;
  }

  console.log(`\nTotal updates: ${allUpdates.length}`);

  // Write SQL
  let sql = '';
  for (const u of allUpdates) {
    sql += `UPDATE questions SET is_premium = ${u.set} WHERE id = ${u.id};\n`;
  }
  fs.writeFileSync('update_premium_bangla.sql', sql);
  console.log(`Written to update_premium_bangla.sql`);

  // Execute via wrangler
  console.log('\nExecuting via wrangler...');
  const { execSync } = await import('child_process');
  execSync('npx wrangler d1 execute questions-db --remote --file=update_premium_bangla.sql -y', { stdio: 'inherit', cwd: 'E:\\cloudbase\\questions-api' });

  console.log('\n✅ Done!');
}

main().catch(err => console.error('❌', err));
