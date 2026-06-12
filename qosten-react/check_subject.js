const fs = require("fs");

const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-05.json";
const targetSubject = "?????? ????";

try {
    const data = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(data);
    
    const subjectData = json.filter(item => item.subject === targetSubject);
    const typesInSubject = new Set(subjectData.map(item => item.type));
    
    console.log(`Items with subject "${targetSubject}": ${subjectData.length}`);
    console.log(`Types found for this subject:`, Array.from(typesInSubject));
} catch (err) {
    console.error("Error:", err.message);
}
