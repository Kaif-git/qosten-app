import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CFG = {
  URL: 'https://chat.qwen.ai/',
  TEXTAREA_SELECTOR: '.message-input-textarea',
  SEND_BUTTON_SELECTOR: '.send-button',
  RESPONSE_SELECTOR: '.qwen-chat-message-assistant .qwen-markdown',
  AUTH_DIR: 'D:\\OpenClawAutomations\\state',
  MCQ_SOURCE_DIR: 'mcq_to_fix',
  MCQ_DONE_DIR: 'mcq_processed',
  LOG_FILE: 'combined_processor_log.txt',
  NUM_WORKERS: 6,
};

const REVIEW_PROMPT = `You are an MCQ quality reviewer. Review for these issues:
1. LOSS OF STEM: Questions referencing context not provided (e.g., "What was Mr. Rahim doing?" with no story).
2. MISSING IMAGE: Stem/options reference an image but image field is null.
3. INCORRECT OPTION/ANSWER: Correct answer label doesn't match explanation.
4. BROKEN/INVALID: Blank text, garbled text, duplicate options.

Format: ID correct:a/b/c/d or ID delete. If all correct, output "all correct".\n\n`;

async function log(m) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${m}`);
  await fs.appendFile(CFG.LOG_FILE, `[${ts}] ${m}\n`, 'utf-8');
}

async function uploadFile(page, filePath) {
  const fileName = path.basename(filePath);
  console.log(`    Uploading: ${fileName}...`);

  await page.waitForTimeout(3000);

  try {
    const modeSelectOpen = page.locator('.mode-select-open').first();
    if (await modeSelectOpen.count() > 0) {
      await modeSelectOpen.evaluate(el => el.click());
      await page.waitForTimeout(1500);
    }
  } catch {
    console.log(`    Mode select click fell through, trying other strategies...`);
  }

  let fileSet = false;

  // Strategy 1: wait for filechooser event while clicking upload
  try {
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 12000 }),
      (async () => {
        const uploadOption = page.locator('.mode-select-common-item').filter({ hasText: /upload/i }).first();
        if (await uploadOption.count() > 0) {
          await uploadOption.evaluate(el => el.click());
        } else {
          const fallback = page.locator('.ant-dropdown-menu-title-content').filter({ hasText: /upload.*attachment/i }).first();
          if (await fallback.count() > 0) {
            await fallback.evaluate(el => el.click());
          }
        }
      })()
    ]);
    if (fc) {
      await fc.setInputFiles(filePath);
      fileSet = true;
    }
  } catch {}

  // Strategy 2: direct file input
  if (!fileSet) {
    const hiddenInput = page.locator('input[type="file"]').first();
    if (await hiddenInput.count() > 0) {
      await hiddenInput.setInputFiles(filePath);
      await page.waitForTimeout(1500);
      fileSet = true;
    }
  }

  // Strategy 3: keyboard upload (Tab then Enter)
  if (!fileSet) {
    try {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10000 }),
        page.keyboard.press('Enter')
      ]);
      if (fc) {
        await fc.setInputFiles(filePath);
        fileSet = true;
      }
    } catch {}
  }

  if (!fileSet) {
    throw new Error('Could not upload file after all strategies');
  }

  await page.waitForTimeout(2000);

  // Wait for parsing to actually finish (spinners gone + "Parsing..." text gone)
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.circle-spinner');
    const parsing = Array.from(document.querySelectorAll('.fileitem-file-size span')).find(el => el.textContent.includes('Parsing...'));
    return spinners.length === 0 && !parsing;
  }, { timeout: 600000 });

  console.log(`    Upload complete: ${fileName}`);
}

async function sendPromptAndWait(page, prompt) {
  await page.waitForSelector(CFG.TEXTAREA_SELECTOR, { timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.click(CFG.TEXTAREA_SELECTOR, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);

  await page.evaluate((val) => navigator.clipboard.writeText(val), prompt);
  await page.waitForTimeout(100);
  await page.locator(CFG.TEXTAREA_SELECTOR).press('Control+V');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  const btn = page.locator(CFG.SEND_BUTTON_SELECTOR).last();
  let sent = false;
  try {
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click({ force: true, timeout: 10000 });
    sent = true;
  } catch {}
  if (!sent) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await page.keyboard.press('Enter');
  }

  const latestResponse = page.locator(CFG.RESPONSE_SELECTOR).last();
  await latestResponse.waitFor({ state: 'visible', timeout: 0 });

  let lastText = '';
  let stabilityCount = 0;

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const text = await page.evaluate(() => {
          const el = document.querySelector('.qwen-chat-message-assistant:last-child .qwen-markdown');
          if (!el) return '';
          const clone = el.cloneNode(true);
          clone.querySelectorAll('.qwen-markdown-latex').forEach(wrapper => {
            const math = wrapper.querySelector('math');
            if (!math) return;
            const latex = Array.from(math.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
            if (latex) wrapper.replaceWith(document.createTextNode(latex));
          });
          return clone.textContent || clone.innerText || '';
        });
        if (text === lastText && text.trim().length > 10) {
          stabilityCount++;
          if (stabilityCount >= 3) {
            clearInterval(interval);
            resolve(text);
          }
        } else {
          stabilityCount = 0;
        }
        lastText = text;
      } catch {}
    }, 5000);
  });
}

async function worker(browser, queue, workerId) {
  console.log(`Worker ${workerId} started.`);
  while (queue.length > 0) {
    const task = queue.shift();
    if (!task) break;

    const { file, filePath, promptText } = task;
    console.log(`Worker ${workerId} processing: ${file}`);
    
    const authFile = path.join(CFG.AUTH_DIR, workerId === 1 ? 'auth.json' : `auth${workerId}.json`);
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();

    try {
      await page.goto(CFG.URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector(CFG.TEXTAREA_SELECTOR, { timeout: 30000 });
      
      const safeName = file.replace(/\s+/g, '_').replace(/[^\w\-\.]/g, '');
      const tempPromptPath = path.join(os.tmpdir(), `mcq_temp_${safeName}.txt`);
      await fs.writeFile(tempPromptPath, promptText, 'utf-8');
      await uploadFile(page, tempPromptPath);
      const resp = await sendPromptAndWait(page, "Please process the uploaded MCQ file and provide the review results.");
      
      await fs.writeFile(path.join(CFG.MCQ_DONE_DIR, file + '.response.txt'), resp, 'utf-8');
      await fs.rename(filePath, path.join(CFG.MCQ_DONE_DIR, file));
      await fs.unlink(tempPromptPath).catch(() => {});
      
      console.log(`Worker ${workerId} finished ${file}`);
    } catch (err) {
      console.error(`Worker ${workerId} error on ${file}: ${err.message}`);
    } finally {
      await ctx.close();
    }
  }
  console.log(`Worker ${workerId} finished all tasks.`);
}

async function main() {
  console.log('=== Qwen MCQ Reviewer (Parallel 6 Agents) ===\n');
  const browser = await chromium.launch({ headless: false });
  
  try {
    await fs.mkdir(CFG.MCQ_DONE_DIR, { recursive: true });

    const queue = [];
    // 1. Add from Source Dir (New files)
    const mcqFiles = (await fs.readdir(CFG.MCQ_SOURCE_DIR)).filter(f => f.endsWith('.json'));
    for (const file of mcqFiles) {
      const fp = path.join(CFG.MCQ_SOURCE_DIR, file);
      const outputPath = path.join(CFG.MCQ_DONE_DIR, file + '.response.txt');
      try { await fs.access(outputPath); continue; } catch {}

      const raw = await fs.readFile(fp, 'utf-8');
      let parsed = JSON.parse(raw);
      let qs = parsed.value || parsed;
      if (!Array.isArray(qs)) {
        console.log(`Skipping ${file}: JSON is not an array`);
        continue;
      }
      if (qs.length === 0) {
        console.log(`Skipping ${file}: empty array`);
        continue;
      }
      
      let prompt = REVIEW_PROMPT;
      for (const q of qs) {
        prompt += `ID: ${q.id}\nQuestion: ${q.question}\n`;
        let opts = q.options;
        if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { opts = [opts]; } }
        if (Array.isArray(opts) && opts.length && typeof opts[0] === 'object') {
          prompt += `Options: ${opts.map(o => `${o.label}) ${o.text}`).join(', ')}\n`;
        } else if (Array.isArray(opts)) {
          prompt += `Options: ${opts.join(', ')}\n`;
        } else {
          prompt += `Options: ${opts}\n`;
        }
        prompt += `Correct: ${q.correctAnswer || 'Not defined'}\nExplanation: ${q.explanation || ''}\n---\n`;
      }
      queue.push({ file, filePath: fp, promptText: prompt });
    }

    // 2. Add from Processed Dir (Unfinished files — files already in mcq_processed/ without responses)
    const processedFiles = (await fs.readdir(CFG.MCQ_DONE_DIR)).filter(f => f.endsWith('.json'));
    for (const file of processedFiles) {
      const fp = path.join(CFG.MCQ_DONE_DIR, file);
      const outputPath = path.join(CFG.MCQ_DONE_DIR, file + '.response.txt');
      try { await fs.access(outputPath); continue; } catch {}

      const raw = await fs.readFile(fp, 'utf-8');
      let parsed = JSON.parse(raw);
      let qs = parsed.value || parsed;
      if (!Array.isArray(qs)) {
        console.log(`Skipping ${file}: JSON is not an array`);
        continue;
      }
      if (qs.length === 0) {
        console.log(`Skipping ${file}: empty array`);
        continue;
      }
      
      let prompt = REVIEW_PROMPT;
      for (const q of qs) {
        prompt += `ID: ${q.id}\nQuestion: ${q.question}\n`;
        let opts = q.options;
        if (typeof opts === 'string') { try { opts = JSON.parse(opts); } catch { opts = [opts]; } }
        if (Array.isArray(opts) && opts.length && typeof opts[0] === 'object') {
          prompt += `Options: ${opts.map(o => `${o.label}) ${o.text}`).join(', ')}\n`;
        } else if (Array.isArray(opts)) {
          prompt += `Options: ${opts.join(', ')}\n`;
        } else {
          prompt += `Options: ${opts}\n`;
        }
        prompt += `Correct: ${q.correctAnswer || 'Not defined'}\nExplanation: ${q.explanation || ''}\n---\n`;
      }
      queue.push({ file, filePath: fp, promptText: prompt });
    }

    console.log(`Total MCQ files to process: ${queue.length}`);

    const workers = [];
    for (let i = 1; i <= CFG.NUM_WORKERS; i++) {
      const delay = (i - 1) * 3000;
      workers.push(new Promise(resolve => setTimeout(resolve, delay)).then(() => worker(browser, queue, i)));
    }

    await Promise.all(workers);
    console.log('\n=== All Finished ===');
  } catch (e) {
    console.error('Fatal error:', e);
  } finally {
    await new Promise(r => setTimeout(r, 10000));
    await browser.close();
  }
}

main();
