const fs = require('fs');
const path = require('path');
const backupDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\BACKUP_CQ_FILES';

const bad = [/Ensure/i, /Extract CQ/i, /Math tutor/i, /No vague filler/i,
  /Inline math/i, /specific layout/i, /One step per line/i,
  /Handle missing/i, /Verify and correct/i, /Beginner-friendly/i,
  /Self-Correction/i, /Final Check/i, /Panjeree/i, /Decision:/i,
  /source is empty/i, /is unreadable/i, /still extract/i,
  /Correct format/i, /I will list/i, /I'll stick/i, /to be safe/i,
  /Keep it/i, /images of a test paper/i, /No source/i, /Reference page/i,
  /^3 pages of/i, /^Page \d+:/i, /^Subject, Chapter/i, /^Two images/i];

const engRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_ENGLISH.txt'), 'utf-8');
const blocks = engRaw.split(/(?=Question \d+:(?:\n|\[ID:))/).filter(b => b.trim() && /^Question \d+:/.test(b.trim()));

for (const block of blocks) {
  const t = block.trim();
  const qn = t.match(/Question (\d+):/)[1];
  
  // Search bad patterns in the ENTIRE block text (not just parts)
  for (const p of bad) {
    if (p.test(t)) {
      // Find the matching text
      const match = t.match(p);
      if (match) {
        const ctx = t.substring(Math.max(0, match.index - 30), match.index + 80);
        console.log(`Q${qn} matches ${p}: ...${ctx}...`);
      }
    }
  }
}
