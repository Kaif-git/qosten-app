// Fix 3 গণিত BN chapter names to match constants
const API = 'https://questions-api.edventure.workers.dev';

const RENAME_MAP = {
  'দূরত্ব এবং উচ্চতা': 'দূরত্ব ও উন্নতি কোণ',
  'বীজগাণিতিক অনুপাত এবং সমানুপাত': 'বীজগাণিতিক অনুপাত ও সমানুপাত',
  'ক্ষেত্রফল সম্পর্কিত উপপাদ্য এবং নির্মাণ': 'ক্ষেত্রফল সম্পর্কিত উপপাদ্য ও অঙ্কন',
};

async function fetchAll(subject) {
  const all = [];
  let page = 0;
  while (true) {
    const p = new URLSearchParams({subject, limit:'500', page:String(page), fields:'id,chapter,question_text,type,language,is_flagged,is_quizzable,difficulty,correct_answer,options,parts,solution,explanation,board,tags,lesson,is_premium,image'});
    const r = await fetch(API+'/questions?'+p.toString());
    const j = await r.json();
    const b = Array.isArray(j)?j:(j.data||[]);
    if (!b.length) break;
    all.push(...b);
    page++;
    if (b.length < 500) break;
  }
  return all;
}

async function main() {
  console.log('Fetching all গণিত questions...');
  const questions = await fetchAll('গণিত');
  console.log(`Total গণিত questions: ${questions.length}`);

  let updated = 0;
  let failed = 0;

  for (const q of questions) {
    const oldChapter = q.chapter;
    const newChapter = RENAME_MAP[oldChapter];
    if (!newChapter) continue;

    // Send full question data with updated chapter
    const body = { ...q, chapter: newChapter };
    
    const res = await fetch(`${API}/questions/${q.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      updated++;
      if (updated <= 3 || updated % 50 === 0) {
        console.log(`  ✅ #${q.id}: "${oldChapter}" → "${newChapter}"`);
      }
    } else {
      failed++;
      const errTxt = await res.text();
      console.log(`  ❌ #${q.id}: FAILED (${res.status}) ${errTxt.slice(0,100)}`);
    }
  }

  console.log(`\nDone: ${updated} updated, ${failed} failed`);
}

main().catch(console.error);
