const fs = require('fs');
const path = require('path');

const baseDir = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics';

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
  for (const [bn, en] of Object.entries(boardNorm)) s = s.replace(bn, en);
  s = s.replace(/[১২৩৪৫৬৭৮৯০]|202\d/g, '').trim();
  if (s.includes('ক্যাডেট') || s.includes('cadet')) s = 'cadetcollege';
  s = s.replace(/গার্লস/, '').replace(/girls['']?/, '').trim();
  const nameMap = {
    'dhaka': 'dhaka', 'sylhet': 'sylhet', 'barishal': 'barishal',
    'mymensingh': 'mymensingh', 'rajshahi': 'rajshahi', 'cumilla': 'cumilla',
    'chattogram': 'chattogram', 'dinajpur': 'dinajpur', 'jashore': 'jashore',
    'mirzapur': 'mirzapur', 'joypurhat': 'joypurhat'
  };
  for (const [k, v] of Object.entries(nameMap)) if (s.includes(k)) return v;
  return s;
}

function parseQuestions(rawText, format) {
  let blocks;
  if (format === 'bangla') {
    let norm = rawText.replace(/([^\n])(প্রশ্ন\s*[০-৯]+:)/g, '$1\n$2')
                      .replace(/([^\n])(Question\s+\d+:)/g, '$1\n$2');
    blocks = norm.split(/\n(?=প্রশ্ন\s*[০-৯]+:|Question\s+\d+:)/).filter(b => b.trim());
  } else {
    blocks = rawText.split(/(?=Question \d+:\n\[ID: \d+\]\n\[Subject: [^\]]+\]\n\[Chapter: [^\]]+\]\n\[Lesson: [^\]]+\]\n\[Board: [^\]]+\])/).filter(b => b.trim() && /^Question \d+:\n\[ID: \d+\]/.test(b.trim()));
  }

  const results = [];
  for (const block of blocks) {
    const text = block.trim();
    const isOld = /^প্রশ্ন/.test(text);
    if (!isOld && !/^Question/.test(text)) continue;

    const ui = text.indexOf('উত্তর:');
    const ai = text.indexOf('Answer:');
    const splitPos = ui >= 0 && ai >= 0 ? Math.min(ui, ai) : ui >= 0 ? ui : ai >= 0 ? ai : -1;
    if (splitPos < 0) continue;

    const qp = text.substring(0, splitPos);
    const ap = text.substring(splitPos + (splitPos === ui ? 5 : 7));

    let qn;
    if (isOld) {
      const m = qp.match(/প্রশ্ন\s*([০-৯]+):/);
      if (!m) continue;
      qn = parseInt(toEn(m[1]));
    } else {
      const m = text.match(/Question\s*(\d+):/);
      if (!m) continue;
      qn = parseInt(m[1]);
    }

    const attrs = {};
    const ar = /\[([^\]]+)\]/g;
    let m;
    while ((m = ar.exec(qp)) !== null) {
      const t = m[1];
      const ci = t.indexOf(':');
      if (ci > 0) {
        const k = t.substring(0, ci).trim();
        const v = t.substring(ci + 1).trim();
        const keyMap = { 'আইডি': 'ID', 'বিষয়': 'Subject', 'অধ্যায়': 'Chapter', 'পাঠ': 'Lesson', 'বোর্ড': 'Board' };
        attrs[keyMap[k] || k] = v;
      }
    }

    let stemText = qp.replace(/প্রশ্ন\s*[০-৯]+:/, '').replace(/Question\s*\d+:/, '').replace(/\[([^\]]+)\]/g, '').trim();
    stemText = stemText.replace(/^স্টেম:/, '').replace(/^Stem:/, '').replace(/^মূল প্রশ্ন:/, '').replace(/^প্রদত্ত:/, '').trim();

    let aqi = stemText.indexOf('A. ');
    let bqi = stemText.indexOf('B. ');
    let cqi = stemText.indexOf('C. ');
    let useBangla = false;

    if (aqi < 0 || bqi < 0 || cqi < 0) {
      aqi = stemText.indexOf('ক. ');
      bqi = stemText.indexOf('খ. ');
      cqi = stemText.indexOf('গ. ');
      useBangla = aqi >= 0 && bqi >= 0 && cqi >= 0;
    }
    if (aqi < 0 || bqi < 0 || cqi < 0) continue;

    const parts = {
      stem: stemText.substring(0, aqi).trim(),
      A: useBangla ? 'ক. ' + stemText.substring(aqi + 3, bqi).trim() : stemText.substring(aqi, bqi).trim(),
      B: useBangla ? 'খ. ' + stemText.substring(bqi + 3, cqi).trim() : stemText.substring(bqi, cqi).trim(),
      C: useBangla ? 'গ. ' + stemText.substring(cqi + 3).trim() : stemText.substring(cqi).trim()
    };

    let ansText = ap.trim();
    let aai = ansText.indexOf('A. ');
    let abi = ansText.indexOf('B. ');
    let aci = ansText.indexOf('C. ');
    let ansBangla = false;

    if (aai < 0 || abi < 0 || aci < 0) {
      aai = ansText.indexOf('ক. ');
      abi = ansText.indexOf('খ. ');
      aci = ansText.indexOf('গ. ');
      ansBangla = aai >= 0 && abi >= 0 && aci >= 0;
    }
    if (aai < 0 || abi < 0 || aci < 0) continue;

    const answers = {
      A: ansBangla ? 'A. ' + ansText.substring(aai + 3, abi).trim() : ansText.substring(aai, abi).trim(),
      B: ansBangla ? 'B. ' + ansText.substring(abi + 3, aci).trim() : ansText.substring(abi, aci).trim(),
      C: ansBangla ? 'C. ' + ansText.substring(aci + 3).trim() : ansText.substring(aci).trim()
    };

    const board = normBoard(attrs['Board'] || attrs['বোর্ড'] || '');
    results.push({ qn, attrs, parts, answers, board, rawBoard: attrs['Board'] || attrs['বোর্ড'] || '' });
  }
  return results;
}

const bad = [/Ensure/i, /Extract CQ/i, /Math tutor/i, /No vague filler/i,
  /Inline math/i, /specific layout/i, /One step per line/i,
  /Handle missing/i, /Verify and correct/i, /Beginner-friendly/i,
  /Self-Correction/i, /Final Check/i, /Panjeree/i, /Decision:/i,
  /source is empty/i, /is unreadable/i, /still extract/i,
  /Correct format/i, /I will list/i, /I'll stick/i, /to be safe/i,
  /Keep it/i, /images of a test paper/i, /No source/i, /Reference page/i,
  /^3 pages of/i, /^Page \d+:/i, /^Subject, Chapter/i, /^Two images/i,
  /Incorrect/i, /Check readability/i, /Check formatting/i,
  /Let's (check|verify|follow|look)/i, /Verdict:/i, /mark it as/i,
  /treat this as/i, /the source says/i, /The solution says/i,
  /This (is|would be) too ambiguous/i, /I will (check|treat|mark)/i,
  /^        \*   /, /^    \*   /, /\*\*Question \d+/,
  /\. Correct\.$/i,
  /Extract Creative Questions?/i, /Questions \d+,/i,
  /The user wants me to (extract|list|get)/i,
  /scanned PDF/i, /images? of a/i];

const noContent = [/no answer provided/i, /no question provided/i, /no stem/i];
const hasNoContent = q => {
  const all = [q.parts.stem, q.parts.A, q.parts.B, q.parts.C,
    q.answers.A, q.answers.B, q.answers.C].join(' ');
  return noContent.some(p => p.test(all));
};

function fmt(q, lang) {
  const isBan = lang === 'bangla';
  let out = `Question ${String(q.qn).padStart(2, '0')}:\n`;
  const keys = isBan
    ? ['ID', 'বিষয়', 'অধ্যায়', 'পাঠ', 'বোর্ড']
    : ['ID', 'Subject', 'Chapter', 'Lesson', 'Board'];
  const map = isBan
    ? { 'ID': 'ID', 'বিষয়': 'Subject', 'অধ্যায়': 'Chapter', 'পাঠ': 'Lesson', 'বোর্ড': 'Board' }
    : { 'ID': 'ID', 'Subject': 'Subject', 'Chapter': 'Chapter', 'Lesson': 'Lesson', 'Board': 'Board' };
  for (const k of keys) {
    const val = q.attrs[map[k]] || q.attrs[k] || q.attrs[k.toLowerCase()] || '';
    if (val) out += `[${k}: ${val}]\n`;
  }
  out += `Stem: ${q.parts.stem}\n`;
  out += `${q.parts.A}\n${q.parts.B}\n${q.parts.C}\n`;
  out += `Answer:\n${q.answers.A}\n${q.answers.B}\n${q.answers.C}`;
  return out;
}

// Process each chapter
const chapters = fs.readdirSync(baseDir)
  .filter(f => /^Ch\d+_CQ$/.test(f) && fs.statSync(path.join(baseDir, f)).isDirectory())
  .sort((a, b) => {
    const na = parseInt(a.match(/\d+/)[0]);
    const nb = parseInt(b.match(/\d+/)[0]);
    return na - nb;
  });

let totalOk = 0, totalFail = 0;

for (const ch of chapters) {
  const chDir = path.join(baseDir, ch);
  const banFile = path.join(chDir, `${ch}_BANGLA.txt`);
  const engFile = path.join(chDir, `${ch}_ENGLISH.txt`);

  if (!fs.existsSync(banFile) || !fs.existsSync(engFile)) {
    console.log(`${ch}: missing input files`);
    totalFail++;
    continue;
  }

  const banRaw = fs.readFileSync(banFile, 'utf-8');
  const engRaw = fs.readFileSync(engFile, 'utf-8');

  const banQs = parseQuestions(banRaw, 'bangla');
  const engQs = parseQuestions(engRaw, 'english');

  // Remove gibberish lines from English
  for (const q of engQs) {
    for (const key of ['stem', 'A', 'B', 'C']) {
      q.parts[key] = q.parts[key].split('\n').filter(l => !bad.some(p => p.test(l))).join('\n');
    }
    for (const key of ['A', 'B', 'C']) {
      q.answers[key] = q.answers[key].split('\n').filter(l => !bad.some(p => p.test(l))).join('\n');
    }
  }

  // Match by (qn + board)
  const banKeyed = new Map();
  for (const q of banQs) banKeyed.set(q.qn + '|' + q.board, q);
  const engKeyed = new Map();
  for (const q of engQs) engKeyed.set(q.qn + '|' + q.board, q);

  let matches = [];
  for (const [k, bq] of banKeyed) {
    if (engKeyed.has(k)) matches.push({ key: k, ban: bq, eng: engKeyed.get(k) });
  }

  // Drop matches with missing content
  const filtered = matches.filter(m => !hasNoContent(m.ban) && !hasNoContent(m.eng));
  const dropped = matches.length - filtered.length;
  matches = filtered;

  matches.sort((a, b) => {
    if (a.ban.qn !== b.ban.qn) return a.ban.qn - b.ban.qn;
    return a.ban.board.localeCompare(b.ban.board);
  });

  let banOut = '', engOut = '';
  for (const m of matches) {
    banOut += fmt(m.ban, 'bangla') + '\n\n---\n\n';
    engOut += fmt(m.eng, 'english') + '\n\n---\n\n';
  }
  banOut = banOut.replace(/\n\n---\n\n$/, '').trim() + '\n';
  engOut = engOut.replace(/\n\n---\n\n$/, '').trim() + '\n';

  // Final scrub — keep only proper question blocks, drop orphan instruction text
  for (const p of bad) {
    engOut = engOut.split('\n').filter(l => !p.test(l)).join('\n');
  }
  // Remove blocks between --- separators that don't start with a Question N: header
  engOut = engOut.split(/\n---\n/).map(b => {
    const t = b.trim();
    if (t && !/^Question \d+:\n/.test(t)) return '';
    return b;
  }).join('\n---\n');
  engOut = engOut.replace(/\n{3,}/g, '\n\n');
  engOut = engOut.replace(/^\n+|\n+$/g, '');
  // Remove consecutive separators
  engOut = engOut.replace(/(\n---\n){2,}/g, '\n---\n');

  const banNew = path.join(chDir, `${ch}_BANGLA_new.txt`);
  const engNew = path.join(chDir, `${ch}_ENGLISH_new.txt`);
  fs.writeFileSync(banNew, banOut, 'utf-8');
  fs.writeFileSync(engNew, engOut, 'utf-8');

  const bCount = (banOut.match(/^Question/gm) || []).length;
  const eCount = (engOut.match(/^Question/gm) || []).length;
  const ok = bCount === eCount;

  console.log(`${ch}: ${banQs.length} parsed → ${matches.length} matched → ${bCount} written ${ok ? '✓' : '✗'}${dropped ? ` (${dropped} no-answer)` : ''}`);
  if (!ok) totalFail++; else totalOk++;
}

console.log(`\nDone. ${totalOk} OK, ${totalFail} failed`);
