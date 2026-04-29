import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const ID = '1776939557226';

async function testUpdate() {
  try {
    const response = await fetch(`${API_BASE_URL}/questions/${ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secondary_answer: "TEST SECONDARY ANSWER"
      })
    });
    const data = await response.json();
    console.log('Update response:', data);
    
    const check = await fetch(`${API_BASE_URL}/questions/${ID}`);
    const checkData = await check.json();
    console.log('Verified second_answer:', checkData.second_answer);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testUpdate();
