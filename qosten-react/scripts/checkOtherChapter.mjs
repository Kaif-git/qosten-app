import fetch from 'node-fetch';

async function main() {
  const chapter = "The Democracy of Bangladesh and the Election System";
  const url = `https://questions-api.edventure.workers.dev/questions?subject=Bangladesh+and+Global+Studies&chapter=${encodeURIComponent(chapter)}&limit=1`;
  const data = await fetch(url).then(r => r.json());
  
  const q = data.data ? data.data[0] : (Array.isArray(data) ? data[0] : data);
  console.log(JSON.stringify(q, null, 2));
}

main().catch(console.error);