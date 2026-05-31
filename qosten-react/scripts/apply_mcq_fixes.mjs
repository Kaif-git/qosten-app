import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = 'https://questions-api.edventure.workers.dev';

// --- Config ---
const INPUT_FILE = join(__dirname, '..', 'mcq_processed', 'all_outputs.txt');
const BACKUP_DIR = join(__dirname, '..', 'mcq_processed', 'backups');
const LOG_FILE = join(__dirname, '..', 'mcq_processed', 'fix_log.txt');
const SUMMARY_FILE = join(__dirname, '..', 'mcq_processed', 'fix_summary.json');

if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

// --- Helpers ---
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

// --- Parse the actions file ---
function parseActions(text) {
  const actions = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  for (const raw of lines) {
    if (/^all correct$/i.test(raw)) continue;

    let id, action, param;

    // Pattern 1: [ID] action or [ID] action: param
    //   Handles: [1767329574852] delete
    //            [1767329615034] correct: a
    //            [1767329573026] logical error  (multi-word action)
    let m = raw.match(/^\[(\d+)\]\s*(.+?)(?:\s*[:]\s*(\w+))?$/);
    if (m) {
      id = m[1]; action = m[2].trim(); param = m[3];
      actions.push({ id, action, param, raw });
      continue;
    }

    // Pattern 2: ID: ID action  or  ID: ID action: param
    m = raw.match(/^ID:\s*(\d+)\s+(.+?)(?:\s*[:]\s*(\w+))?$/i);
    if (m) {
      id = m[1]; action = m[2].trim(); param = m[3];
      actions.push({ id, action, param, raw });
      continue;
    }

    // Pattern 3: ID action  or  ID action: param  (bare format)
    //   Handles: 1768296625074 delete
    //            1768296627928 correct:d
    m = raw.match(/^(\d+)\s+(.+?)(?:\s*[:]\s*(\w+))?$/);
    if (m) {
      id = m[1]; action = m[2].trim(); param = m[3];
      actions.push({ id, action, param, raw });
      continue;
    }

    log(`⚠ WARNING: Unrecognized line — "${raw}"`);
  }

  return actions;
}

// --- Main ---
async function main() {
  log('=== MCQ Fix Script Started ===');
  log(`Input: ${INPUT_FILE}`);

  const text = readFileSync(INPUT_FILE, 'utf-8');
  const actions = parseActions(text);

  log(`Parsed ${actions.length} actionable entries.`);

  const stats = { total: actions.length, deleted: 0, updated: 0, skipped: 0, errors: [] };
  const seenIds = new Set();

  for (let i = 0; i < actions.length; i++) {
    const { id, action, param, raw } = actions[i];
    const uniqueKey = `${id}-${action}-${param || ''}`;
    if (seenIds.has(uniqueKey)) {
      stats.skipped++;
      log(`SKIP (duplicate): ${raw}`);
      continue;
    }
    seenIds.add(uniqueKey);

    const effectiveAction = action === 'logical error' || action === 'flag' ? 'delete' : action;
    const label = `[${i + 1}/${actions.length}] ID ${id} → ${effectiveAction}${param ? ': ' + param : ''}`;

    try {
      // Step 1: backup the question first
      let question = null;
      try {
        question = await apiFetch(`/questions/${id}`);
      } catch (fetchErr) {
        log(`WARN ${label} — fetch failed (${fetchErr.message}), skipping backup`);
      }

      if (!question) {
        log(`ERR ${label} — could not fetch question, skipping`);
        stats.errors.push({ id, action, param, raw, error: 'fetch returned null/404' });
        continue;
      }

      // Backup the full question (before any change)
      const backupFile = join(BACKUP_DIR, `${id}.json`);
      writeFileSync(backupFile, JSON.stringify(question, null, 2));
      log(`BACKUP ${label} — saved to ${backupFile}`);

      // Step 2: perform the action
      if (effectiveAction === 'delete') {
        await apiFetch(`/questions/${id}`, { method: 'DELETE' });
        stats.deleted++;
        log(`OK ${label} — DELETED`);
      } else if (effectiveAction === 'correct') {
        const correctVal = param;
        if (!correctVal || !/^[a-d]$/i.test(correctVal)) {
          log(`WARN ${label} — invalid correct value '${correctVal}', skipping`);
          stats.errors.push({ id, action, param, raw, error: `invalid correct value: ${correctVal}` });
          continue;
        }
        // Send the FULL question object with only correct_answer changed
        // to prevent other fields from being nullified by a partial PUT
        const updatedQuestion = { ...question, correct_answer: correctVal.toLowerCase() };
        await apiFetch(`/questions/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updatedQuestion),
        });
        stats.updated++;
        log(`OK ${label} — UPDATED correct_answer → ${correctVal.toLowerCase()} (full object sent)`);
      } else {
        stats.skipped++;
        log(`SKIP ${label} — unknown action '${effectiveAction}'`);
      }
    } catch (err) {
      stats.errors.push({ id, action, param, raw, error: err.message });
      log(`ERR ${label} — ${err.message}`);
    }

    // Rate-limit: delay between requests
    await sleep(300);
  }

  // Write summary
  writeFileSync(SUMMARY_FILE, JSON.stringify(stats, null, 2));
  log('=== Script Finished ===');
  log(`Summary: ${stats.deleted} deleted, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors.length} errors`);
  console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
