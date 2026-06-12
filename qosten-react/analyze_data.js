const fs = require("fs");

const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-05.json";

try {
    const data = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(data);
    
    const subjects = new Set();
    const types = new Set();
    
    json.forEach(item => {
        if (item.subject) subjects.add(item.subject);
        if (item.type) types.add(item.type);
    });
    
    console.log("Unique Subjects:", Array.from(subjects));
    console.log("Unique Types:", Array.from(types));
} catch (err) {
    console.error("Error:", err.message);
}
