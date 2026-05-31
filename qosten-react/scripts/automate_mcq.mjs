import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import readline from 'node:readline';

const CONFIG = {
  URL: 'https://chat.qwen.ai/',
  INPUT_SELECTOR: '.message-input-textarea',
  RESPONSE_SELECTOR: '.qwen-chat-message-assistant .qwen-markdown',
  COOKIE_STATE: 'C:\\Users\\Warp\\Desktop\\OpenClawAutomations\\state\\auth.json',
  API_URL: 'https://questions-api.edventure.workers.dev',
  PROMPTS_DIR: 'ai_prompts',
  OUTPUTS_DIR: 'ai_outputs',
  LOG_FILE: 'automation_log.txt',
  CACHE_FILE: 'subjects_cache.json',
  CACHE_TTL_MS: 24 * 60 * 60 * 1000 // 24 hours
};

async function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  await fs.appendFile(CONFIG.LOG_FILE, logMessage, 'utf-8');
}

async function fetchAllQuestions() {
  const allQuestions = [];
  let page = 1;
  const limit = 1000;
  
  while (true) {
    const url = `${CONFIG.API_URL}/questions?page=${page}&limit=${limit}`;
    console.log(`Fetching page ${page}...`);
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    if (!data || data.length === 0) break;
    
    allQuestions.push(...data);
    if (data.length < limit) break;
    page++;
  }
  
  return allQuestions;
}

async function getSubjectsAndChapters() {
  const cachePath = CONFIG.CACHE_FILE;
  
  // Check cache
  try {
    const stats = await fs.stat(cachePath);
    const age = Date.now() - stats.mtimeMs;
    if (age < CONFIG.CACHE_TTL_MS) {
      console.log('Using cached subjects data...');
      const cached = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(cached);
    }
  } catch (e) {
    // Cache doesn't exist or expired, fetch fresh
  }
  
  // Fetch from API
  console.log('Fetching subjects and chapters from API...');
  const questions = await fetchAllQuestions();
  
  // Group by subject and chapter, filter MCQ only
  const grouped = {};
  questions.forEach(q => {
    if (q.type !== 'mcq') return;
    if (!grouped[q.subject]) grouped[q.subject] = new Set();
    grouped[q.subject].add(q.chapter);
  });
  
  // Convert Sets to Arrays
  const result = {};
  for (const [subject, chapters] of Object.entries(grouped)) {
    result[subject] = Array.from(chapters).sort();
  }
  
  // Save to cache
  await fs.writeFile(cachePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Cached ${Object.keys(result).length} subjects to ${CONFIG.CACHE_FILE}`);
  
  return result;
}

async function question(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(query, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function processPrompt(page, promptText, file) {
  await page.bringToFront();
  await page.waitForSelector(CONFIG.INPUT_SELECTOR, { state: 'visible', timeout: 30000 });
  await page.click(CONFIG.INPUT_SELECTOR);
  await page.waitForTimeout(1000);
  await page.fill(CONFIG.INPUT_SELECTOR, '');
  await page.fill(CONFIG.INPUT_SELECTOR, promptText);
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  console.log(`Prompt sent for ${file}. Waiting for response...`);

  const latestResponse = page.locator(CONFIG.RESPONSE_SELECTOR).last();
  await latestResponse.waitFor({ state: 'visible', timeout: 0 });

  let lastText = '';
  let stabilityCount = 0;
  const STABILITY_THRESHOLD = 3;

  await new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const responseText = await latestResponse.innerText();
        process.stdout.write('\routput ongoing...');
        if (responseText === lastText) {
          stabilityCount++;
        } else {
          stabilityCount = 0;
        }
        lastText = responseText;

        if (stabilityCount >= STABILITY_THRESHOLD) {
          process.stdout.write('\n');
          clearInterval(interval);
          resolve();
        }
      } catch (e) {}
    }, 5000);
  });

  return await latestResponse.innerText();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await fs.mkdir(CONFIG.OUTPUTS_DIR, { recursive: true });
  await log('=== Full Automation Started ===');

  const subjectsData = await getSubjectsAndChapters();
  const subjects = Object.keys(subjectsData).sort();

  if (subjects.length === 0) {
    console.log('No MCQ subjects found in API.');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  
  try {
    for (const selectedSubject of subjects) {
      const chapters = subjectsData[selectedSubject].sort();
      console.log(`\n=== Processing Subject: ${selectedSubject} (${chapters.length} chapters) ===`);
      await log(`Started subject: ${selectedSubject}`);

      for (const chapter of chapters) {
        if (chapter.includes('Economic Indicators')) {
          await log(`Skipping chapter: ${chapter}`);
          continue;
        }

        const outputFile = `${selectedSubject}_${chapter}_mcq.txt`;
        const outputPath = path.join(CONFIG.OUTPUTS_DIR, outputFile);
        
        if (await fileExists(outputPath)) {
          console.log(`Already completed: ${chapter}`);
          continue;
        }

        await log(`Starting chapter: ${chapter}`);
        const context = await browser.newContext({ storageState: CONFIG.COOKIE_STATE });
        const page = await context.newPage();

        try {
          await page.goto(CONFIG.URL, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(5000);

          const promptText = await createPromptForChapter(selectedSubject, chapter);
          const response = await processPrompt(page, promptText, chapter);

          if (response.trim().toLowerCase() === 'all correct') {
            await log(`Chapter ${chapter}: All correct.`);
          } else {
            await fs.writeFile(outputPath, response, 'utf-8');
            await log(`Chapter ${chapter}: Output saved.`);
          }
        } catch (err) {
          await log(`ERROR ${chapter}: ${err.message}`);
        } finally {
          await context.close();
        }
      }
      await log(`Completed Subject: ${selectedSubject}`);
    }
  } finally {
    await browser.close();
    await log('=== All Subjects Completed ===');
    console.log('\nAll subjects processed.');
  }
}

async function createPromptForChapter(subject, chapter) {
  // Fetch all questions for this chapter with pagination
  const allQuestions = [];
  let page = 0;
  const limit = 1000;
  
  console.log(`DEBUG: Fetching ${subject} - ${chapter}`);
  while (true) {
    const url = `${CONFIG.API_URL}/questions?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&type=mcq&page=${page}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    
    const data = await response.json();
    const batch = Array.isArray(data) ? data : (data.data || []);
    
    if (batch.length === 0) break;
    
    allQuestions.push(...batch);
    if (batch.length < limit) break;
    page++;
  }
  
  console.log(`DEBUG: Found ${allQuestions.length} questions`);
  
  // Build prompt text (similar to prepare_ai_prompts.mjs)
  let prompt = `Fix the following MCQ questions. For each question that needs fixing, output the ID followed by the correction.\n`;
  prompt += `Format: ID delete (to delete) or ID correct:a/b/c/d (to fix answer)\n`;
  prompt += `If all questions are correct, output "all correct"\n\n`;
  
  allQuestions.forEach(q => {
    if (!q.question || q.question === 'null') {
      console.log(`Skipping invalid question ID: ${q.id}`);
      return;
    }

    prompt += `ID: ${q.id}\n`;
    prompt += `Question: ${q.question}\n`;
    
    let options = q.options;
    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch (e) {
        options = [options];
      }
    }
    
    // Check if options is an array of objects (like {label: 'a', text: '...'})
    if (Array.isArray(options) && options.length > 0 && typeof options[0] === 'object') {
      prompt += `Options: ${options.map(o => `${o.label}) ${o.text}`).join(', ')}\n`;
    } else if (Array.isArray(options)) {
      prompt += `Options: ${options.join(', ')}\n`;
    } else {
      prompt += `Options: ${options}\n`;
    }
    
    prompt += `Correct: ${q.correct_answer || q.correctAnswer || 'Not defined'}\n`;
    if (q.explanation) {
      prompt += `Explanation: ${q.explanation}\n`;
    }
    prompt += `\n`;
  });
  
  return prompt;
}

main().catch(console.error);
