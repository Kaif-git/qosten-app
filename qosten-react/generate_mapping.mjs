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
    const questions = await getAllExisting();
    const uniqueChapters = [...new Set(questions.map(q => q.chapter).filter(Boolean))];
    
    const groups = {};
    // Updated regex to support Bengali digits [০-৯] and English digits [0-9]
    const pattern = /^পরিচ্ছেদ\s*([0-9০-৯]+)\s*[:\-]\s*(.*)$/;

    uniqueChapters.forEach(chap => {
      const match = chap.match(pattern);
      if (match) {
        const num = match[1];
        if (!groups[num]) groups[num] = [];
        groups[num].push(chap);
      }
    });

    const mapping = {};
    const changes = [];

    Object.entries(groups).forEach(([num, variants]) => {
      if (variants.length > 1) {
        // Prefer variant with ":"
        let target = variants.find(v => v.includes(':')) || variants[0];
        variants.forEach(v => {
          if (v !== target) {
            mapping[v] = target;
            changes.push(`"${v}" -> "${target}"`);
          }
        });
      }
    });

    if (changes.length === 0) {
      console.log("No inconsistent chapter names found matching the pattern.");
    } else {
      console.log(`Found ${changes.length} naming inconsistencies to fix:`);
      changes.forEach(c => console.log(c));
      
      fs.writeFileSync("chapter_mapping.json", JSON.stringify(mapping, null, 2));
      console.log("\nMapping saved to chapter_mapping.json");
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
