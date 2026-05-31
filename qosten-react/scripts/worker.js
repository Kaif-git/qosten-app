import fs from 'fs/promises';
import path from 'path';
import { chromium } from 'playwright';

const CONFIG = {
  URL: 'https://chat.qwen.ai/',
  INPUT_SELECTOR: '.message-input-textarea',
  RESPONSE_SELECTOR: '.qwen-chat-message-assistant .qwen-markdown',
  COOKIE_STATE: 'C:\\Users\\Warp\\Desktop\\OpenClawAutomations\\state\\auth.json',
  DONE_DIR: 'mcq_processed',
};

async function processFile(filePath) {
  console.log(`DEBUG: Reading file ${filePath}`);
  const data = await fs.readFile(filePath, 'utf-8');
  const questions = JSON.parse(data);

  let prompt = `Strictly review the following MCQ questions. 

OUTPUT FORMAT RULES:
1. If a question is wrong, output: [ID] correct:[label]
2. If a question is invalid/broken, output: [ID] delete
3. If ALL questions in the list are correct, output ONLY: all correct
4. DO NOT include any other text, reasoning, explanations, or conversational filler.
5. Provide one correction per line.

Questions to review:
\n\n`;
  questions.forEach((q, idx) => {
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

  console.log(`DEBUG: Prompt constructed. Length: ${prompt.length}. Questions: ${questions.length}`);
  if (questions.length === 0) {
    console.log('DEBUG: No questions found in file.');
    return;
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: CONFIG.COOKIE_STATE });
  const page = await context.newPage();
  
  console.log(`DEBUG: Navigating to ${CONFIG.URL}`);
  await page.goto(CONFIG.URL);

  console.log('DEBUG: Waiting for input...');
  const input = page.locator(CONFIG.INPUT_SELECTOR);
  await input.waitFor({ state: 'visible', timeout: 30000 });
  await input.click();
  
  console.log('DEBUG: Filling prompt...');
  await input.fill(prompt);
  
  // Verify it was actually filled
  let val = await input.inputValue();
  console.log(`DEBUG: Input value length: ${val ? val.length : 0}`);

  if (!val || val.length < prompt.length * 0.9) {
    console.log('DEBUG: Fill seems incomplete, trying evaluate injection...');
    await page.evaluate((text) => {
      const el = document.querySelector('.message-input-textarea');
      if (el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, prompt);
    await page.waitForTimeout(500);
    val = await input.inputValue();
    console.log(`DEBUG: Retry input length: ${val ? val.length : 0}`);
  }

  console.log('DEBUG: Pressing Enter...');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);

  // Robust send button handling
  try {
    const sendButtonSelector = '.send-button';
    const sendButton = page.locator(sendButtonSelector);
    
    // Retry clicking for up to 5 seconds if the button is still visible and not disabled
    let retries = 0;
    while (retries < 5) {
      const isVisible = await sendButton.isVisible();
      if (!isVisible) {
        console.log('DEBUG: Send button no longer visible (success).');
        break;
      }

      const isDisabled = await sendButton.evaluate(el => el.disabled || el.classList.contains('disabled'));
      if (isDisabled) {
        console.log('DEBUG: Send button is disabled, waiting for UI...');
        await page.waitForTimeout(1000);
        retries++;
        continue;
      }

      console.log(`DEBUG: Clicking send button (attempt ${retries + 1})...`);
      await sendButton.click();
      await page.waitForTimeout(1000);
      retries++;
    }
  } catch (e) {
    console.log(`DEBUG: Send button interaction failed: ${e.message}`);
  }

  console.log('DEBUG: Waiting for response...');
  await page.waitForTimeout(10000);

  let lastText = '';
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(5000);
    try {
      const response = await page.locator(CONFIG.RESPONSE_SELECTOR).last().innerText();
      if (response && response === lastText && response.length > 10) {
        console.log('✅ Output saved:');
        process.stdout.write(response);
        await browser.close();
        return response;
      }
      lastText = response;
      process.stdout.write('.');
    } catch (e) {}
  }
  console.log('\nDEBUG: Timeout or no response.');
  await browser.close();
  throw new Error('No response detected');
}

const file = process.argv[2];
processFile(file).catch(err => {
  console.error(err);
  process.exit(1);
});