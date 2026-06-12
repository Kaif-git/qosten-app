const fs = require("fs");
const path = require("path");

const inputDir = "D:\\Gemma Workflow\\input";
const outputDir = "D:\\Gemma Workflow\\input_txt";

try {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const files = fs.readdirSync(inputDir).filter(f => f.endsWith(".json"));
    
    files.forEach(file => {
        const content = fs.readFileSync(path.join(inputDir, file), "utf8");
        const json = JSON.parse(content);
        
        let textContent = "";
        json.forEach((item, index) => {
            const id = item.id || "N/A";
            const subject = item.subject || "N/A";
            const chapter = item.chapter || "N/A";
            const lesson = item.lesson || "N/A";
            const board = item.board || "N/A";
            
            textContent += `[ID: ${id}]\n`;
            textContent += `[Subject: ${subject}]\n`;
            textContent += `[Chapter: ${chapter}]\n`;
            textContent += `[Lesson: ${lesson}]\n`;
            textContent += `[Board: ${board}]\n`;
            
            if (item.type === "mcq" || (item.options && item.options.length > 0)) {
                textContent += `Question: ${item.question || item.question_text}\n`;
                textContent += `Options: ${item.options}\n`;
                textContent += `Answer: ${item.answer}\n`;
            } else {
                const stem = item.question_text || item.stem || item.question || "No stem found";
                textContent += `Stem: ${stem}\n`;
                
                let parts = [];
                try {
                    const parsedParts = typeof item.parts === "string" ? JSON.parse(item.parts) : item.parts;
                    if (Array.isArray(parsedParts)) {
                        parsedParts.forEach(p => {
                            parts.push(`${p.label}. ${p.text}`);
                        });
                    }
                } catch (e) {
                    parts.push(item.parts || "No parts found");
                }
                textContent += parts.join("\n") + "\n";
                textContent += `Answer:\n${item.answer || "No answer found"}\n`;
            }
            textContent += "\n---\n\n";
        });
        
        fs.writeFileSync(path.join(outputDir, file.replace(".json", ".txt")), textContent, "utf8");
    });
    console.log(`Converted ${files.length} files to ${outputDir}`);
} catch (err) {
    console.error("Error:", err.message);
}
