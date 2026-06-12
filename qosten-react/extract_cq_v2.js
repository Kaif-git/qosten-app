const fs = require("fs");

const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-05.json";
const outputFile = "higher_math_cq.txt";

try {
    const data = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(data);
    
    // Find the subject that matches "?????? ????" by looking for a subject that contains "??????"
    // We use a slice of the data to identify the correct subject string from the file itself
    const sampleSubject = json.find(item => item.subject && item.subject.includes("??????"))?.subject;
    
    if (!sampleSubject) {
        console.error("Could not find a subject containing '??????'");
        process.exit(1);
    }
    
    console.log(`Using subject: ${sampleSubject}`);
    
    const filtered = json.filter(item => item.subject === sampleSubject && item.type === "cq");
    
    console.log(`Found ${filtered.length} matches. Writing to file...`);
    const outputContent = filtered.map(item => JSON.stringify(item, null, 2) + "\n\n" + "-".repeat(40) + "\n\n").join("");
    fs.writeFileSync(outputFile, outputContent, "utf8");
    
    console.log(`Successfully extracted ${filtered.length} questions to ${outputFile}`);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
