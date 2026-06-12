import fs from "fs";

const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-04.json";

try {
  const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const bangla2nd = data.filter(item => item.subject === "বাংলা দ্বিতীয় পত্র");
  
  const total = bangla2nd.length;
  const filled = bangla2nd.filter(item => item.explanation && item.explanation.trim()).length;
  const empty = total - filled;

  console.log(`Total "বাংলা দ্বিতীয় পত্র" questions: ${total}`);
  console.log(`Filled explanations: ${filled}`);
  console.log(`Empty explanations: ${empty}`);
  if (total > 0) {
    console.log(`Fill rate: ${((filled / total) * 100).toFixed(2)}%`);
  }
} catch (err) {
  console.error("Error:", err.message);
}
