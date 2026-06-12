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
  console.log(`Fetching existing questions for ${SUBJECT} to identify missing ones...`);
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
  console.log(`\nFound ${all.length} questions already in DB.`);
  return all;
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

function normalizeText(t) {
  return (t || '').replace(/\\s+/g, ' ').trim().toLowerCase();
}

async function main() {
  try {
    const existing = await getAllExisting();
    const existingTexts = new Set(existing.map(q => normalizeText(q.question_text || q.question || '')));

    console.log(`Reading ${INPUT_FILE}...`);
    const data = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
    const filtered = data.filter(item => item.subject === SUBJECT);
    
    const missing = filtered.filter(item => {
      const text = normalizeText(item.question || item.question_text || '');
      return !existingTexts.has(text);
    });

    console.log(`Found ${filtered.length} total in file, ${missing.length} are missing from DB.`);

    if (missing.length === 0) {
      console.log("Everything is already uploaded!");
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const CONCURRENCY = 5;

    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const chunk = missing.slice(i, i + CONCURRENCY);
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
      process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY, missing.length)}/${missing.length} (${successCount} ok, ${failedCount} failed)\r`);
    }

    console.log(`\n\nFinal Result: ${successCount} uploaded, ${failedCount} failed`);
  } catch (err) {
    console.error("❌ Fatal Error:", err);
    process.exit(1);
  }
}

main();
