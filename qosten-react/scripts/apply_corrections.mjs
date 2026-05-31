import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const PROCESSED_DIR = 'mcq_processed';
const APPLIED_DIR = 'mcq_applied';

async function updateQuestion(id, patch) {
    // First fetch the question to get the current data
    const res = await fetch(`${API_BASE_URL}/questions/${id}`);
    if (!res.ok) throw new Error(`Failed to fetch question ${id}`);
    const current = await res.json();

    const updated = {
        ...current,
        ...patch,
        is_verified: true,
        in_review_queue: false,
        is_flagged: false
    };

    const putRes = await fetch(`${API_BASE_URL}/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
    });

    if (!putRes.ok) {
        const err = await putRes.text();
        throw new Error(`Failed to update question ${id}: ${err}`);
    }
    return await putRes.json();
}

async function deleteQuestion(id) {
    const res = await fetch(`${API_BASE_URL}/questions/${id}`, {
        method: 'DELETE'
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to delete question ${id}: ${err}`);
    }
    return true;
}

import { parseMCQQuestions } from '../src/utils/mcqQuestionParser.js';

async function main() {
    await fs.mkdir(APPLIED_DIR, { recursive: true });
    const files = await fs.readdir(PROCESSED_DIR);
    const responseFiles = files.filter(f => f.endsWith('.response.txt'));

    console.log(`🔍 Found ${responseFiles.length} response files to apply.`);

    for (const file of responseFiles) {
        const filePath = path.join(PROCESSED_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        console.log(`\n📄 Processing ${file}...`);
        
        let successCount = 0;
        let deleteCount = 0;
        let failCount = 0;

        // Try simple line-by-line commands first
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        const commandLines = lines.filter(l => l.includes('correct:') || l.includes('delete'));
        
        if (commandLines.length > 0) {
            console.log(`🛠 Applying ${commandLines.length} direct commands...`);
            for (const line of commandLines) {
                try {
                    if (line.includes('correct:')) {
                        const parts = line.split(/\s+/);
                        const id = parts[0];
                        const label = parts.find(p => p.includes('correct:'))?.split(':')[1];
                        if (id && label) {
                            await updateQuestion(id, { correct_answer: label });
                            successCount++;
                        }
                    } else if (line.includes('delete')) {
                        const id = line.split(/\s+/)[0];
                        if (id) {
                            await deleteQuestion(id);
                            deleteCount++;
                        }
                    }
                } catch (err) {
                    console.error(`❌ Error on line "${line}":`, err.message);
                    failCount++;
                }
            }
        } else {
            // Fallback: Parse full question blocks if AI returned the whole object
            console.log('📝 No simple commands found. Attempting full block parse...');
            const parsed = parseMCQQuestions(content);
            if (parsed.length > 0) {
                for (const q of parsed) {
                    try {
                        if (q.id) {
                            await updateQuestion(q.id, {
                                question: q.questionText || q.question,
                                options: JSON.stringify(q.options),
                                correct_answer: q.correctAnswer,
                                explanation: q.explanation
                            });
                            successCount++;
                        }
                    } catch (err) {
                        console.error(`❌ Error updating question ${q.id}:`, err.message);
                        failCount++;
                    }
                }
            }
        }

        console.log(`\n📊 Summary for ${file}: Updated: ${successCount}, Deleted: ${deleteCount}, Failed: ${failCount}`);
        // ... move logic ...
        
        // Move response file and original json
        const originalJson = file.replace('.response.txt', '');
        await fs.rename(filePath, path.join(APPLIED_DIR, file));
        try {
            await fs.rename(path.join(PROCESSED_DIR, originalJson), path.join(APPLIED_DIR, originalJson));
        } catch (e) {
            // Might have been moved already or different name
        }
    }

    console.log('\n🏁 All corrections applied!');
}

main().catch(console.error);
