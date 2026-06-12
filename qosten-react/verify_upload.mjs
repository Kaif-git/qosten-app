import fetch from "node-fetch";
import fs from "fs";

const API_BASE_URL = "https://questions-api.edventure.workers.dev";
const INPUT_FILE = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-04.json";
const SUBJECT = "বাংলা দ্বিতীয় পত্র";

async function getAllExisting() {
  const all = [];
  const PAGE_SIZE = 500;
  let page = 0;
  while (true) {
    const params = new URLSearchParams();
    params.append("subject", SUBJECT);
    params.append("limit", String(PAGE_SIZE));
    params.append("page", String(page));
    try {
      const response = await fetch(`${API_BASE_URL}/questions?${params.toString()}`);
      const data = await response.json();
      const batch = Array.isArray(data) ? data : (data.data || []);
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    } catch (err) {
      console.error(`Error fetching page ${page}: ${err.message}`);
      break;
    }
  }
  return all;
}

async function main() {
  try {
    console.log(`Checking upload status for ${SUBJECT}...`);
    
    // 1. Get total from file
    const fileData = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8"));
    const fileTotal = fileData.filter(item => item.subject === SUBJECT).length;
    console.log(`Total questions in source file: ${fileTotal}`);

    // 2. Get total from API
    const apiData = await getAllExisting();
    const apiTotal = apiData.length;
    console.log(`Total questions in API: ${apiTotal}`);

    const diff = fileTotal - apiTotal;
    if (diff === 0) {
      console.log("✅ Perfect match! All questions are uploaded.");
    } else {
      console.log(`❌ Mismatch: ${diff} questions are still missing.`);
    }

    // 3. Spot check
    if (apiData.length > 0) {
      console.log("\nSpot checking a random question...");
      const randomIdx = Math.floor(Math.random() * apiData.length);
      const sample = apiData[randomIdx];
      console.log(`Sample Question: ${sample.question_text?.substring(0, 100)}...`);
      console.log(`Subject: ${sample.subject}`);
      console.log(`Explanation: ${sample.explanation ? "Filled" : "Empty"}`);
    }

  } catch (err) {
    console.error("❌ Error during verification:", err);
  }
}

main();
