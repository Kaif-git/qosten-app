import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const DELETE_DELAY_MS = 100;
const MAX_RETRIES = 10;
const DRY_RUN = true;

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 500 && attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        console.log(`  503 error, retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (e) {
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
        console.log(`  Network error: ${e.message}, retrying in ${delay}ms (attempt ${attempt}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw e;
    }
  }
}

async function getAllQuestions() {
  let allQuestions = [];
  let page = 0;
  const limit = 500;

  console.log('Fetching all questions...');
  while (true) {
    const url = `${API_BASE_URL}/questions?page=${page}&limit=${limit}`;
    process.stdout.write(`  Fetching page ${page}...`);

    try {
      const response = await fetchWithRetry(url);
      if (!response.ok) {
        console.error(` Failed (status: ${response.status})`);
        break;
      }

      const data = await response.json();
      const batch = Array.isArray(data) ? data : (data.data || []);

      console.log(` ${batch.length} items`);

      if (batch.length === 0) break;

      allQuestions.push(...batch);
      if (batch.length < limit) break;
      page++;
    } catch (e) {
      console.error(` Error: ${e.message}`);
      break;
    }
  }

  console.log(`\nTotal fetched: ${allQuestions.length}`);
  return allQuestions;
}

function findDuplicates(questions) {
  const seen = new Map();
  const duplicates = [];
  const subjectStats = {};
  const typeStats = {};

  for (const q of questions) {
    const text = (q.question || q.question_text || '').trim().toLowerCase();
    if (!text) continue;

    const key = `${q.type || 'unknown'}|${text}`;

    if (seen.has(key)) {
      duplicates.push({ duplicate: q, original: seen.get(key) });

      const subject = q.subject || 'Unknown';
      const type = q.type || 'unknown';

      subjectStats[subject] = (subjectStats[subject] || 0) + 1;
      typeStats[type] = (typeStats[type] || 0) + 1;
    } else {
      seen.set(key, q);
    }
  }

  return { duplicates, subjectStats, typeStats };
}

async function printSummary(duplicates, subjectStats, typeStats) {
  console.log('\n' + '='.repeat(60));
  console.log('DUPLICATE QUESTIONS REPORT');
  console.log('='.repeat(60));
  console.log(`Total duplicates found: ${duplicates.length}\n`);

  console.log('By Type:');
  for (const [type, count] of Object.entries(typeStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\nBy Subject (top 20):');
  const sortedSubjects = Object.entries(subjectStats).sort((a, b) => b[1] - a[1]);
  for (const [subject, count] of sortedSubjects.slice(0, 20)) {
    console.log(`  ${subject}: ${count}`);
  }
  if (sortedSubjects.length > 20) {
    console.log(`  ... and ${sortedSubjects.length - 20} more subjects`);
  }

  const totalQuestions = duplicates.length + new Set(duplicates.map(d => d.original.id)).size;
  console.log(`\nCurrent questions in DB: ~${totalQuestions + duplicates.length}`);
  console.log(`After cleanup: ~${totalQuestions}`);

  const sampleTypes = {};
  for (const d of duplicates.slice(0, 50)) {
    const type = d.duplicate.type || 'unknown';
    if (!sampleTypes[type]) sampleTypes[type] = [];
    if (sampleTypes[type].length < 3) {
      sampleTypes[type].push({
        deleteId: d.duplicate.id,
        keepId: d.original.id,
        text: (d.duplicate.question || d.duplicate.question_text || '').substring(0, 70)
      });
    }
  }

  console.log('\nSamples of duplicates to be removed:');
  for (const [type, samples] of Object.entries(sampleTypes)) {
    console.log(`\n  [${type}]`);
    for (const s of samples) {
      console.log(`    Delete ${s.deleteId} | Keep ${s.keepId}`);
      console.log(`    Text: "${s.text}..."`);
    }
  }

  const report = {
    totalDuplicates: duplicates.length,
    byType: typeStats,
    bySubject: subjectStats,
    duplicates: duplicates.map(d => ({
      deleteId: d.duplicate.id,
      keepId: d.original.id,
      text: (d.duplicate.question || d.duplicate.question_text || '').substring(0, 100),
      subject: d.duplicate.subject,
      chapter: d.duplicate.chapter,
      type: d.duplicate.type
    }))
  };

  await fs.writeFile('deduplicate_report.json', JSON.stringify(report, null, 2), 'utf-8');
  console.log('\nFull report saved to deduplicate_report.json');

  const backup = duplicates.map(d => ({
    ...d.duplicate,
    _keepingId: d.original.id,
    _duplicateOf: d.original.id
  }));
  await fs.writeFile('deduplicate_backup.json', JSON.stringify(backup, null, 2), 'utf-8');
  console.log('Backup of all duplicate questions saved to deduplicate_backup.json');
}

async function deleteQuestion(id) {
  const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }

  return true;
}

async function main() {
  console.log('=== Question Deduplication Script ===');
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const questions = await getAllQuestions();
  console.log(`\nAnalyzing ${questions.length} questions for duplicates...`);

  const { duplicates, subjectStats, typeStats } = findDuplicates(questions);

  if (duplicates.length === 0) {
    console.log('No duplicates found.');
    return;
  }

  await printSummary(duplicates, subjectStats, typeStats);

  if (!DRY_RUN) {
    console.log('\n' + '='.repeat(60));
    console.log('DELETING DUPLICATES...');
    console.log('='.repeat(60));

    let deletedCount = 0;
    let failCount = 0;

    for (let i = 0; i < duplicates.length; i++) {
      const { duplicate } = duplicates[i];
      process.stdout.write(`  [${i + 1}/${duplicates.length}] Deleting ${duplicate.id}...`);

      try {
        await deleteQuestion(duplicate.id);
        deletedCount++;
        console.log(' Done');
      } catch (err) {
        failCount++;
        console.error(` FAILED: ${err.message}`);
      }

      if (i < duplicates.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELETE_DELAY_MS));
      }
    }

    console.log(`\nDeleted: ${deletedCount}`);
    console.log(`Failed:  ${failCount}`);
  } else {
    console.log('\n(Dry run - no changes made. Set DRY_RUN = false to execute.)');
  }
}

main().catch(console.error);
