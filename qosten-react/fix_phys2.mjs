const API = 'https://questions-api.edventure.workers.dev';
const RENAME = {
  'তড়িৎ প্রবাহের চৌম্বকীয় প্রভাব': 'কারেন্টের চৌম্বকীয় প্রভাব',
  'আধুনিক পদার্থবিদ্যা এবং ইলেকট্রনিক্স': 'আধুনিক পদার্থবিদ্যা ও ইলেকট্রনিক্স',
  'জীবন বাঁচাতে পদার্থবিদ্যা': 'জীবন বাঁচাতে পদার্থবিজ্ঞান',
};

async function main() {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject:'পদার্থবিজ্ঞান', limit:'500', page:String(page), fields:'id,chapter,type,language'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  for (const [oldN, newN] of Object.entries(RENAME)) {
    const toUpdate = all.filter(q => q.chapter === oldN);
    console.log(`"${oldN}" → "${newN}": ${toUpdate.length} questions`);
    for (const q of toUpdate) {
      const body = { ...q, chapter: newN };
      await fetch(`${API}/questions/${q.id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
    }
    console.log('  Done');
  }
}
main().catch(console.error);
