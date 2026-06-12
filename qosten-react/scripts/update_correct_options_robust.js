
const fs = require("fs");

const FILE_PATH = "C:\\Users\\DFIT\\OneDrive\\Desktop\\Question Deletion.txt";
const API_BASE_URL = "https://questions-api.edventure.workers.dev";

async function run() {
    const content = fs.readFileSync(FILE_PATH, "utf8");
    const lines = content.split("\n");
    const updates = [];

    for (let line of lines) {
        // Matches [123...] correct: x OR [id: 123...] correct: x
        const match = line.match(/\[(?:id:\s*)?(\d{13})\]\s*correct:\s*([a-d])/i);
        if (match) {
            updates.push({
                id: match[1],
                correctLabel: match[2].toLowerCase()
            });
        }
    }

    console.log(`Found ${updates.length} updates to perform.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < updates.length; i++) {
        const { id, correctLabel } = updates[i];
        try {
            const fetchRes = await fetch(`${API_BASE_URL}/questions/${id}`);
            if (!fetchRes.ok) {
                console.error(`? Could not fetch question ${id}: ${fetchRes.status}`);
                failCount++;
                continue;
            }
            const question = await fetchRes.json();

            let options;
            try {
                options = JSON.parse(question.options);
            } catch (e) {
                console.error(`? Failed to parse options for ${id}: ${e.message}`);
                failCount++;
                continue;
            }

            options = options.map(opt => ({
                ...opt,
                is_correct: opt.label === correctLabel
            }));

            const updatedQuestion = {
                ...question,
                correct_answer: correctLabel,
                options: JSON.stringify(options)
            };

            const putRes = await fetch(`${API_BASE_URL}/questions/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedQuestion),
            });

            if (putRes.ok) {
                console.log(`? Updated ${id} to correct: ${correctLabel}`);
                successCount++;
            } else {
                const text = await putRes.text();
                console.error(`? Failed to update ${id}: ${putRes.status} ${text}`);
                failCount++;
            }
        } catch (err) {
            console.error(`? Error updating ${id}:`, err.message);
            failCount++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\nSummary: ${successCount} updated, ${failCount} failed.`);
}

run();

