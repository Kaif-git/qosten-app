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

// Extract parts like the parser does
for (const block of blocks) {
  const t = block.trim();
  const qn = t.match(/Question (\d+):/)[1];
  
  const ai = t.indexOf('Answer:');
  if (ai < 0) { console.log(`Q${qn} no Answer`); continue; }
  const qp = t.substring(0, ai);
  const ap = t.substring(ai + 7);
  
  let stemText = qp.replace(/\[([^\]]+)\]/g, '').replace(/Question\s*\d+:/, '').trim();
  stemText = stemText.replace(/^Stem:/, '').trim();
  
  const aqi = stemText.indexOf('A. ');
  const bqi = stemText.indexOf('B. ');
  const cqi = stemText.indexOf('C. ');
  if (aqi < 0 || bqi < 0 || cqi < 0) { console.log(`Q${qn} no ABC`); continue; }
  
  const stem = stemText.substring(0, aqi).trim();
  const partA = stemText.substring(aqi, bqi).trim();
  const partB = stemText.substring(bqi, cqi).trim();
  const partC = stemText.substring(cqi).trim();
  
  const ansText = ap.trim();
  const aai = ansText.indexOf('A. ');
  const abi = ansText.indexOf('B. ');
  const aci = ansText.indexOf('C. ');
  if (aai < 0 || abi < 0 || aci < 0) { console.log(`Q${qn} answer no ABC`); continue; }
  
  const ansA = ansText.substring(aai, abi).trim();
  const ansB = ansText.substring(abi, aci).trim();
  const ansC = ansText.substring(aci).trim();
  
  const all = [stem, partA, partB, partC, ansA, ansB, ansC].join(' ');
  const isBad = bad.some(p => p.test(all));
  if (isBad) console.log(`BAD Q${String(qn).padStart(2)}: ` + all.substring(0, 100));
}
console.log('Done checking');
