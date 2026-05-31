import fs from 'fs/promises';

const SOURCE = 'religion_bgs_bangla_questions.txt';
const OUTPUT_DIR = 'batches';
const NUM_BATCHES = 20;

async function split() {
  const content = await fs.readFile(SOURCE, 'utf-8');
  const questions = content.split(/---\r?\n/).filter(q => q.trim() !== '');
  console.log(`Total questions: ${questions.length}`);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const perBatch = Math.ceil(questions.length / NUM_BATCHES);

  for (let i = 0; i < NUM_BATCHES; i++) {
    const start = i * perBatch;
    const end = Math.min(start + perBatch, questions.length);
    const batch = questions.slice(start, end);
    const batchContent = batch.join('---\n') + '---\n';
    const fileName = `batch_${String(i + 1).padStart(2, '0')}.txt`;
    await fs.writeFile(`${OUTPUT_DIR}/${fileName}`, batchContent, 'utf-8');
    console.log(`Batch ${i + 1}: ${batch.length} questions -> ${fileName}`);
  }

  console.log(`\nSplit ${questions.length} questions into ${NUM_BATCHES} batches in ${OUTPUT_DIR}/`);
}

split().catch(console.error);
