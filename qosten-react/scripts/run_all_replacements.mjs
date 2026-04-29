import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = 'Improved Questios';
const SCRIPT_PATH = 'scripts/replaceQuestions.mjs';
const COOLDOWN_MS = 2000; // 2 seconds delay between files to prevent server crash

async function getTxtFiles(dir) {
  let results = [];
  const list = await fs.readdir(dir, { withFileTypes: true });
  
  for (const file of list) {
    const res = path.resolve(dir, file.name);
    if (file.isDirectory()) {
      results = results.concat(await getTxtFiles(res));
    } else if (file.name.endsWith('.txt')) {
      results.push(res);
    }
  }
  return results;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('🔍 Scanning for improved questions files...');
    const files = await getTxtFiles(ROOT_DIR);
    console.log(`📂 Found ${files.length} files to process.`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = path.basename(file);
      const folderName = path.basename(path.dirname(file));
      
      console.log(`\n[${i + 1}/${files.length}] Processing ${folderName} -> ${fileName}...`);
      
      try {
        // Execute the replacement script for the current file
        // Using double quotes for paths with spaces
        execSync(`node ${SCRIPT_PATH} "${file}"`, { stdio: 'inherit' });
        console.log(`✅ Successfully processed ${fileName}`);
      } catch (err) {
        console.error(`❌ Error processing ${fileName}:`, err.message);
      }
      
      // Cooldown to avoid crashing the server
      if (i < files.length - 1) {
        await sleep(COOLDOWN_MS);
      }
    }
    
    console.log('\n✨ All files processed successfully!');
  } catch (error) {
    console.error('Fatal error during orchestration:', error);
  }
}

main();
