const fs = require("fs");
const path = require("path");

const inputDir = "D:\\Gemma Workflow\\input_txt";

try {
    const files = fs.readdirSync(inputDir).filter(f => f.endsWith(".txt"));
    const results = [];

    files.forEach(file => {
        const content = fs.readFileSync(path.join(inputDir, file), "utf8");
        const hasDollar = content.includes("$");
        const hasDelim = content.includes("\\(") || content.includes("\\[");
        
        results.push({
            file,
            hasDollar,
            hasDelim,
            status: (hasDelim && !hasDollar) ? "OK (Proper Delims)" : (hasDollar && !hasDelim) ? "Needs Processing ($)" : (hasDollar && hasDelim) ? "Mixed" : "No Math"
        });
    });

    console.table(results);
} catch (err) {
    console.error("Error:", err.message);
}
