const API = 'https://questions-api.edventure.workers.dev';
async function main() {
  // Get a details of a CQ question
  const r = await fetch(API+'/questions?subject=Biology&type=cq&limit=1&fields=id,type,parts,solution,explanation,correct_answer,question_text,chapter');
  const j = await r.json();
  const b = Array.isArray(j)?j:(j.data||[]);
  if (!b.length) { console.log('No CQ found'); return; }
  const q = b[0];
  console.log(JSON.stringify(q, null, 2).slice(0, 2000));
}
main().catch(console.error);
