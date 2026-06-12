const fs = require("fs");
const path = require("path");

const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-05.json";
const outputDir = "D:\\Gemma Workflow\\input";
const targetSubject = "উচ্চতর গণিত";
const targetType = "cq";
const batchSize = 10;

try {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created directory: ${outputDir}`);
    }

    console.log("Reading file...");
    const data = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(data);
    
    const filtered = json.filter(item => item.subject === targetSubject && item.type === targetType);
    console.log(`Total questions found: ${filtered.length}`);

    const batches = [];
    for (let i = 0; i < filtered.length; i += batchSize) {
        batches.push(filtered.slice(i, i + batchSize));
    }

    console.log(`Creating ${batches.length} batches...`);
    batches.forEach((batch, index) => {
        const fileName = `batch_${index + 1}.json`;
        const filePath = path.join(outputDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(batch, null, 2), "utf8");
    });

    console.log(`Successfully created ${batches.length} batches in ${outputDir}`);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
