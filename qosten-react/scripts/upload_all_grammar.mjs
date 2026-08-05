import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const GRAMMAR_DIR = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\combined_grammar';
const SUBJECT = 'বাংলা দ্বিতীয় পত্র';

const chapters = fs.readdirSync(GRAMMAR_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_'))
  .map(d => d.name);

console.log(`Found ${chapters.length} grammar chapters\n`);

for (const ch of chapters) {
  const mcqPath = path.join(GRAMMAR_DIR, ch, 'combined_MCQ.txt');
  if (!fs.existsSync(mcqPath)) {
    console.log(`⚠️  ${ch}: No combined_MCQ.txt, skipping`);
    continue;
  }
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Uploading ${ch}...`);
  console.log(`${'='.repeat(60)}`);
  try {
    execSync(
      `node scripts/process_mcq_chapter.mjs "${mcqPath}" --upload --include-orphans --subject "${SUBJECT}"`,
      { cwd: 'E:\\Qosten\\qosten-react', stdio: 'inherit', timeout: 300000 }
    );
    console.log(`✅ ${ch} done`);
  } catch (err) {
    console.error(`❌ ${ch} failed: ${err.message}`);
  }
}

console.log('\n✅ All grammar chapters uploaded!');
