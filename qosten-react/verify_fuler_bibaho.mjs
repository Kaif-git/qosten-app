import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';
import fs from 'fs';

const filePath = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\combined\\Fuler bibaho\\combined_MCQ.txt';
const text = fs.readFileSync(filePath, 'utf8');
const parsed = parseMCQQuestions(text);

console.log(`Total Questions Found: ${parsed.length}\n`);

// We will split the original text by blank lines to get a rough mapping of blocks
const originalBlocks = text.split(/\n\s*\n/).filter(b => b.trim());

for (let i = 0; i < Math.min(5, parsed.length); i++) {
    const q = parsed[i];
    const original = originalBlocks[i] || 'Original text block not found';
    
    console.log(`--- Question ${i+1} ---`);
    console.log(`[ORIGINAL TEXT]:\n${original.trim()}\n`);
    console.log(`[PARSED DATA]:`);
    console.log(`Subject: ${q.subject}`);
    console.log(`Chapter: ${q.chapter}`);
    console.log(`Question: ${q.questionText}`);
    console.log(`Options: ${q.options.map(o => `${o.label}) ${o.text}`).join(', ')}`);
    console.log(`Correct: ${q.correctAnswer}`);
    console.log(`Explanation: ${q.explanation}`);
    console.log(`\n${'='.repeat(40)}\n`);
}
