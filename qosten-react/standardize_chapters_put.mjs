import fetch from "node-fetch";
import fs from "fs";

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
    const mapping = JSON.parse(fs.readFileSync("chapter_mapping.json", "utf8"));
    const questions = await getAllExisting();
    
    let updatedCount = 0;
    const CONCURRENCY = 5;
    
    console.log(`Updating chapters for ${questions.length} questions...`);

    for (let i = 0; i < questions.length; i += CONCURRENCY) {
      const chunk = questions.slice(i, i + CONCURRENCY);
      const promises = chunk.map(async (item) => {
        if (mapping[item.chapter]) {
          const targetChapter = mapping[item.chapter];
          const updatedItem = { ...item, chapter: targetChapter };
          
          const res = await fetch(`${API_BASE_URL}/questions/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedItem),
          });
          
          if (res.ok) updatedCount++;
        }
      });
      await Promise.all(promises);
      process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY, questions.length)}/${questions.length} updated ${updatedCount}\r`);
    }
    
    console.log(`\n\nSuccessfully standardized ${updatedCount} questions.`);
  } catch (err) {
    console.error("❌ Fatal Error:", err);
  }
}

main();
