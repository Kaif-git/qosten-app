import fetch from 'node-fetch';

async function inspect() {
  const res = await fetch('https://questions-api.edventure.workers.dev/questions?limit=1000');
  const data = await res.json();
  data.forEach(q => {
    const hasOptionsInText = q.question && (q.question.includes('a)') || q.question.includes('a.') || q.question.includes('b)') || q.question.includes('b.'));
    const isNA = (q.correct_answer || q.answer || '').toUpperCase() === 'N/A' || !(q.correct_answer || q.answer);
    const isDouble = (q.correct_answer || q.answer || '').length > 1 && ((q.correct_answer || q.answer || '').includes(' ') || (q.correct_answer || q.answer || '').includes(','));

    if (hasOptionsInText || isNA || isDouble) {
      console.log(`ID: ${q.id}`);
      console.log(`Q: ${q.question}`);
      console.log(`Opts: ${q.options}`);
      console.log(`Ans: ${q.correct_answer} / ${q.answer}`);
      console.log(`Issues: ${hasOptionsInText ? 'OptionsInText ' : ''}${isNA ? 'NA_Ans ' : ''}${isDouble ? 'Double_Ans ' : ''}`);
      console.log('---');
    }
  });
}

inspect().catch(console.error);
