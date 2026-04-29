import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const RESTORED_ID = '1766932201635';
const UNTOUCHED_ID = '1766078371790';

async function fetchQuestion(id) {
  const response = await fetch(`${API_BASE_URL}/questions/${id}`);
  if (response.ok) {
    return await response.json();
  }
  return null;
}

async function compare() {
  console.log('Fetching restored question...');
  const restored = await fetchQuestion(RESTORED_ID);
  console.log('Fetching untouched question...');
  const untouched = await fetchQuestion(UNTOUCHED_ID);
  
  console.log('\n--- RESTORED QUESTION PARTS ---');
  console.log(restored?.parts);
  
  console.log('\n--- UNTOUCHED QUESTION PARTS ---');
  console.log(untouched?.parts);
}

compare();
