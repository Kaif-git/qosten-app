const API = 'https://questions-api.edventure.workers.dev';
async function main() {
  const subjects = ['Biology', 'Higher Mathematics', 'Physics', 'Chemistry', 'রসায়ন', 'বাংলা', 'English', 'ICT', 'BGS', 'Islam & Religion'];
  for (const subj of subjects) {
    const all = []; let page = 0;
    while (true) {
      const p = new URLSearchParams({subject: subj, limit:'500', page:String(page), fields:'id,type,chapter'});
      const r = await fetch(API+'/questions?'+p.toString());
      const j = await r.json();
      const b = Array.isArray(j)?j:(j.data||[]);
      if (!b.length) break;
      all.push(...b); page++; if (b.length < 500) break;
    }
    if (all.length === 0) continue;
    const types = {};
    for (const q of all) { types[q.type] = (types[q.type] || 0) + 1; }
    console.log(subj+': '+all.length+' questions, types: '+JSON.stringify(types));
  }
}
main().catch(console.error);
