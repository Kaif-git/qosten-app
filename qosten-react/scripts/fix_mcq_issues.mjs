import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const error = await response.text();
      console.error(`Attempt ${i + 1} failed: ${response.status} - ${error}`);
    } catch (err) {
      console.error(`Attempt ${i + 1} error:`, err.message);
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Failed after ${retries} attempts`);
}

async function updateQuestion(id, data) {
  const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await response.json();
}

function extractOptionsFromText(text) {
  const optionsRegex = /([a-d])[\)\.]\s*([^a-d\)\.]*?)(?=\s*[a-d][\)\.]|$)/gi;
  const matches = [];
  let match;
  while ((match = optionsRegex.exec(text)) !== null) {
    matches.push({
      label: match[1].toLowerCase(),
      text: match[2].trim()
    });
  }
  return matches;
}

function removeOptionsFromText(text) {
  return text.replace(/([a-d])[\)\.]\s*([^a-d\)\.]*?)(?=\s*[a-d][\)\.]|$)/gi, '').trim().replace(/,\s*$/, '').replace(/\s*$/, '');
}

async function main() {
  const LIMIT = 100;
  let page = 1;
  let totalProcessed = 0;
  
  const flags = {
    na_correct: [],
    double_options: [],
    fixed_options_in_text: []
  };

  console.log('Starting full scan of all questions...');

  while (true) {
    try {
      const res = await fetch(`${API_BASE_URL}/questions?limit=${LIMIT}&page=${page}`);
      const questions = await res.json();
      
      if (!questions || questions.length === 0) {
        console.log('No more questions found.');
        break;
      }

      const updates = [];

      for (const q of questions) {
        let modified = false;
        const id = q.id;

        if (q.type === 'mcq') {
          const correctAns = (q.correct_answer || q.answer || '').toString();

          if (!correctAns || correctAns.toUpperCase() === 'N/A' || correctAns.trim() === '') {
            flags.na_correct.push(id);
          }

          if (correctAns && correctAns.length > 1) {
            const lowerAns = correctAns.toLowerCase();
            if (lowerAns.includes(' and ') || lowerAns.includes(',') || lowerAns.includes('both')) {
              flags.double_options.push(id);
            }
          }
        }

        const optionsInText = extractOptionsFromText(q.question || '');
        if (optionsInText.length > 0) {
          const cleanedQuestion = removeOptionsFromText(q.question || '');
          
          let optionsArr = [];
          try {
            optionsArr = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
          } catch (e) {
            optionsArr = [];
          }

          if (optionsArr.length === 0 || (q.type === 'mcq' && optionsInText.length >= 2)) {
            const newOptions = optionsInText.map(opt => ({
              label: opt.label,
              text: opt.text || '',
              is_correct: opt.label === (q.correct_answer || q.answer || '').toLowerCase()
            }));

            q.question = cleanedQuestion;
            q.options = JSON.stringify(newOptions);
            if (q.type !== 'mcq') q.type = 'mcq';
            modified = true;
            flags.fixed_options_in_text.push(id);
          }
        }

        if (modified) {
          updates.push(updateQuestion(id, q));
        }
      }

      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`Updated ${updates.length} questions on page ${page}.`);
      }

      totalProcessed += questions.length;
      page++;
      if (totalProcessed % 1000 === 0) {
        console.log(`Processed ${totalProcessed} questions so far...`);
      }
    } catch (err) {
      console.error(`Error at page ${page}: ${err.message}`);
      page++; // Move forward anyway
    }
  }

  const summary = {
    total_processed: totalProcessed,
    na_correct_count: flags.na_correct.length,
    double_options_count: flags.double_options.length,
    fixed_options_count: flags.fixed_options_in_text.length,
    na_correct_ids: flags.na_correct,
    double_options_ids: flags.double_options,
    fixed_options_ids: flags.fixed_options_in_text
  };

  await fs.writeFile('mcq_issues_report.json', JSON.stringify(summary, null, 2));
  console.log('\nProcessing complete!');
  console.log(`Total processed: ${summary.total_processed}`);
  console.log(`N/A correct answers: ${summary.na_correct_count}`);
  console.log(`Double options: ${summary.double_options_count}`);
  console.log(`Fixed options in text: ${summary.fixed_options_count}`);
  console.log('Detailed report saved to mcq_issues_report.json');
}

main().catch(console.error);
