const fs = require('fs');
const path = require('path');

const backupDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\BACKUP_CQ_FILES';

const bd = '০১২৩৪৫৬৭৮৯';
const ed = '0123456789';
const toEn = s => { let r=''; for(const c of s){const i=bd.indexOf(c);r+=i>=0?ed[i]:c;} return r; };

const boardNorm = {
  'ঢাকা': 'dhaka', 'সিলেট': 'sylhet', 'বরিশাল': 'barishal',
  'ময়মনসিংহ': 'mymensingh', 'রাজশাহী': 'rajshahi', 'কুমিল্লা': 'cumilla',
  'চট্টগ্রাম': 'chattogram', 'দিনাজপুর': 'dinajpur', 'যশোর': 'jashore',
  'মির্জাপুর': 'mirzapur', 'জয়পুরহাট': 'joypurhat'
};
function normBoard(b) {
  let s = b.replace(/[\s\-]/g, '').toLowerCase();
  s = s.replace(/বোর্ড$/, '').replace(/board$/, '').trim();
  for (const [bn, en] of Object.entries(boardNorm)) {
    s = s.replace(bn, en);
  }
  s = s.replace(/[১২৩৪৫৬৭৮৯০]|202\d/g, '').trim();
  if (s.includes('ক্যাডেট') || s.includes('cadet')) return 'cadetcollege';
  s = s.replace(/গার্লস/, '').replace(/girls['']?/, '').trim();
  const nameMap = {
    'dhaka': 'dhaka', 'sylhet': 'sylhet', 'barishal': 'barishal',
    'mymensingh': 'mymensingh', 'rajshahi': 'rajshahi', 'cumilla': 'cumilla',
    'chattogram': 'chattogram', 'dinajpur': 'dinajpur', 'jashore': 'jashore',
    'mirzapur': 'mirzapur', 'joypurhat': 'joypurhat'
  };
  for (const [k, v] of Object.entries(nameMap)) {
    if (s.includes(k)) return v;
  }
  return s;
}

// Quick parse
const engRaw = fs.readFileSync(path.join(backupDir, 'Ch3_CQ_ENGLISH.txt'), 'utf-8');
const engBlocks = engRaw.split(/(?=Question \d+:)/).filter(b => b.trim() && b.startsWith('Question'));

for (const block of engBlocks) {
  const t = block.trim();
  const qn = t.match(/Question (\d+):/)[1];
  // Find Attrs
  const attrs = {};
  const ar = /\[([^\]]+)\]/g;
  let m;
  while ((m = ar.exec(t)) !== null) {
    const tag = m[1];
    const ci = tag.indexOf(':');
    if (ci > 0) attrs[tag.substring(0, ci).trim()] = tag.substring(ci + 1).trim();
  }
  const board = attrs['Board'] || '?';
  const nb = normBoard(board);
  
  // Check if this is a clean question or has gibberish
  const hasBad = /Ensure|Extract CQ|Math tutor|Panjeree|images of a test paper|Final Check/i.test(t);
  console.log(`Q${String(qn).padStart(2)} | ${board.padEnd(30)} | norm=${nb.padEnd(15)} | ${hasBad ? 'BAD' : 'OK'}`);
}
