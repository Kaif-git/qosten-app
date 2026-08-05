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
  const attrs = {};
  const ar = /\[([^\]]+)\]/g;
  let m;
  while ((m = ar.exec(t)) !== null) {
    const tag = m[1];
    const ci = tag.indexOf(':');
    if (ci > 0) attrs[tag.substring(0, ci).trim()] = tag.substring(ci + 1).trim();
  }
  const board = attrs['Board'] || '?';
  const all = t.replace(/\[[^\]]*\]/g, ' ').substring(0, 200);
  const isBad = bad.some(p => p.test(all));
  if (isBad) console.log(`BAD  Q${String(qn).padStart(2)} ${board.padEnd(30)} ${all.substring(0,80)}`);
}
