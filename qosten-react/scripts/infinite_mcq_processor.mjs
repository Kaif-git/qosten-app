import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const CONFIG = {
  URL: 'https://chat.qwen.ai/',
  INPUT_SELECTOR: '.message-input-textarea',
  RESPONSE_SELECTOR: '.qwen-chat-message-assistant .qwen-markdown',
  COOKIE_STATE: 'C:\\Users\\Warp\\Desktop\\OpenClawAutomations\\state\\auth.json',
  SOURCE_DIR: 'mcq_only_cleaned',
  DONE_DIR: 'mcq_processed',
  LOG_FILE: 'infinite_mcq_log.txt'
};

async function log(message) {
  const timestamp = new Date().toISOString();
  console.log(message);
  await fs.appendFile(CONFIG.LOG_FILE, `[${timestamp}] ${message}\n`, 'utf-8');
}

async function processFile(page, filePath, fileName) {
  const data = await fs.readFile(filePath, 'utf-8');
  const questions = JSON.parse(data);

  let prompt = `You are an MCQ quality reviewer. Review for these issues:
1. LOSS OF STEM: Questions referencing context not provided (e.g., "What was Mr. Rahim doing?" with no story).
2. MISSING IMAGE: Stem/options reference an image but image field is null.
3. INCORRECT OPTION/ANSWER: Correct answer label doesn't match explanation.
4. BROKEN/INVALID: Blank text, garbled text, duplicate options.

Format: ID correct:a/b/c/d or ID delete. If all correct, output "all correct".\n\n`;
  questions.forEach(q => {
    prompt += `ID: ${q.id}\nQuestion: ${q.question}\n`;

    let options = q.options;
    if (typeof options === 'string') {
      try { options = JSON.parse(options); } catch (e) { options = [options]; }
    }

    if (Array.isArray(options) && options.length > 0 && typeof options[0] === 'object') {
      prompt += `Options: ${options.map(o => `${o.label}) ${o.text}`).join(', ')}\n`;
    } else if (Array.isArray(options)) {
      prompt += `Options: ${options.join(', ')}\n`;
    } else {
      prompt += `Options: ${options}\n`;
    }

    prompt += `Correct: ${q.correctAnswer || 'Not defined'}\nExplanation: ${q.explanation || ''}\n---\n`;
  });

  await page.bringToFront();

  const input = page.locator(CONFIG.INPUT_SELECTOR);
  console.log('DEBUG: Waiting for input selector...');
  await input.waitFor({ state: 'visible', timeout: 30000 });
  await input.click();
  
  console.log('DEBUG: Inserting text via keyboard...');
  await input.click();
  await page.keyboard.insertText(prompt);
  
  await page.waitForTimeout(1000); 
  let val = await input.inputValue();
  
  // Retry if paste/insert failed
  if (val.length < prompt.length / 2) {
    console.log('DEBUG: Insert failed, retrying with clipboard...');
    await page.evaluate((text) => navigator.clipboard.writeText(text), prompt);
    await page.keyboard.press('Control+KeyV');
    await page.waitForTimeout(1000);
    val = await input.inputValue();
  }
  
  console.log(`DEBUG: Final input length: ${val ? val.length : 0}`);
  await page.keyboard.press('Enter');

  // Wait for the indicator that AI is responding
  await page.waitForTimeout(5000); // Give AI time to start generating

  // Poll for response stability
  let lastText = '';
  let retryCount = 0;

  while (retryCount < 20) {
    await page.waitForTimeout(5000);
    try {
      const response = await page.locator(CONFIG.RESPONSE_SELECTOR).last().innerText();
      if (response && response === lastText && response.length > 10) return response;
      lastText = response;
    } catch (e) {
      // Locator might not exist yet
    }
    retryCount++;
  }

  return lastText || "Error: No response detected";
}async function main() {
  await fs.mkdir(CONFIG.DONE_DIR, { recursive: true });

  while (true) {
    const files = await fs.readdir(CONFIG.SOURCE_DIR);
    if (files.length === 0) {
      await log('No files to process. Waiting 60s for new files...');
      await new Promise(r => setTimeout(r, 60000));
      continue;
    }

    for (const file of files) {
      await log(`Processing ${file}`);
      
      const browser = await chromium.launch({ headless: false });
      try {
        const context = await browser.newContext({ storageState: CONFIG.COOKIE_STATE });
        const page = await context.newPage();
        await page.goto(CONFIG.URL);
        
        const response = await processFile(page, path.join(CONFIG.SOURCE_DIR, file), file);
        await log(`Finished ${file}. Response saved.`);
        await fs.writeFile(path.join(CONFIG.DONE_DIR, file + '.response.txt'), response, 'utf-8');
        await fs.rename(path.join(CONFIG.SOURCE_DIR, file), path.join(CONFIG.DONE_DIR, file));
        
        await context.close();
        await browser.close();
      } catch (err) {
        await log(`Error processing ${file}: ${err.message}`);
        await browser.close();
      }
    }
    await log('Cycle complete. Restarting immediately.');
  }
}

main().catch(console.error);
