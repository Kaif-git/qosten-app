import fetch from 'node-fetch';

async function main() {
  const chapter = "Social Problems of Bangladesh and Remedies";
  const url = `https://questions-api.edventure.workers.dev/questions?subject=Bangladesh+and+Global+Studies&chapter=${encodeURIComponent(chapter)}&limit=10`;
  const data = await fetch(url).then(r => r.json());
  
  const list = data.data || data;
  const cq = list.find(q => q.type === 'cq');
  
  console.log(JSON.stringify(cq, null, 2));
}

main().catch(console.error);