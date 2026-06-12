const fs = require("fs");

const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-05.json";
const outputFile = "higher_math_cq.txt";
const targetSubject = "?????? ????";
const targetType = "cq";

try {
    console.log("Reading file...");
    const data = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(data);
    
    console.log("Filtering data...");
    const filtered = json.filter(item => item.subject === targetSubject && item.type === targetType);
    
    console.log(`Found ${filtered.length} matches. Writing to file...`);
    const outputContent = filtered.map(item => JSON.stringify(item, null, 2) + "\n\n" + "-".repeat(40) + "\n\n").join("");
    fs.writeFileSync(outputFile, outputContent, "utf8");
    
    console.log(`Successfully extracted ${filtered.length} questions to ${outputFile}`);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
