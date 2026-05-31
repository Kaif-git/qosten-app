import fs from 'fs/promises';
import path from 'path';

const SOURCE_DIR = 'all_questions_dump';
const TARGET_DIR = 'mcq_only_cleaned';

async function cleanMcqFiles() {
  await fs.mkdir(TARGET_DIR, { recursive: true });
  const files = await fs.readdir(SOURCE_DIR);

  for (const file of files) {
    if (!file.endsWith('_mcq.json')) continue;

    const filePath = path.join(SOURCE_DIR, file);
    const data = await fs.readFile(filePath, 'utf-8');
    const questions = JSON.parse(data);

    const cleaned = questions.map(q => ({
      id: q.id,
      subject: q.subject,
      chapter: q.chapter,
      question: q.question,
      options: q.options,
      correctAnswer: q.correct_answer || q.correctAnswer,
      explanation: q.explanation || ''
    }));

    await fs.writeFile(path.join(TARGET_DIR, file), JSON.stringify(cleaned, null, 2), 'utf-8');
    console.log(`Cleaned: ${file}`);
  }
}

cleanMcqFiles().catch(console.error);
