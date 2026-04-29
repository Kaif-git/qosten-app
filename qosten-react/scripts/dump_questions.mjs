import fetch from 'node-fetch';
import fs from 'fs/promises';

async function dump() {
  const res = await fetch('https://questions-api.edventure.workers.dev/questions?limit=1000');
  const data = await res.json();
  await fs.writeFile('all_questions.json', JSON.stringify(data, null, 2));
  console.log('Dumped to all_questions.json');
}

dump().catch(console.error);
