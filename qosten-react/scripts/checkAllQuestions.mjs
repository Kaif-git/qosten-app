import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

const ids = [1768297236078, 1768297236198, 1768297236317, 1768297236427, 1768297236537, 1768297236646, 1768297236757, 1768297236862, 1768297236966, 1768297237075, 1768297237179, 1768297237290, 1768297237420, 1768297237538];

async function main() {
  console.log('Checking all 14 questions in database...\n');
  
  for (const id of ids) {
    const response = await fetch(`${API_BASE_URL}/questions/${id}`);
    const data = await response.json();
    
    const hasParts = data.parts && data.parts !== '[]';
    const hasQuestion = data.question && data.question.length > 0;
    const partsCount = hasParts ? JSON.parse(data.parts).length : 0;
    
    console.log(`ID: ${id}`);
    console.log(`  Question: ${hasQuestion ? 'OK (' + data.question.length + ' chars)' : 'EMPTY'}`);
    console.log(`  Parts: ${hasParts ? 'OK (' + partsCount + ' parts)' : 'EMPTY'}`);
    
    if (hasParts) {
      const parts = JSON.parse(data.parts);
      parts.forEach((p, i) => {
        console.log(`    Part ${i+1}: "${p.label}" - marks:${p.marks} - answer:${p.answer?.length || 0} chars`);
      });
    }
    console.log();
  }
}

main().catch(console.error);