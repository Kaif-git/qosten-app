import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function main() {
  const testId = '1768297236427';
  
  // First, get current state
  console.log('=== BEFORE ===');
  const before = await fetch(`${API_BASE_URL}/questions/${testId}`).then(r => r.json());
  console.log('answer:', before.answer);
  console.log('question:', before.question?.substring(0, 50));
  
  // Now update with answer field
  console.log('\n=== UPDATING ===');
  const updateResponse = await fetch(`${API_BASE_URL}/questions/${testId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: testId,
      question: before.question,
      answer: 'TEST ANSWER - this is a test answer',
      subject: before.subject,
      chapter: before.chapter,
      lesson: before.lesson,
      board: before.board,
      type: 'CQ'
    })
  });
  
  const updateResult = await updateResponse.json();
  console.log('Update response:', JSON.stringify(updateResult, null, 2));
  
  // Check after
  console.log('\n=== AFTER ===');
  const after = await fetch(`${API_BASE_URL}/questions/${testId}`).then(r => r.json());
  console.log('answer:', after.answer);
  console.log('question:', after.question?.substring(0, 50));
}

main().catch(console.error);