import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const ID = '1766932201635';

async function checkQuestion() {
  try {
    const response = await fetch(`${API_BASE_URL}/questions/${ID}`);
    if (response.ok) {
      const data = await response.json();
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error(`Error: ${response.status} - ${await response.text()}`);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

checkQuestion();
