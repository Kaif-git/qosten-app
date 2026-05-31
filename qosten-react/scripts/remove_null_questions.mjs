import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = 'mcq_only_cleaned';

async function removeNullQuestions() {
  const files = await fs.readdir(SOURCE_DIR);

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = path.join(SOURCE_DIR, file);
    const data = await fs.readFile(filePath, 'utf-8');
    const questions = JSON.parse(data);

    const filtered = questions.filter(q => q.question !== null && q.question !== undefined && q.question !== '');
    
    if (filtered.length !== questions.length) {
      await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
      console.log(`Cleaned ${file}: Removed ${questions.length - filtered.length} null entries.`);
    }
  }
  console.log('Finished removing all null questions.');
}

removeNullQuestions().catch(console.error);
