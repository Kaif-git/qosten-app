import fetch from "node-fetch";

const API_BASE_URL = "https://questions-api.edventure.workers.dev";
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
      break;
    }
  }
  return all;
}

async function main() {
  try {
    const questions = await getAllExisting();
    const chapters = questions.map(q => q.chapter).filter(Boolean);
    const uniqueChapters = [...new Set(chapters)].sort();
    
    console.log(`Found ${uniqueChapters.length} unique chapters:\n`);
    uniqueChapters.forEach((chap, i) => {
      console.log(`${i+1}. ${chap}`);
    });
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
