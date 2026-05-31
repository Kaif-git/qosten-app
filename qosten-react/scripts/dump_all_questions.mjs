import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const OUTPUT_DIR = 'all_questions_dump';

async function getAllQuestions() {
  let allQuestions = [];
  let page = 0;
  const limit = 500;
  
  console.log('Fetching all questions with 500-item limit...');
  while (true) {
    const url = `${API_BASE_URL}/questions?page=${page}&limit=${limit}`;
    console.log(`Fetching page ${page} (limit ${limit})...`);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Page ${page} failed with status: ${response.status}`);
        break; 
      }
      
      const data = await response.json();
      const batch = Array.isArray(data) ? data : (data.data || []);
      
      console.log(`Received ${batch.length} items from page ${page}.`);
      
      if (batch.length === 0) {
        console.log('No more items, ending fetch.');
        break;
      }
      
      allQuestions.push(...batch);
      console.log(`Total questions fetched: ${allQuestions.length}`);
      
      // Continue fetching as long as we keep getting full batches of 500
      if (batch.length < limit) {
        console.log('Last page reached (batch < limit).');
        break;
      }
      
      page++;
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e.message);
      break;
    }
  }
  return allQuestions;
}

async function main() {
  try {
    const questions = await getAllQuestions();
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const grouped = {};
    questions.forEach(q => {
      const subject = (q.subject || 'Unknown').replace(/[/\\?%*:|"<>]/g, '-');
      const chapter = (q.chapter || 'Uncategorized').replace(/[/\\?%*:|"<>]/g, '-');
      const type = (q.type || 'other').toLowerCase();
      const key = `${subject}_${chapter}_${type}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(q);
    });

    for (const [key, qList] of Object.entries(grouped)) {
      const fileName = `${key}.json`;
      await fs.writeFile(path.join(OUTPUT_DIR, fileName), JSON.stringify(qList, null, 2), 'utf-8');
    }

    console.log(`\nDumped ${Object.keys(grouped).length} files to ${OUTPUT_DIR}/`);
  } catch (error) {
    console.error('Error dumping questions:', error);
  }
}

main();
