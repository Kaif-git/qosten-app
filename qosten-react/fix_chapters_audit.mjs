// ============================================================================
// FIX CHAPTERS: Update constants/chapters.ts based on API hierarchy audit
// - Bangla 1 & 2: Replace entirely with API chapters
// - Other subjects: Fix ও→এবং, add/remove chapters, fix encoding
// Always keeps backup and change log
// ============================================================================
import fs from 'fs';

const CONSTANTS_PATH = 'C:\\Users\\DFIT\\MyExpoApp\\constants\\chapters.ts';
const API_PATH = 'hierarchy_api.json';
const LOG_PATH = 'chapters_fix_log.txt';

// Read current file
const original = fs.readFileSync(CONSTANTS_PATH, 'utf8');
const apiHierarchy = JSON.parse(fs.readFileSync(API_PATH, 'utf8'));

// ============================================================
// API helper
// ============================================================
function findApi(name) {
  const found = apiHierarchy.find(s => s.name === name);
  if (found) return found;
  return apiHierarchy.find(s => s.name.normalize('NFC') === name.normalize('NFC'));
}

function norm(s) {
  if (!s) return '';
  return s.normalize('NFC').replace(/[\s\-–—]/g, '').toLowerCase();
}

// ============================================================
// Build chapter mapping from API
// For each BN chapter, find matching EN chapter (by position or norm)
// ============================================================
function buildChapters(bnChapters, enChapters) {
  const result = [];
  const enPool = enChapters ? [...enChapters] : [];

  for (const bn of bnChapters) {
    const bnName = bn.name;
    const bnNorm = norm(bnName);

    // Find matching EN chapter by normalized name
    let enName = '';
    const matchIdx = enPool.findIndex(ec => norm(ec.name) === bnNorm);
    if (matchIdx >= 0) {
      enName = enPool[matchIdx].name;
      enPool.splice(matchIdx, 1); // Remove matched
    }

    result.push({
      nameBn: bnName,
      nameEn: enName || bnName,
    });
  }

  return result;
}

// ============================================================
// Subject definitions from API
// ============================================================
const subjectDefs = {
  'bangla-1': {
    bnSource: 'বাংলা প্রথম পত্র',
    enSource: null,
  },
  'bangla-2': {
    bnSource: 'বাংলা দ্বিতীয় পত্র',
    enSource: null,
  },
  'biology': {
    bnSource: 'জীববিজ্ঞান',
    enSource: 'Biology',
  },
  'bgs': {
    bnSource: 'বাংলাদেশ ও বিশ্বপরিচয়',
    enSource: 'Bangladesh and Global Studies',
  },
  'physics': {
    bnSource: 'পদার্থবিজ্ঞান',
    enSource: 'Physics',
  },
  'higher-mathematics': {
    bnSource: 'উচ্চতর গণিত',
    enSource: 'Higher Mathematics',
  },
  'mathematics': {
    bnSource: 'গণিত',
    enSource: 'Mathematics',
  },
  'chemistry': {
    bnSource: 'রসায়ন',
    enSource: 'Chemistry',
  },
  'ict': {
    bnSource: 'তথ্য ও যোগাযোগ প্রযুক্তি',
    enSource: 'Information and Communication Technology',
  },
  'islam-religion': {
    bnSource: 'ইসলামিক শিক্ষা',
    enSource: 'Islamic And Moral Studies',
  },
};

// ============================================================
// Generate new chapter content for each subject
// ============================================================
const changeLog = [];
const chapters = {};

for (const [subjId, def] of Object.entries(subjectDefs)) {
  const bnApi = findApi(def.bnSource);
  if (!bnApi) {
    console.error(`❌ ${subjId}: Bengali API "${def.bnSource}" not found!`);
    continue;
  }
  const enApi = def.enSource ? findApi(def.enSource) : null;

  const entries = buildChapters(bnApi.chapters, enApi ? enApi.chapters : null);
  chapters[subjId] = entries;

  // Log changes
  changeLog.push(`\n=== ${subjId} (${entries.length} chapters) ===`);
  entries.forEach((e, i) => {
    const enStr = e.nameEn ? `EN: "${e.nameEn}"` : '';
    changeLog.push(`  ${i+1}. BN: "${e.nameBn}"${enStr ? '  ' + enStr : ''}`);
  });
}

// ============================================================
// Generate the TypeScript file content
// ============================================================
function generateTS(subjId, entries) {
  const lines = entries.map((e, i) => {
    const id = `${subjId}-${i + 1}`.replace(/[^a-zA-Z0-9-]/g, '');
    const en = e.nameEn.replace(/'/g, "\\'");
    const bn = e.nameBn.replace(/'/g, "\\'");
    return `    { id: '${id}', serial: ${i + 1}, name: '${en}', nameBn: '${bn}' }`;
  });
  return lines.join(',\n');
}

// ============================================================
// Build the new file content
// Preserve the header and structure of the original file
// ============================================================
const header = `// ============================================================================
// STANDARDIZED CHAPTER DEFINITIONS
// Canonical list of chapters for core subjects in chronological order
// Based on Cloudflare Worker API hierarchy and user-provided order
// AUTO-FIXED from API on ${new Date().toISOString().split('T')[0]}
// ============================================================================

export interface ChapterDefinition {
  id: string;
  serial: number;
  name: string;
  nameBn: string;
}

export const CHAPTERS: Record<string, ChapterDefinition[]> = {`;

const footer = `
import { normalizeSubject } from './subjects';

/**
 * Gets the standardized chapter name and serial number
 * @param subjectId - Canonical subject ID or free-text name
 * @param chapterName - Chapter name as stored in DB
 * @param lang - 'en' or 'bn'
 * @returns Object with serial and translated name
 */
export function getStandardizedChapter(subjectId: string, chapterName: string, lang: 'en' | 'bn' = 'en'): { id?: string, serial?: number, name: string } {
  const normalizedId = normalizeSubject(subjectId) || subjectId.toLowerCase().trim();
  const subjectChapters = CHAPTERS[normalizedId];
  
  if (!subjectChapters) {
    console.log(\`⚠️ [getStandardizedChapter] No definitions found for subject: "\${subjectId}" (normalized: "\${normalizedId}")\`);
    return { name: chapterName };
  }

  const targetLower = chapterName.trim().toLowerCase();
  
  // Also try matching without parentheses content
  const stripParentheses = (s: string) => s.replace(/\s*\\(.*?\\)\s*/g, ' ').trim().toLowerCase();
  const searchStripped = stripParentheses(chapterName);

  // New robust normalization for fuzzy matching
  // Strips 'the', 'and', commas, and extra spaces while PRESERVING Bangla characters
  const normalizeForFuzzy = (s: string) => {
    return s.toLowerCase()
      .replace(/,\\s*/g, ' ')           // Replace commas with spaces
      .replace(/\\s+/g, ' ')            // Normalize multiple spaces
      .replace(/\\bthe\\b/g, '')         // Remove 'the'
      .replace(/\\band\\b/g, '&')        // Standardize 'and' to '&'
      // Only remove special characters, keep alphanumeric and Bangla range (\\u0980-\\u09FF)
      .replace(/[^\\w\\s&\\u0980-\\u09FF]/g, '') 
      .trim();
  };

  const fuzzyTarget = normalizeForFuzzy(chapterName);
  
  // 0. ID match
  let match = subjectChapters.find(c => c.id === chapterName);

  // 1. Exact match (English or Bangla)
  if (!match) {
    match = subjectChapters.find(c => 
      c.name.toLowerCase() === targetLower || 
      c.nameBn.trim().toLowerCase() === targetLower
    );
  }

  // 2. Stripped exact match (without parentheses)
  if (!match) {
    match = subjectChapters.find(c => 
      stripParentheses(c.name) === searchStripped || 
      stripParentheses(c.nameBn) === searchStripped
    );
  }

  // 3. Robust normalized match
  if (!match) {
    match = subjectChapters.find(c => 
      normalizeForFuzzy(c.name) === fuzzyTarget ||
      normalizeForFuzzy(c.nameBn) === fuzzyTarget
    );
  }

  // 4. Very specific fuzzy logic for common variations
  if (!match) {
    match = subjectChapters.find(c => {
      const nameLower = c.name.toLowerCase();
      
      // Only allow "contains" if it's a very significant portion or specific known cases
      if (Math.abs(nameLower.length - targetLower.length) < 5) {
        return nameLower.includes(targetLower) || targetLower.includes(nameLower);
      }
      return false;
    });
  }

  if (match) {
    return {
      id: match.id,
      serial: match.serial,
      name: lang === 'bn' ? match.nameBn : match.name
    };
  }

  return { name: chapterName };
}

/**
 * Gets all standardized chapters for a subject
 * @param subjectId - Canonical subject ID
 * @returns Array of chapter definitions
 */
export function getSubjectChapters(subjectId: string): ChapterDefinition[] {
  return CHAPTERS[subjectId] || [];
}`;

// Generate the body
const bodyLines = [];
for (const [subjId, entries] of Object.entries(chapters)) {
  const subjKey = /^[a-z]/.test(subjId) ? subjId : `'${subjId}'`;
  bodyLines.push(`  ${subjKey}: [`);
  const chapterLines = entries.map((e, i) => {
    const id = `${subjId}-${i + 1}`.replace(/[^a-zA-Z0-9-]/g, '');
    const en = e.nameEn.replace(/'/g, "\\'");
    const bn = e.nameBn.replace(/'/g, "\\'");
    return `    { id: '${id}', serial: ${i + 1}, name: '${en}', nameBn: '${bn}' }`;
  });
  bodyLines.push(chapterLines.join(',\n'));
  bodyLines.push('  ],');
}

const body = bodyLines.join('\n');

const newContent = header + '\n' + body + '\n' + footer + '\n';

// ============================================================
// Write backup, new file, and change log
// ============================================================
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = CONSTANTS_PATH + '.backup.' + timestamp;
fs.writeFileSync(backupPath, original, 'utf8');
console.log(`✅ Backup saved: ${backupPath}`);

fs.writeFileSync(CONSTANTS_PATH, newContent, 'utf8');
console.log(`✅ Updated: ${CONSTANTS_PATH}`);

const log = `=== Chapters Fix Log ===
Date: ${new Date().toISOString()}
Backup: ${backupPath}

Changes:
${changeLog.join('\n')}

=== End of Log ===
`;
fs.writeFileSync(LOG_PATH, log, 'utf8');
console.log(`✅ Change log saved: ${LOG_PATH}`);

// Print summary
console.log('\n=== SUMMARY ===');
for (const [subjId, entries] of Object.entries(chapters)) {
  console.log(`  ${subjId}: ${entries.length} chapters`);
}
