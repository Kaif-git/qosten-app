
const fs = require("fs");

const FILE_PATH = "C:\\Users\\DFIT\\OneDrive\\Desktop\\Question Deletion.txt";
const API_BASE_URL = "https://questions-api.edventure.workers.dev";

async function run() {
    const content = fs.readFileSync(FILE_PATH, "utf8");
    const lines = content.split("\n");
    const idsToDelete = new Set();

    for (let line of lines) {
        const idMatch = line.match(/\b\d{13}\b/);
        if (idMatch) {
            const id = idMatch[0];
            if (!line.toLowerCase().includes("correct:")) {
                idsToDelete.add(id);
            }
        }
    }

    console.log(`Found ${idsToDelete.size} IDs to delete.`);
    
    const ids = Array.from(idsToDelete);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
            const response = await fetch(`${API_BASE_URL}/questions/${id}`, {
                method: "DELETE",
            });
            if (response.ok) {
                console.log(`? Deleted: ${id}`);
                successCount++;
            } else {
                const text = await response.text();
                console.error(`? Failed to delete ${id}: ${response.status} ${text}`);
                failCount++;
            }
        } catch (err) {
            console.error(`? Error deleting ${id}:`, err.message);
            failCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nSummary: ${successCount} deleted, ${failCount} failed.`);
}

run();

