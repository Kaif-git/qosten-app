import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE = 'https://questions-api.edventure.workers.dev';
const SUBJECTS = ['বাংলাদেশ ও বিশ্বপরিচয়', 'ইসলামিক শিক্ষা'];
const OUTPUT_FILE = 'religion_bgs_bangla_questions.txt';

async function fetchAllForSubject(subject) {
  let all = [];
  let page = 0;
  const limit = 500;
  while (true) {
    const url = `${API_BASE}/questions?subject=${encodeURIComponent(subject)}&type=mcq&page=${page}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const batch = Array.isArray(data) ? data : (data.data || []);
    if (batch.length === 0) break;
    all.push(...batch);
    console.log(`  ${subject}: fetched ${all.length} so far...`);
    if (batch.length < limit) break;
    page++;
  }
  return all;
}

async function main() {
  let allQuestions = [];
  for (const subj of SUBJECTS) {
    console.log(`Fetching ${subj}...`);
    const qs = await fetchAllForSubject(subj);
    console.log(`  => ${qs.length} total for ${subj}`);
    allQuestions.push(...qs);
  }

  let output = '';
  for (const q of allQuestions) {
    output += `ID: ${q.id}\n`;
    output += `Subject: ${q.subject}\n`;
    output += `Chapter: ${q.chapter || ''}\n`;
    output += `Lesson: ${q.lesson || ''}\n`;
    output += `Question: ${q.question || q.question_text || ''}\n`;
    let opts = q.options;
    if (typeof opts === 'string') {
      try { opts = JSON.parse(opts); } catch (e) {}
    }
    if (Array.isArray(opts)) {
      opts.forEach(o => {
        const text = typeof o === 'object' ? o.text : o;
        const label = typeof o === 'object' ? o.label : '';
        const correct = typeof o === 'object' && o.is_correct ? ' [CORRECT]' : '';
        output += `  ${label}) ${text}${correct}\n`;
      });
    }
    if (q.correct_answer) output += `Correct Answer: ${q.correct_answer}\n`;
    if (q.answer) output += `Answer: ${q.answer}\n`;
    if (q.explanation) output += `Explanation: ${q.explanation}\n`;
    output += `Language: ${q.language || ''}\n`;
    output += '---\n\n';
  }

  await fs.writeFile(OUTPUT_FILE, output, 'utf-8');
  console.log(`\nDone! Written ${allQuestions.length} questions to ${OUTPUT_FILE}`);
}

main().catch(console.error);
