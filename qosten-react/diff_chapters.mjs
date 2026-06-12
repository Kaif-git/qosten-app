// Diff current chapters.ts vs API hierarchy for non-Bangla subjects
import fs from 'fs';

const current = fs.readFileSync('C:\\Users\\DFIT\\MyExpoApp\\constants\\chapters.ts', 'utf8');
const api = JSON.parse(fs.readFileSync('hierarchy_api.json', 'utf8'));

function norm(s) {
  return s.normalize('NFC').replace(/[\s\u200c\u200d]/g, '').toLowerCase();
}

// Extract the CHAPTERS object content
const objStart = current.indexOf('CHAPTERS: Record<string, ChapterDefinition[]> = {');
if (objStart < 0) throw new Error('Cannot find CHAPTERS start');
let objContent = current.slice(objStart);
// Find matching closing brace
let depth = 0;
let braceEnd = 0;
for (let i = 0; i < objContent.length; i++) {
  if (objContent[i] === '{') depth++;
  if (objContent[i] === '}') { depth--; if (depth === 0) { braceEnd = i + 1; break; } }
}
const objStr = objContent.slice(0, braceEnd);

const subjKeys = ['biology', 'bgs', 'physics', 'higher-mathematics', 'mathematics', 'chemistry', 'ict', 'islam-religion', 'bangla-1', 'bangla-2'];
const currentChapters = {};

for (const sk of subjKeys) {
  const re = new RegExp(`['"]?${sk}['"]?\\s*:\\s*\\[([\\s\\S]*?)\\]\\s*,`);
  const m = objStr.match(re);
  if (!m) { console.log(`⚠️ Could not find block for ${sk}`); continue; }
  const block = m[1];
  
  const bnMatches = [...block.matchAll(/nameBn:\s*'([^']+)'/g)];
  const enMatches = [...block.matchAll(/name:\s*'([^']+)'/g)];
  const idMatches = [...block.matchAll(/id:\s*'([^']+)'/g)];
  const serMatches = [...block.matchAll(/serial:\s*(\d+)/g)];
  
  currentChapters[sk] = [];
  for (let i = 0; i < bnMatches.length; i++) {
    currentChapters[sk].push({
      id: idMatches[i]?.[1] || '',
      serial: parseInt(serMatches[i]?.[1] || '0'),
      nameEn: enMatches[i]?.[1] || '',
      nameBn: bnMatches[i][1],
    });
  }
}

// Subject mapping
const subjectMap = {
  'biology': { bn: 'জীববিজ্ঞান', en: 'Biology' },
  'bgs': { bn: 'বাংলাদেশ ও বিশ্বপরিচয়', en: 'Bangladesh and Global Studies' },
  'physics': { bn: 'পদার্থবিজ্ঞান', en: 'Physics' },
  'higher-mathematics': { bn: 'উচ্চতর গণিত', en: 'Higher Mathematics' },
  'mathematics': { bn: 'গণিত', en: 'Mathematics' },
  'chemistry': { bn: 'রসায়ন', en: 'Chemistry' },
  'ict': { bn: 'তথ্য ও যোগাযোগ প্রযুক্তি', en: 'Information and Communication Technology' },
  'islam-religion': { bn: 'ইসলামিক শিক্ষা', en: 'Islamic And Moral Studies' },
};

function findApi(name) {
  const found = api.find(s => s.name === name);
  if (found) return found;
  return api.find(s => s.name.normalize('NFC') === name.normalize('NFC'));
}

// Compare
console.log('=== DIFF REPORT: Current nameBn vs API Bengali chapters ===\n');

for (const [subjId, def] of Object.entries(subjectMap)) {
  const bnApi = findApi(def.bn);
  if (!bnApi) { console.log(`❌ ${subjId}: API not found`); continue; }
  
  const current = currentChapters[subjId] || [];
  const apiBNChapters = bnApi.chapters.map(c => c.name);
  
  console.log(`--- ${subjId} (current: ${current.length}, API: ${apiBNChapters.length}) ---`);
  
  // Build searchable API set
  const apiNormMap = {};
  for (const name of apiBNChapters) {
    apiNormMap[norm(name)] = name;
  }
  
  // Check each current chapter against API
  for (const ch of current) {
    const n = norm(ch.nameBn);
    const apiMatch = apiNormMap[n];
    
    if (apiMatch && apiMatch !== ch.nameBn) {
      console.log(`  DIFF: "${ch.nameBn}" → "${apiMatch}" (names differ)`);
    } else if (!apiMatch) {
      console.log(`  NOT FOUND in API: "${ch.nameBn}" (EN: "${ch.nameEn}")`);
    }
  }
  
  // Check API chapters not in current
  const currentNorms = new Set(current.map(c => norm(c.nameBn)));
  for (const name of apiBNChapters) {
    if (!currentNorms.has(norm(name))) {
      console.log(`  NEW/UNMATCHED API: "${name}"`);
    }
  }
  
  console.log('');
}
