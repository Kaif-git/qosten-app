// Fix physics EN and BN chapters to match constants
const API = 'https://questions-api.edventure.workers.dev';

const EN_RENAME = {
  'Modern Physics and Electronics': 'Modern Physics & Electronics',
};

const BN_RENAME = {
  'ভৌত রাশি এবং তাদের পরিমাপ': 'ভৌত রাশি ও তাদের পরিমাপ',
  'কাজ, শক্তি এবং ক্ষমতা': 'কাজ, ক্ষমতা ও শক্তি',
  'তরঙ্গ এবং শব্দ': 'তরঙ্গ ও শব্দ',
  'স্থির বিদ্যুৎ': 'স্থির তড়িৎ',
  'তড়িৎ প্রবাহ': 'বর্তমান বিদ্যুৎ',
  'তড়িৎ প্রবাহের চৌম্বকীয় প্রভাব': 'কারেন্টের চৌম্বকীয় প্রভাব',
  'আধুনিক পদার্থবিদ্যা এবং ইলেকট্রনিক্স': 'আধুনিক পদার্থবিদ্যা ও ইলেকট্রনিক্স',
  'জীবন বাঁচাতে পদার্থবিদ্যা': 'জীবন বাঁচাতে পদার্থবিজ্ঞান',
};

async function fetchAll(subject) {
  const all = []; let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,chapter,type,language'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b); page++; if (b.length < 500) break;
  }
  return all;
}

async function rename(subject, renameMap, label) {
  console.log(`\n=== ${label} ===`);
  const all = await fetchAll(subject);
  for (const [oldN, newN] of Object.entries(renameMap)) {
    const toUpdate = all.filter(q => q.chapter === oldN);
    console.log(`"${oldN}" → "${newN}": ${toUpdate.length} questions`);
    let done = 0, fail = 0;
    for (const q of toUpdate) {
      const body = { ...q, chapter: newN };
      const r = await fetch(`${API}/questions/${q.id}`, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(body),
      });
      if (r.ok) done++; else { fail++; console.log(`  ❌ #${q.id}: ${r.status}`); }
    }
    console.log(`  Result: ${done} renamed, ${fail} failed`);
  }
}

async function main() {
  await rename('Physics', EN_RENAME, 'Physics EN');
  await rename('পদার্থবিজ্ঞান', BN_RENAME, 'পদার্থবিজ্ঞান BN');
}
main().catch(console.error);
