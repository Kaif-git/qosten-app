import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const TARGET_DIR = 'mcq_to_fix';

async function fetchWithRetry(url, options = {}, retries = 5) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            if (res.status === 429) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

async function fetchAllQuestions() {
    const BATCH_SIZE = 500;
    let all = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        process.stdout.write(`\r📡 Fetching page ${page}... `);
        const res = await fetchWithRetry(`${API_BASE_URL}/questions?limit=${BATCH_SIZE}&page=${page}`);
        const data = await res.json();
        const batch = Array.isArray(data) ? data : (data.data || []);
        
        if (batch.length === 0) break;
        all.push(...batch);
        
        if (batch.length < BATCH_SIZE) hasMore = false;
        else page++;
    }
    console.log(`\n✅ Fetched ${all.length} total questions.`);
    return all;
}

function formatMCQ(q) {
    let text = `ID: ${q.id}\nQuestion: ${q.question_text || q.question}\n`;
    let options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    
    if (Array.isArray(options)) {
        text += `Options: ${options.map(o => typeof o === 'object' ? `${o.label}) ${o.text}` : o).join(', ')}\n`;
    }
    
    text += `Correct: ${q.correct_answer}\nExplanation: ${q.explanation || ''}\n---\n`;
    return text;
}

async function main() {
    await fs.mkdir(TARGET_DIR, { recursive: true });
    const all = await fetchAllQuestions();
    
    // 1. Missing Explanations
    const missingExp = all.filter(q => q.type === 'mcq' && (!q.explanation || q.explanation.trim() === ''));
    console.log(`🔍 Found ${missingExp.length} MCQs with missing explanations.`);
    
    // 2. Unverified Questions
    const unverified = all.filter(q => q.type === 'mcq' && !q.is_verified);
    console.log(`🔍 Found ${unverified.length} unverified MCQs.`);

    // Split into batches of 50 for the AI processor
    const BATCH_SIZE = 50;
    for (let i = 0; i < unverified.length; i += BATCH_SIZE) {
        const chunk = unverified.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const fileName = `unverified_batch_${batchNum}.json`;
        
        // Save as JSON objects that our current worker expects
        const jsonContent = chunk.map(q => ({
            id: q.id,
            question: q.question_text || q.question,
            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
            correctAnswer: q.correct_answer,
            explanation: q.explanation
        }));

        await fs.writeFile(path.join(TARGET_DIR, fileName), JSON.stringify(jsonContent, null, 2));
    }

    console.log(`\n📦 Created batches in ${TARGET_DIR}/. Point your master.js SOURCE_DIR to this folder.`);
}

main().catch(console.error);
