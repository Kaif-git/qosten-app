// Check what chapters exist for Mathematics questions in the API
const API_BASE_URL = "https://questions-api.edventure.workers.dev";

async function main() {
  // Fetch all Mathematics questions
  const allQuestions = [];
  let page = 0;
  while (true) {
    const params = new URLSearchParams();
    params.append("subject", "Mathematics");
    params.append("limit", "500");
    params.append("page", String(page));
    params.append("fields", "id,question,chapter,type,language");
    const res = await fetch(`${API_BASE_URL}/questions?${params.toString()}`);
    const json = await res.json();
    const b = Array.isArray(json) ? json : (json.data || []);
    if (b.length === 0) break;
    allQuestions.push(...b);
    page++;
    if (b.length < 500) break;
  }

  console.log(`Total Mathematics questions: ${allQuestions.length}`);

  // Group by chapter
  const chapters = {};
  for (const q of allQuestions) {
    const ch = q.chapter || "(unknown)";
    if (!chapters[ch]) chapters[ch] = [];
    chapters[ch].push(q.id);
  }

  console.log("\n=== Chapters in API ===");
  for (const [ch, ids] of Object.entries(chapters).sort((a,b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${ch}: ${ids.length} questions`);
  }

  // Now check the 3 specific chapters we care about
  const targetEN = [
    "Equations in One Variable",
    "Simple Simultaneous Equations in Two Variables",
    "Ratio, Similarity and Symmetry"
  ];

  console.log("\n=== Checking 3 target chapters ===");
  for (const name of targetEN) {
    if (chapters[name]) {
      console.log(`  ✅ "${name}" EXISTS — ${chapters[name].length} questions`);
    } else {
      console.log(`  ❌ "${name}" NOT FOUND in API`);
      // Check for similar names
      const similar = Object.keys(chapters).filter(k => 
        k.toLowerCase().includes(name.toLowerCase().slice(0, 5))
      );
      if (similar.length) {
        console.log(`     Similar chapters found: ${similar.join(", ")}`);
      }
    }
  }

  // Also check Bengali chapter names in the constants
  const targetBN = [
    "এক চলকের সমীকরণ",
    "সরল সহসমীকরণ",
    "অনুপাত, সাদৃশ্য এবং প্রতিসাম্য"
  ];
  console.log("\n=== Checking Bengali chapter names ===");
  for (const name of targetBN) {
    if (chapters[name]) {
      console.log(`  ✅ "${name}" EXISTS — ${chapters[name].length} questions`);
    } else {
      console.log(`  ❌ "${name}" NOT FOUND in API`);
    }
  }
}

main().catch(console.error);
