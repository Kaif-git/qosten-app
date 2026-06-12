const fs = require("fs");
const inputFile = "C:\\Users\\DFIT\\Downloads\\question-bank-full-2026-06-05.json";

try {
    const data = fs.readFileSync(inputFile, "utf8");
    const json = JSON.parse(data);
    const cqSample = json.find(item => item.type === "cq");
    console.log(JSON.stringify(cqSample, null, 2));
} catch (err) {
    console.error("Error:", err.message);
}
