import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

const CONFIG = {
  URL: 'https://chat.qwen.ai/',
  INPUT_SELECTOR: '.message-input-textarea',
  RESPONSE_SELECTOR: '.qwen-chat-message-assistant .qwen-markdown',
  COOKIE_STATE: 'C:\\Users\\Warp\\Desktop\\OpenClawAutomations\\state\\auth.json',
  PROMPTS_DIR: 'ai_prompts',
  OUTPUTS_DIR: 'ai_outputs',
};

async function main() {
  const browser = await chromium.launch({ headless: false });

  try {
    await fs.mkdir(CONFIG.OUTPUTS_DIR, { recursive: true });

    const files = (await fs.readdir(CONFIG.PROMPTS_DIR)).filter(f => f.endsWith('.txt'));
    console.log(`Found ${files.length} prompt files to process.`);

    for (const file of files) {
      console.log(`\n--- Starting new session for ${file} ---`);
      
      // Create a fresh context and page for each file to ensure a new session
      const context = await browser.newContext({ storageState: CONFIG.COOKIE_STATE });
      const page = await context.newPage();

      try {
        console.log(`Navigating to ${CONFIG.URL}...`);
        await page.goto(CONFIG.URL, { waitUntil: 'commit' });
        
        // Wait for input to be available as quickly as possible
        await page.waitForSelector(CONFIG.INPUT_SELECTOR, { timeout: 30000 });
        
        const promptText = await fs.readFile(path.join(CONFIG.PROMPTS_DIR, file), 'utf-8');

        await page.fill(CONFIG.INPUT_SELECTOR, promptText);
        await page.keyboard.press('Enter');
        console.log(`Prompt sent. Waiting for response...`);

        const latestResponse = page.locator(CONFIG.RESPONSE_SELECTOR).last();
        await latestResponse.waitFor({ state: 'visible', timeout: 0 });

        let lastText = '';
        let stabilityCount = 0;
        const STABILITY_THRESHOLD = 3;
        
        await new Promise((resolve) => {
          const interval = setInterval(async () => {
            try {
              const currentText = await latestResponse.innerText();
              process.stdout.write('\routput ongoing...');
              if (currentText === lastText) {
                stabilityCount++;
              } else {
                stabilityCount = 0;
                lastText = currentText;
              }

              if (stabilityCount >= STABILITY_THRESHOLD) {
                process.stdout.write('\n');
                clearInterval(interval);
                resolve();
              }
            } catch (e) {
              // Ignore transient errors
            }
          }, 5000);
        });

        const finalResponse = await latestResponse.innerText();
        await fs.writeFile(path.join(CONFIG.OUTPUTS_DIR, file), finalResponse, 'utf-8');
        console.log(`Successfully saved output for ${file}`);

      } catch (err) {
        console.error(`Error processing ${file}:`, err.message);
      } finally {
        await context.close(); // Close session completely
      }
    }

    console.log('\nAll prompts processed successfully!');
  } catch (error) {
    console.error('Automation error:', error);
  } finally {
    console.log('Closing browser in 10 seconds...');
    await new Promise(r => setTimeout(r, 10000));
    await browser.close();
  }
}

main();
