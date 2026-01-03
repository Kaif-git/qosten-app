const fetch = require('node-fetch');

async function fetchSample() {
  const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
  try {
    const response = await fetch(`${API_BASE_URL}/questions?limit=1`);
    if (!response.ok) {
      console.error('Failed to fetch:', response.status);
      return;
    }
    const data = await response.json();
    const questions = Array.isArray(data) ? data : (data.data || []);
    if (questions.length > 0) {
      console.log('Sample question keys:', Object.keys(questions[0]));
      console.log('Sample question data:', JSON.stringify(questions[0], null, 2));
    } else {
      console.log('No questions found.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchSample();
