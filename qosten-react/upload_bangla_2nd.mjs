import fetch from 'node-fetch';
import fs from 'fs';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const INPUT_FILE = 'C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-04.json';

async function createQuestion(q) {
  const response = await fetch(`${API_BASE_URL}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err.substring(0, 200));
  }
  return response.json();
}

async function main() {
  console.log(`Reading ${INPUT_FILE}...`);
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  
  const filtered = data.filter(item => item.subject === 'বাংলা দ্বিতীয় পত্র');
  console.log(`Found ${filtered.length} questions for বাংলা দ্বিতীয় পত্র`);

  let successCount = 0;
  let failedCount = 0;
  const CONCURRENCY = 5;

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const chunk = filtered.slice(i, i + CONCURRENCY);
    const promises = chunk.map(item => {
      const payload = {
        type: item.type || 'mcq',
        subject: item.subject,
        chapter: item.chapter || 'N/A',
        lesson: item.lesson || 'N/A',
        board: item.board || 'N/A',
        language: item.language || 'bn',
        question_text: item.question || item.question_text || '',
        options: item.options || '[]',
        correct_answer: item.correct_answer || '',
        explanation: item.explanation || '',
        is_verified: 1,
        is_flagged: 0,
        in_review_queue: 0
      };
      
      return createQuestion(payload)
        .then(() => successCount++)
        .catch(err => {
          failedCount++;
          console.error(`\nError uploading question ${item.id}: ${err.message}`);
        });
    });
    await Promise.all(promises);
    process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY, filtered.length)}/${filtered.length} (${successCount} ok, ${failedCount} failed)\r`);
  }

  console.log(`\n\nFinal Result: ${successCount} uploaded, ${failedCount} failed`);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
