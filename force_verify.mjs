import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const ids = [
  1768297236078, 1768297236198, 1768297236317, 1768297236427, 
  1768297236537, 1768297236646, 1768297236757, 1768297236862, 
  1768297236966, 1768297237075, 1768297237179, 1768297237290, 
  1768297237420, 1768297237538
];

async function forceVerify() {
  for (const id of ids) {
    console.log(`Verifying ID ${id}...`);
    // First, check status
    const res = await fetch(`${API_BASE_URL}/questions/${id}`);
    const data = await res.json();
    
    if (data.is_verified === 0 || data.is_verified === false) {
      const vRes = await fetch(`${API_BASE_URL}/questions/${id}/verify`, { method: 'POST' });
      const vData = await vRes.json();
      console.log(`  Updated ${id}:`, vData.is_verified);
    } else {
      console.log(`  Already verified ${id}`);
    }
  }
}

forceVerify();
