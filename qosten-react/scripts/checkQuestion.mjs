import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function main() {
  const id = process.argv[2] || '1768297236427';
  
  console.log(`Fetching question ${id} from API...`);
  
  const response = await fetch(`${API_BASE_URL}/questions/${id}`);
  const data = await response.json();
  
  console.log('\n=== FULL API RESPONSE ===');
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);