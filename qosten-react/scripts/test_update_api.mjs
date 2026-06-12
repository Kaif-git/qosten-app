import fetch from 'node-fetch';

const tests = [
  { method: 'PATCH', url: 'https://questions-api.edventure.workers.dev/questions/1', body: {is_premium: true} },
  { method: 'PUT', url: 'https://questions-api.edventure.workers.dev/questions/1', body: {is_premium: true} },
  { method: 'PATCH', url: 'https://questions-api.edventure.workers.dev/api/questions/1', body: {is_premium: true} },
];

for (const t of tests) {
  try {
    const r = await fetch(t.url, { method: t.method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(t.body) });
    const text = await r.text();
    console.log(t.method + ' ' + t.url + ' -> ' + r.status + ': ' + text.substring(0, 120));
  } catch(e) {
    console.log(t.method + ' ' + t.url + ' -> ERROR: ' + e.message.substring(0, 80));
  }
}
