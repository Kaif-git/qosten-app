import fetch from "node-fetch";
import fs from "fs";

const API_BASE_URL = "https://questions-api.edventure.workers.dev";
const SUBJECT = "বাংলা দ্বিতীয় পত্র";

async function main() {
  try {
    const mapping = JSON.parse(fs.readFileSync("chapter_mapping.json", "utf8"));
    
    // 1. Fetch a small sample to test PATCH
    console.log("Testing PATCH update on one question...");
    const response = await fetch(`${API_BASE_URL}/questions?subject=${encodeURIComponent(SUBJECT)}&limit=1`);
    const data = await response.json();
    const batch = Array.isArray(data) ? data : (data.data || []);
    
    if (batch.length === 0) {
      console.log("No questions found to test.");
      return;
    }

    const q = batch[0];
    const originalChapter = q.chapter;
    const newChapter = originalChapter + " (TEST)";
    
    const patchRes = await fetch(`${API_BASE_URL}/questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapter: newChapter }),
    });

    if (patchRes.ok) {
      console.log(`✅ PATCH successful: ${originalChapter} -> ${newChapter}`);
      
      // Now perform the actual updates
      console.log("\nStarting actual standardization...");
      
      const allQuestions = [];
      let page = 0;
      while (true) {
        const params = new URLSearchParams();
        params.append("subject", SUBJECT);
        params.append("limit", "500");
        params.append("page", String(page));
        const res = await fetch(`${API_BASE_URL}/questions?${params.toString()}`);
        const json = await res.json();
        const b = Array.isArray(json) ? json : (json.data || []);
        if (b.length === 0) break;
        allQuestions.push(...b);
        if (b.length < 500) break;
        page++;
      }

      let updatedCount = 0;
      const CONCURRENCY = 5;
      
      for (let i = 0; i < allQuestions.length; i += CONCURRENCY) {
        const chunk = allQuestions.slice(i, i + CONCURRENCY);
        const promises = chunk.map(async (item) => {
          if (mapping[item.chapter]) {
            const targetChapter = mapping[item.chapter];
            await fetch(`${API_BASE_URL}/questions/${item.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chapter: targetChapter }),
            });
            updatedCount++;
          }
        });
        await Promise.all(promises);
        process.stdout.write(`Progress: ${Math.min(i + CONCURRENCY, allQuestions.length)}/${allQuestions.length} updated ${updatedCount}\r`);
      }
      
      console.log(`\n\nSuccessfully standardized ${updatedCount} questions.`);
      
      // Cleanup test update
      await fetch(`${API_BASE_URL}/questions/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapter: originalChapter }),
      });
      console.log("Cleanup test update complete.");

    } else {
      const err = await patchRes.text();
      console.error(`❌ PATCH failed: ${err}`);
    }
  } catch (err) {
    console.error("❌ Fatal Error:", err);
  }
}

main();
