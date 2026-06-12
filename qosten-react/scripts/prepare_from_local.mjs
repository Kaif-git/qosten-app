import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_FILE = "C:\\Users\\Warp\\Downloads\\question-bank-full-2026-05-31.json";
const MCQ_DIR = 'mcq_only_cleaned';
const SQ_DIR = 'sq_only';
const CQ_DIR = 'cq_only';
const OTHER_DIR = 'other_types';

const KEEP_FIELDS = ['id', 'type', 'subject', 'chapter', 'lesson', 'board', 'question', 'options', 'correct_answer', 'explanation', 'image', 'language', 'is_premium', 'second_answer', 'parts'];

function cleanQuestion(q) {
  const cleaned = {};
  for (const key of KEEP_FIELDS) {
    if (key in q) cleaned[key] = q[key];
  }
  return cleaned;
}

function normalizeOptions(q) {
  let options = q.options;
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch (e) { options = []; }
  }
  if (Array.isArray(options) && options.length > 0 && typeof options[0] === 'object') {
    options = options.map(o => o.text || '').join(' | ');
  }
  return options;
}

async function main() {
  console.log('Reading local question bank...');
  const raw = await fs.readFile(SOURCE_FILE, 'utf-8');
  const allQuestions = JSON.parse(raw);
  console.log(`Loaded ${allQuestions.length} questions`);

  const groups = { mcq: {}, sq: {}, cq: {}, other: {} };

  for (const q of allQuestions) {
    const type = (q.type || 'other').toLowerCase();
    const subject = (q.subject || 'Unknown').replace(/[/\\?%*:|"<>]/g, '-');
    const chapter = (q.chapter || 'Uncategorized').replace(/[/\\?%*:|"<>]/g, '-');

    let category;
    if (type === 'mcq') category = 'mcq';
    else if (type === 'sq') category = 'sq';
    else if (type === 'cq') category = 'cq';
    else category = 'other';

    const key = `${subject}__${chapter}`;
    if (!groups[category][key]) groups[category][key] = [];
    groups[category][key].push(q);
  }

  console.log(`\nMCQ groups: ${Object.keys(groups.mcq).length}`);
  console.log(`SQ groups: ${Object.keys(groups.sq).length}`);
  console.log(`CQ groups: ${Object.keys(groups.cq).length}`);
  console.log(`Other groups: ${Object.keys(groups.other).length}`);

  async function writeGroups(category, dirName) {
    const dir = path.join(__dirname, dirName);
    await fs.mkdir(dir, { recursive: true });

    const catGroups = groups[category];
    let totalWritten = 0;

    for (const [key, qList] of Object.entries(catGroups)) {
      const fileName = `${key}_${category}.json`;

      if (category === 'mcq') {
        const cleaned = qList.map(q => ({
          id: q.id,
          subject: q.subject,
          chapter: q.chapter,
          question: q.question || q.question_text || '',
          options: q.options,
          correctAnswer: q.correct_answer || q.correctAnswer || '',
          explanation: q.explanation || '',
          image: q.image || null,
          language: q.language || 'en'
        }));
        await fs.writeFile(path.join(dir, fileName), JSON.stringify(cleaned, null, 2), 'utf-8');
      } else if (category === 'other') {
        const cleaned = qList.map(q => cleanQuestion(q));
        await fs.writeFile(path.join(dir, fileName), JSON.stringify(cleaned, null, 2), 'utf-8');
      } else {
        const cleaned = qList.map(q => ({
          id: q.id,
          subject: q.subject,
          chapter: q.chapter,
          lesson: q.lesson,
          question: q.question,
          parts: q.parts,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
          image: q.image || null
        }));
        await fs.writeFile(path.join(dir, fileName), JSON.stringify(cleaned, null, 2), 'utf-8');
      }

      totalWritten += qList.length;
      console.log(`  ${fileName} (${qList.length} questions)`);
    }

    console.log(`Total ${category}: ${totalWritten} questions in ${Object.keys(catGroups).length} files\n`);
    return totalWritten;
  }

  await writeGroups('mcq', MCQ_DIR);
  await writeGroups('sq', SQ_DIR);
  await writeGroups('cq', CQ_DIR);
  await writeGroups('other', OTHER_DIR);

  console.log('\nAll question types organized and saved.');
}

main().catch(console.error);
