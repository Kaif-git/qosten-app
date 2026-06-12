import fetch from "node-fetch";

const API_BASE_URL = "https://questions-api.edventure.workers.dev";
const SUBJECT = "বাংলা দ্বিতীয় পত্র";

async function getAllExisting() {
  const all = [];
  const PAGE_SIZE = 500;
  let page = 0;
  console.log(`Fetching all questions for ${SUBJECT} to analyze chapters...`);
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
      process.stdout.write(`   Fetched ${all.length}...\r`);
    } catch (err) {
      console.error(`\nError fetching page ${page}: ${err.message}`);
      break;
    }
  }
  return all;
}

async function main() {
  try {
    const questions = await getAllExisting();
    const chapters = questions.map(q => q.chapter).filter(Boolean);
    const uniqueChapters = [...new Set(chapters)];
    
    console.log(`\n\nFound ${uniqueChapters.length} unique chapter names.`);
    
    const chapterGroups = {};
    
    uniqueChapters.forEach(chap => {
      // Normalize by replacing both : and - with a common delimiter for grouping
      const normalized = chap.replace(/[:\-]/g, '_');
      if (!chapterGroups[normalized]) {
        chapterGroups[normalized] = [];
      }
      chapterGroups[normalized].push(chap);
    });

    const inconsistencies = Object.entries(chapterGroups).filter(([_, variants]) => variants.length > 1);

    if (inconsistencies.length === 0) {
      console.log("No inconsistent chapter naming found based on : vs -.");
    } else {
      console.log(`\nFound ${inconsistencies.length} sets of inconsistent chapter names:`);
      inconsistencies.forEach(([norm, variants]) => {
        console.log(`- Group [${norm}]:`);
        variants.forEach(v => console.log(`  → "${v}"`));
      });
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
