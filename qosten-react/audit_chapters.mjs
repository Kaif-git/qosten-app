// ============================================================================
// CHAPTER AUDIT: Compare constants/chapters.ts with DB (Worker API) hierarchy
// Now handles both English and Bengali chapter names from API
// ============================================================================
import fs from 'fs';

// ---------------------------------------------------------------
// 1) Parse constants/chapters.ts
// ---------------------------------------------------------------
const constantsPath = 'C:\\Users\\DFIT\\MyExpoApp\\constants\\chapters.ts';
let content = fs.readFileSync(constantsPath, 'utf8');

function extractSection(content, subjectKey) {
  const startRegex = new RegExp(`(?:^|\\n)\\s*'?${subjectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'?\\s*:\\s*\\[`, 'm');
  const startMatch = startRegex.exec(content);
  if (!startMatch) return null;
  let startIdx = startMatch.index + startMatch[0].length;
  let depth = 1, endIdx = startIdx;
  while (endIdx < content.length && depth > 0) {
    if (content[endIdx] === '[') depth++;
    else if (content[endIdx] === ']') depth--;
    endIdx++;
  }
  return depth === 0 ? content.substring(startIdx, endIdx - 1) : null;
}

function parseChapters(section) {
  const chapters = [];
  const regex = /\{\s*id:\s*'([^']*)'\s*,\s*serial:\s*(\d+)\s*,\s*name:\s*'([^']*)'\s*,\s*nameBn:\s*'([^']*)'\s*\}/g;
  let m;
  while ((m = regex.exec(section)) !== null) {
    chapters.push({ id: m[1], serial: parseInt(m[2]), nameEn: m[3], nameBn: m[4] });
  }
  return chapters;
}

const SUBJECT_KEYS = ['biology', 'bgs', 'physics', 'higher-mathematics', 'mathematics', 'chemistry', 'ict', 'islam-religion', 'bangla-1', 'bangla-2'];

const constantsChapters = {};
for (const key of SUBJECT_KEYS) {
  const section = extractSection(content, key);
  if (section) {
    const chapters = parseChapters(section);
    constantsChapters[key] = chapters;
    console.log(`  ${key}: ${chapters.length} chapters`);
  } else {
    console.log(`  ${key}: NOT FOUND`);
  }
}

// ---------------------------------------------------------------
// 2) Load API hierarchy
// ---------------------------------------------------------------
const apiHierarchy = JSON.parse(fs.readFileSync('hierarchy_api.json', 'utf8'));

// Map: subjectId -> { apiSubjectEnglish, apiSubjectBengali }
const SUBJECT_NAME_MAP = {
  'biology':          { en: 'Biology', bn: 'জীববিজ্ঞান' },
  'bgs':              { en: 'Bangladesh and Global Studies', bn: 'বাংলাদেশ ও বিশ্বপরিচয়' },
  'physics':          { en: 'Physics', bn: 'পদার্থবিজ্ঞান' },
  'higher-mathematics':{ en: 'Higher Mathematics', bn: 'উচ্চতর গণিত' },
  'mathematics':      { en: 'Mathematics', bn: 'গণিত' },
  'chemistry':        { en: 'Chemistry', bn: 'রসায়ন' },
  'ict':              { en: 'Information and Communication Technology', bn: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
  'islam-religion':   { en: 'Islamic And Moral Studies', bn: 'ইসলাম শিক্ষা' },
  'bangla-1':         { en: null, bn: 'বাংলা প্রথম পত্র' },
  'bangla-2':         { en: null, bn: 'বাংলা দ্বিতীয় পত্র' },
};

function findApiSubject(subjId) {
  const names = SUBJECT_NAME_MAP[subjId];
  if (!names) return null;
  const result = { en: null, bn: null };
  for (const as of apiHierarchy) {
    if (names.en && as.name === names.en) result.en = as;
    if (names.bn && as.name === names.bn) result.bn = as;
    // Also check for different normalization
    if (names.en && !result.en && as.name.normalize('NFC') === names.en.normalize('NFC')) result.en = as;
    if (names.bn && !result.bn && as.name.normalize('NFC') === names.bn.normalize('NFC')) result.bn = as;
  }
  return result;
}

// ---------------------------------------------------------------
// 3) Compare utilities
// ---------------------------------------------------------------
function norm(s) {
  if (!s) return '';
  return s.normalize('NFC').replace(/[\s\-–—]/g, '').toLowerCase();
}

function toCodePoints(s) {
  if (!s) return '(empty)';
  return [...s].map(c => `${c} U+${c.codePointAt(0).toString(16).toUpperCase()}`).join('  ');
}

function deepCompare(a, b) {
  const aChars = [...a], bChars = [...b];
  const issues = [];
  for (let i = 0; i < Math.max(aChars.length, bChars.length); i++) {
    const ac = i < aChars.length ? aChars[i] : null;
    const bc = i < bChars.length ? bChars[i] : null;
    if (ac !== bc) {
      issues.push({
        index: i,
        constChar: ac ? `${ac} U+${ac.codePointAt(0).toString(16).toUpperCase()}` : '(end)',
        apiChar: bc ? `${bc} U+${bc.codePointAt(0).toString(16).toUpperCase()}` : '(end)',
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------
// 4) Compare: constants chapters vs API chapters
//    Compares English names against API English entry, 
//    and Bangla names against API Bengali entry
// ---------------------------------------------------------------
function compare(subjId, constChaps, apiSubjects) {
  const results = {
    enMatch: [], enEncDiff: [], enFuzzy: [], enConstOnly: [], enApiOnly: [],
    bnMatch: [], bnEncDiff: [], bnFuzzy: [], bnConstOnly: [], bnApiOnly: [],
  };

  // Compare English names
  if (apiSubjects.en) {
    const apiByName = {};
    for (const ac of apiSubjects.en.chapters) {
      apiByName[norm(ac.name)] = ac.name;
    }
    for (const cc of constChaps) {
      const key = norm(cc.nameEn);
      if (apiByName[key]) {
        if (cc.nameEn === apiByName[key] || cc.nameEn.normalize('NFC') === apiByName[key].normalize('NFC')) {
          results.enMatch.push(cc.nameEn);
        } else {
          results.enEncDiff.push({ constName: cc.nameEn, apiName: apiByName[key], diffs: deepCompare(cc.nameEn, apiByName[key]) });
        }
        delete apiByName[key];
      } else {
        let fuzzy = null;
        for (const [k, v] of Object.entries(apiByName)) {
          if (key.includes(k) || k.includes(key)) { fuzzy = v; delete apiByName[k]; break; }
        }
        if (fuzzy) results.enFuzzy.push({ constName: cc.nameEn, apiName: fuzzy });
        else results.enConstOnly.push(cc.nameEn);
      }
    }
    for (const v of Object.values(apiByName)) results.enApiOnly.push(v);
  }

  // Compare Bangla names
  if (apiSubjects.bn) {
    const apiByName = {};
    for (const ac of apiSubjects.bn.chapters) {
      apiByName[norm(ac.name)] = ac.name;
    }
    for (const cc of constChaps) {
      const key = norm(cc.nameBn);
      if (apiByName[key]) {
        if (cc.nameBn === apiByName[key] || cc.nameBn.normalize('NFC') === apiByName[key].normalize('NFC')) {
          results.bnMatch.push(cc.nameBn);
        } else {
          results.bnEncDiff.push({ constName: cc.nameBn, apiName: apiByName[key], diffs: deepCompare(cc.nameBn, apiByName[key]) });
        }
        delete apiByName[key];
      } else {
        let fuzzy = null;
        for (const [k, v] of Object.entries(apiByName)) {
          if (key.includes(k) || k.includes(key)) { fuzzy = v; delete apiByName[k]; break; }
        }
        if (fuzzy) results.bnFuzzy.push({ constName: cc.nameBn, apiName: fuzzy });
        else results.bnConstOnly.push(cc.nameBn);
      }
    }
    for (const v of Object.values(apiByName)) results.bnApiOnly.push(v);
  }

  return results;
}

// ---------------------------------------------------------------
// 5) Run
// ---------------------------------------------------------------
console.log('='.repeat(90));
console.log('CHAPTER AUDIT: Constants (chapters.ts) vs DB (Worker API)');
console.log('='.repeat(90));

const allIssues = [];
const summary = {};

for (const [subjId, constChaps] of Object.entries(constantsChapters)) {
  if (!constChaps || constChaps.length === 0) continue;
  
  const apiSubjects = findApiSubject(subjId);
  if (!apiSubjects || (!apiSubjects.en && !apiSubjects.bn)) {
    console.log(`\n❌ ${subjId}: Not found in API!`);
    continue;
  }

  const apiInfo = [];
  if (apiSubjects.en) apiInfo.push(`EN: "${apiSubjects.en.name}" (${apiSubjects.en.chapters.length}ch)`);
  if (apiSubjects.bn) apiInfo.push(`BN: "${apiSubjects.bn.name}" (${apiSubjects.bn.chapters.length}ch)`);
  
  console.log(`\n📚 ${subjId} (Constants: ${constChaps.length} ch.)`);
  console.log(`   API: ${apiInfo.join(', ')}`);

  const result = compare(subjId, constChaps, apiSubjects);

  const subjSummary = { constChaps: constChaps.length };
  
  // Report English comparison
  if (apiSubjects.en) {
    subjSummary.enApiChaps = apiSubjects.en.chapters.length;
    subjSummary.enMatch = result.enMatch.length;
    subjSummary.enEncDiff = result.enEncDiff.length;
    subjSummary.enFuzzy = result.enFuzzy.length;
    subjSummary.enConstOnly = result.enConstOnly.length;
    subjSummary.enApiOnly = result.enApiOnly.length;

    console.log(`\n   [ENGLISH comparison]`);
    if (result.enEncDiff.length) {
      console.log(`   ⚠️  ENCODING DIFFERENCES:`);
      for (const ed of result.enEncDiff) {
        console.log(`      "${ed.constName}" vs "${ed.apiName}"`);
        for (const d of ed.diffs.slice(0, 3)) {
          console.log(`        pos ${d.index}: const=${d.constChar}  api=${d.apiChar}`);
        }
        allIssues.push({ type: 'ENCODING_EN', subject: subjId, constName: ed.constName, apiName: ed.apiName });
      }
    }
    for (const fm of result.enFuzzy) {
      console.log(`   🔀 FUZZY: "${fm.constName}" ↔ "${fm.apiName}"`);
      allIssues.push({ type: 'FUZZY_EN', subject: subjId, constName: fm.constName, apiName: fm.apiName });
    }
    for (const c of result.enConstOnly) {
      console.log(`   ❌ IN CONSTANTS ONLY (EN): "${c}"`);
      allIssues.push({ type: 'CONSTANTS_ONLY_EN', subject: subjId, name: c });
    }
    for (const c of result.enApiOnly) {
      console.log(`   ❌ IN API ONLY (EN): "${c}"`);
      console.log(`      Characters: ${toCodePoints(c)}`);
      allIssues.push({ type: 'API_ONLY_EN', subject: subjId, name: c });
    }
    if (result.enEncDiff.length === 0 && result.enFuzzy.length === 0 && result.enConstOnly.length === 0 && result.enApiOnly.length === 0) {
      console.log(`   ✅ All ${constChaps.length} English names match API`);
    }
  }

  // Report Bangla comparison
  if (apiSubjects.bn) {
    subjSummary.bnApiChaps = apiSubjects.bn.chapters.length;
    subjSummary.bnMatch = result.bnMatch.length;
    subjSummary.bnEncDiff = result.bnEncDiff.length;
    subjSummary.bnFuzzy = result.bnFuzzy.length;
    subjSummary.bnConstOnly = result.bnConstOnly.length;
    subjSummary.bnApiOnly = result.bnApiOnly.length;

    console.log(`\n   [BANGLA comparison]`);
    if (result.bnEncDiff.length) {
      console.log(`   ⚠️  ENCODING DIFFERENCES:`);
      for (const ed of result.bnEncDiff) {
        console.log(`      "${ed.constName}" vs "${ed.apiName}"`);
        for (const d of ed.diffs.slice(0, 3)) {
          console.log(`        pos ${d.index}: const=${d.constChar}  api=${d.apiChar}`);
        }
        allIssues.push({ type: 'ENCODING_BN', subject: subjId, constName: ed.constName, apiName: ed.apiName });
      }
    }
    for (const fm of result.bnFuzzy) {
      console.log(`   🔀 FUZZY: "${fm.constName}" ↔ "${fm.apiName}"`);
      allIssues.push({ type: 'FUZZY_BN', subject: subjId, constName: fm.constName, apiName: fm.apiName });
    }
    for (const c of result.bnConstOnly) {
      console.log(`   ❌ IN CONSTANTS ONLY (BN): "${c}"`);
      allIssues.push({ type: 'CONSTANTS_ONLY_BN', subject: subjId, name: c });
    }
    for (const c of result.bnApiOnly) {
      console.log(`   ❌ IN API ONLY (BN): "${c}"`);
      console.log(`      Characters: ${toCodePoints(c)}`);
      allIssues.push({ type: 'API_ONLY_BN', subject: subjId, name: c });
    }
    if (result.bnEncDiff.length === 0 && result.bnFuzzy.length === 0 && result.bnConstOnly.length === 0 && result.bnApiOnly.length === 0) {
      console.log(`   ✅ All ${constChaps.length} Bengali names match API`);
    }
  }

  summary[subjId] = subjSummary;
}

// ---------------------------------------------------------------
// Summary
// ---------------------------------------------------------------
console.log('\n' + '='.repeat(90));
console.log('SUMMARY');
console.log('='.repeat(90));

console.log('\nSubject overview:');
console.log('  Subj'.padEnd(22), 'Const', 'EnAPI', 'BNAPI', 'Issues');
console.log('  ' + '-'.repeat(60));
for (const [subj, ss] of Object.entries(summary)) {
  const totalIssues = allIssues.filter(i => i.subject === subj).length;
  console.log(`  ${subj}`.padEnd(22), 
    `${ss.constChaps}`.padStart(5),
    `${ss.enApiChaps || '-'}`.padStart(5),
    `${ss.bnApiChaps || '-'}`.padStart(5),
    `${totalIssues}`.padStart(8)
  );
}

const typeCounts = {};
for (const issue of allIssues) {
  typeCounts[issue.type] = (typeCounts[issue.type] || 0) + 1;
}

console.log('\nIssues by type (EN = English, BN = Bengali):');
for (const [type, count] of Object.entries(typeCounts)) {
  console.log(`  ${type}: ${count}`);
}

console.log(`\nTotal issues: ${allIssues.length}`);

// Detailed per-subject issue lists
console.log('\n' + '='.repeat(90));
console.log('DETAILED ISSUES');
console.log('='.repeat(90));

for (const [subj, constChaps] of Object.entries(constantsChapters)) {
  if (!constChaps || constChaps.length === 0) continue;
  const subjIssues = allIssues.filter(i => i.subject === subj);
  if (subjIssues.length === 0) continue;
  
  console.log(`\n📌 ${subj}:`);
  for (const issue of subjIssues) {
    if (issue.type.includes('API_ONLY')) {
      console.log(`  ${issue.type}: "${issue.name}"`);
    } else if (issue.type.includes('CONSTANTS_ONLY')) {
      console.log(`  ${issue.type}: "${issue.name}"`);
    } else if (issue.type.includes('FUZZY')) {
      console.log(`  ${issue.type}: "${issue.constName}" ↔ "${issue.apiName}"`);
    } else if (issue.type.includes('ENCODING')) {
      console.log(`  ${issue.type}: "${issue.constName}" ≠ "${issue.apiName}"`);
    }
  }
}

fs.writeFileSync('chapter_audit_report.json', JSON.stringify({ allIssues, summary }, null, 2), 'utf8');
console.log('\nFull report saved to chapter_audit_report.json');
