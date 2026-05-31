import fetch from "node-fetch";
import { writeFileSync } from "fs";

const SUBJECT = encodeURIComponent("বাংলা দ্বিতীয় পত্র");
const API = "https://questions-api.edventure.workers.dev";
const BACKUP_FILE = "all_questions_dump/bangla_backup.json";

// ─── Canonical chapter mapping ───
// Rules:
//   Number-only → add name
//   Name-only (if clearly mappable) → add number
//   Typo fixes → fix name
//   Duplicate entries → merge into canonical
const CHAPTER_MAP = {
  // Number-only → full format
  "পরিচ্ছেদ ২৮": "পরিচ্ছেদ ২৮: বিভক্তি",
  "পরিচ্ছেদ ২৯": "পরিচ্ছেদ ২৯: ক্রিয়াবিভক্তি",
  "পরিচ্ছেদ ৩০": "পরিচ্ছেদ ৩০: ক্রিয়ার কাল",
  "পরিচ্ছেদ ৩১": "পরিচ্ছেদ ৩১: বাক্যের অংশ ও শ্রেণিবিভাগ",
  "পরিচ্ছেদ ৩২": "পরিচ্ছেদ ৩২: বাক্যের বর্গ",
  "পরিচ্ছেদ ৩৩": "পরিচ্ছেদ ৩৩: উদ্দেশ্য ও বিধেয়",
  "পরিচ্ছেদ ৩৪": "পরিচ্ছেদ ৩৪: সরল, জটিল ও যৌগিক বাক্য",
  "পরিচ্ছেদ ৩৫": "পরিচ্ছেদ ৩৫: কারক",
  "পরিচ্ছেদ ৩৬": "পরিচ্ছেদ ৩৬: বাচ্য",
  "পরিচ্ছেদ ৩৭": "পরিচ্ছেদ ৩৭: উক্তি",

  // Name-only → full format (clear 1-to-1 mappings)
  "প্রতীশব্দ": "পরিচ্ছেদ ৪১: প্রতিশব্দ",
  "বাগধারা": "পরিচ্ছেদ ৪০: বাগধারা",
  "বাগর্থ": "পরিচ্ছেদ ৩৯: বাগর্থ",
  "বিপরীত শব্দ": "পরিচ্ছেদ ৪২: বিপরীত শব্দ",
  "যতিচিহ্ন": "পরিচ্ছেদ ৩৮: যতিচিহ্ন",

  // Duplicate entries → merge into canonical
  "সন্ধি": "পরিচ্ছেদ ১৩: সন্ধি",
  "সমাস": "পরিচ্ছেদ ১২: সমাস প্রক্রিয়ায় শব্দ গঠন",
  "শব্দের শ্রেণিবিভাগ": "পরিচ্ছেদ ১৭: শব্দের শ্রেণিবিভাগ",
  "শব্দ দ্বিত্ব": "পরিচ্ছেদ ১৪: শব্দদ্বিত্ব",

  // Name variant fixes
  "পরিচ্ছেদ ৪: বাগ্যন্ত্র": "পরিচ্ছেদ ৪: বাগযন্ত্র",
  "পরিচ্ছেদ ১৫: লিঙ্গান্তর ও নারীবাচক শব্দ": "পরিচ্ছেদ ১৫: নরবাচক ও নারীবাচক শব্দ",
  "পরিচ্ছেদ ১২: সমাস প্রক্রিয়া শব্দ গঠন": "পরিচ্ছেদ ১২: সমাস প্রক্রিয়ায় শব্দ গঠন",

  // Mis-assigned chapters
  "পরিচ্ছেদ ১০: তদ্ধিত প্রত্যয়": "পরিচ্ছেদ ১১: প্রত্যয় দিয়ে শব্দ গঠন",
  "তদ্ধিত প্রত্যয়": "পরিচ্ছেদ ১১: প্রত্যয় দিয়ে শব্দ গঠন",
};

// ─── Helpers ───
async function fetchAll() {
  const all = [];
  let page = 0;
  while (true) {
    const r = await fetch(`${API}/questions?subject=${SUBJECT}&limit=500&page=${page}`);
    const d = await r.json();
    if (!d || !d.length) break;
    all.push(...d);
    page++;
    if (d.length < 500) break;
  }
  return all;
}

async function updateQuestion(id, data) {
  const r = await fetch(`${API}/questions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`PUT ${id} failed (${r.status}): ${err}`);
  }
  return r;
}

// ─── Main ───
async function main() {
  console.log("Fetching all questions...");
  const questions = await fetchAll();
  console.log(`Fetched ${questions.length} questions`);

  // Backup
  writeFileSync(BACKUP_FILE, JSON.stringify(questions, null, 2), "utf-8");
  console.log(`Backup saved to ${BACKUP_FILE}`);

  // Find which questions need chapter updates
  const toUpdate = [];
  for (const q of questions) {
    const oldChapter = q.chapter;
    const newChapter = CHAPTER_MAP[oldChapter];
    if (newChapter && newChapter !== oldChapter) {
      toUpdate.push({ id: q.id, oldChapter, newChapter, data: { ...q, chapter: newChapter } });
    }
  }

  if (toUpdate.length === 0) {
    console.log("No questions need chapter updates.");
    return;
  }

  // Group by old → new for summary
  const summary = {};
  for (const u of toUpdate) {
    const key = `${u.oldChapter} → ${u.newChapter}`;
    summary[key] = (summary[key] || 0) + 1;
  }

  console.log(`\nQuestions to update: ${toUpdate.length}`);
  console.log("\nChanges:");
  for (const [change, count] of Object.entries(summary)) {
    console.log(`  ${count}x  ${change}`);
  }

  // Prompt to continue
  console.log("\nWill send PUT requests to update chapters.");
  console.log("Press Ctrl+C within 5s to cancel...");
  await new Promise(r => setTimeout(r, 5000));

  // Send updates in batches
  const BATCH = 20;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(u => updateQuestion(u.id, u.data))
    );

    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        success++;
      } else {
        failed++;
        console.error(`  ✖ Failed question ${batch[j].id}: ${results[j].reason.message}`);
      }
    }

    if ((i + BATCH) % 100 === 0 || i + BATCH >= toUpdate.length) {
      console.log(`Progress: ${i + BATCH}/${toUpdate.length} (${success} ok, ${failed} failed)`);
    }

    // Small delay between batches
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone. ${success} updated, ${failed} failed.`);
  if (failed > 0) console.log(`Check errors above for failed IDs.`);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
