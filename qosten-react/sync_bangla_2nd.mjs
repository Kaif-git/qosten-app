import fetch from "node-fetch";
import fs from "fs";

const API_BASE_URL = "https://questions-api.edventure.workers.dev";
const INPUT_FILE = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-04.json";
const SUBJECT = "বাংলা দ্বিতীয় পত্র";

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function getAllExisting() {
  const all = [];
  const PAGE_SIZE = 500;
  let page = 0;
  console.log(`Fetching existing questions for ${SUBJECT}...`);
  while (true) {
    const params = new URLSearchParams();
    params.append("subject", SUBJECT);
    params.append("limit", String(PAGE_SIZE));
    params.append("page", String(page));
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/questions?${params.toString()}`);
      const data = await response.json();
      const batch = Array.isArray(data) ? data : (data.data || []);
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
      process.stdout.write(`   Fetched ${all.length}...\r`);
    } catch (err) {
      console.error(`\nError fetching existing: ${err.message}`);
      break;
    }
  }
  console.log(`\nFound ${all.length} existing questions.`);
  return all;
}

async function deleteQuestion(id) {
  const response = await fetch(`${API_BASE_URL}/questions/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Delete failed for ${id}`);
}

async function createQuestion(q) {
  const response = await fetch(`${API_BASE_URL}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(q),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err.substring(0, 200));
  }
  return response.json();
}

async function main() {
  try {
    // 1. Delete existing
    const existing = await getAllExisting();
    if (existing.length > 0) {
      console.log(`Deleting ${existing.length} existing questions...`);
      let delCount = 0;
      for (const q of existing) {
        try {
          await deleteQuestion(q.id);
          delCount++;
          if (delCount % 50 === 0) process.stdout.write(`   Deleted ${delCount}/${existing.length}\r`);
        } catch (err) {
          console.error(`\nFailed to delete ${q.id}: ${err.message}`);
        }
      }
      console.log(`\nSuccessfully deleted ${delCount} questions.`);
    }

    // 2. Upload new
    console.log(`Reading ${INPUT_FILE}...`);
    const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
    const filtered = data.filter(item => item.subject === SUBJECT);
    console.log(`Preparing to upload ${filtered.length} questions...`);

    let successCount = 0;
    let failedCount = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < filtered.length; i += CONCURRENCY) {
      const chunk = filtered.slice(i, i + CONCURRENCY);
      const promises = chunk.map(item => {
        const payload = {
          type: item.type || "mcq",
          subject: item.subject,
          chapter: item.chapter || "N/A",
          lesson: item.lesson || "N/A",
          board: item.board || "N/A",
          language: item.language || "bn",
          question_text: item.question || item.question_text || "",
          options: item.options || "[]",
          correct_answer: item.correct_answer || "",
          explanation: item.explanation || "",
          is_verified: 1,
          is_flagged: 0,
          in_review_queue: 0
        };
        return createQuestion(payload)
          .then(() => successCount++)
          .catch(err => {
            failedCount++;
            // console.error(`\nError uploading ${item.id}: ${err.message}`);
          });
      });
      await Promise.all(promises);
      process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY, filtered.length)}/${filtered.length} (${successCount} ok, ${failedCount} failed)\r`);
    }

    console.log(`\n\nFinal Result: ${successCount} uploaded, ${failedCount} failed`);
  } catch (err) {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
  }
}

main();
