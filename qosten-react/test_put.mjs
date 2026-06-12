import fetch from "node-fetch";

const API_BASE_URL = "https://questions-api.edventure.workers.dev";
const SUBJECT = "বাংলা দ্বিতীয় পত্র";

async function main() {
  try {
    const response = await fetch(`${API_BASE_URL}/questions?subject=${encodeURIComponent(SUBJECT)}&limit=1`);
    const data = await response.json();
    const batch = Array.isArray(data) ? data : (data.data || []);
    if (batch.length === 0) return;

    const q = batch[0];
    console.log(`Testing PUT update for ID ${q.id}...`);
    
    const putRes = await fetch(`${API_BASE_URL}/questions/${q.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...q, chapter: q.chapter + " (PUT-TEST)" }),
    });

    if (putRes.ok) {
      console.log("✅ PUT successful");
    } else {
      const err = await putRes.text();
      console.error(`❌ PUT failed: ${err}`);
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
