import fetch from 'node-fetch';

async function main() {
  const h = await fetch('https://questions-api.edventure.workers.dev/hierarchy').then(r => r.json());
  console.log(JSON.stringify(h[0].chapters.slice(0,3), null, 2));
}

main().catch(console.error);