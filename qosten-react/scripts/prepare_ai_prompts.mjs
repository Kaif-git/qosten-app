import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const PROMPTS_DIR = 'ai_prompts';

const PROMPT_TEMPLATE = `You are an MCQ quality reviewer. Review for these issues:
1. LOSS OF STEM: Questions referencing context not provided (e.g., "What was Mr. Rahim doing?" with no prior story).
2. MISSING IMAGE: Stem/options reference an image (diagram, chart, picture) but image field is null.
3. INCORRECT OPTION/ANSWER: Correct answer label doesn't match the explanation text.
4. BROKEN/INVALID: Blank question text, garbled text, duplicate options, or other errors.

Return ONLY commands (one per line):
ID delete
ID correct:a/b/c/d
If all correct: all correct\n\n`;

async function getQuestions(params = {}) {
  let allQuestions = [];
  let page = 0;
  const limit = 500;
  
  while (true) {
    const searchParams = new URLSearchParams({ ...params, page, limit });
    const response = await fetch(`${API_BASE_URL}/questions?${searchParams.toString()}`);
    const data = await response.json();
    const batch = Array.isArray(data) ? data : (data.data || []);
    
    if (batch.length === 0) break;
    allQuestions.push(...batch);
    if (batch.length < limit) break;
    page++;
  }
  return allQuestions;
}

async function main() {
  const targetSubject = process.argv[2];
  if (!targetSubject) {
    console.error('Please provide a subject name as an argument.');
    console.error('Usage: node scripts/prepare_ai_prompts.mjs "Subject Name"');
    process.exit(1);
  }

  try {
    console.log(`Fetching ALL questions for subject: ${targetSubject}...`);
    const questions = await getQuestions({ subject: targetSubject });
    
    console.log(`Found ${questions.length} total questions for ${targetSubject}`);

    await fs.mkdir(PROMPTS_DIR, { recursive: true });
    const existingFiles = await fs.readdir(PROMPTS_DIR);
    for (const file of existingFiles) {
      await fs.unlink(path.join(PROMPTS_DIR, file));
    }

    const groups = {};

    questions.forEach(q => {
      const type = (q.type || 'other').toLowerCase();
      if (type !== 'mcq') return;

      const subject = (q.subject || 'Unknown').replace(/[/\\?%*:|"<>]/g, '-');
      const chapter = (q.chapter || 'Uncategorized').replace(/[/\\?%*:|"<>]/g, '-');
      const key = `${subject}_${chapter}_${type}`;

      if (!groups[key]) groups[key] = { subject, chapter, questions: [] };
      groups[key].questions.push(q);
    });

    console.log(`Found ${Object.keys(groups).length} chapter-type groups.`);

    for (const [key, groupData] of Object.entries(groups)) {
      const { subject, chapter, questions: groupQuestions } = groupData;
      const fileName = `${subject}_${chapter}_mcq.txt`.replace(/[/\\?%*:|"<>]/g, '-');
      const filePath = path.join(PROMPTS_DIR, fileName);

      let content = PROMPT_TEMPLATE;

      groupQuestions.forEach((q, idx) => {
        content += `[ID: ${q.id}]\n${idx + 1}. ${q.question || q.question_text || ''}\n`;
        
        if (q.type?.toLowerCase() === 'mcq' && q.options) {
          const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
          options.forEach(opt => {
            content += `${opt.label}) ${opt.text}\n`;
          });
          content += `Ans: ${q.correct_answer || q.correctAnswer || ''}\n`;
          if (q.explanation) content += `Explanation: ${q.explanation}\n`;
        }
        content += '\n---\n\n';
      });

      await fs.writeFile(filePath, content, 'utf-8');
      console.log(`Written: ${fileName} (${groupQuestions.length} questions)`);
    }

    console.log(`\nAll prompts prepared in ${PROMPTS_DIR}/`);
  } catch (error) {
    console.error('Error preparing prompts:', error);
  }
}

main();
