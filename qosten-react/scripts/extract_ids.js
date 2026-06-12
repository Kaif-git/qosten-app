
const fs = require("fs");
const content = fs.readFileSync("C:\\Users\\DFIT\\OneDrive\\Desktop\\Question Deletion.txt", "utf8");

const ids = [];
const lines = content.split("\n");

for (let line of lines) {
    if (line.includes("correct:")) continue;
    const match = line.match(/\b\d{13}\b/g);
    if (match) {
        ids.push(...match);
    }
}

const uniqueIds = [...new Set(ids)];
console.log(JSON.stringify(uniqueIds));

