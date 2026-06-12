import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const COMBINED_DIR = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\combined';
const SKIP = ['1971', 'Bogipir'];

const chapters = fs.readdirSync(COMBINED_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('1 Completed') && !SKIP.includes(d.name))
  .map(d => d.name);

for (const ch of chapters) {
  const mcqPath = path.join(COMBINED_DIR, ch, 'combined_MCQ.txt');
  if (!fs.existsSync(mcqPath)) {
    console.log(`\n⚠️  ${ch}: No combined_MCQ.txt, skipping`);
    continue;
  }
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📦 Processing ${ch}...`);
  console.log(`${'='.repeat(60)}`);
  try {
    execSync(`node scripts/process_mcq_chapter.mjs "${mcqPath}" --upload --include-orphans`, {
      cwd: 'E:\\Qosten\\qosten-react',
      stdio: 'inherit',
      timeout: 300000
    });
    console.log(`✅ ${ch} done`);
  } catch (err) {
    console.error(`❌ ${ch} failed: ${err.message}`);
  }
}

console.log('\n✅ All chapters processed!');
