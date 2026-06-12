import fs from 'fs';
import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const filePath = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch2_MCQ\\Ch2_MCQ_ENGLISH.txt';
const text = fs.readFileSync(filePath, 'utf8');

const parsed = parseMCQQuestions(text);

// Count how many "Question X:" markers are in the text to get expected count
const expectedMatch = text.match(/Question \d+:/g);
const expectedCount = expectedMatch ? expectedMatch.length : 0;

console.log('Expected questions (based on "Question X:" markers):', expectedCount);
console.log('Parsed questions count:', parsed.length);

if (parsed.length !== expectedCount) {
    console.log('❌ Bug reproduced! Parsed count does not match expected count.');
    console.log(`Difference: ${parsed.length - expectedCount} extra questions.`);
    
    // Find where it starts diverging
    for (let i = 0; i < parsed.length; i++) {
        // This is a simplistic check, but we can look for duplicated IDs or content
        // Or just log the first few that might be problematic
        if (i >= expectedCount) {
            console.log(`Extra Question ${i+1}:`, JSON.stringify(parsed[i], null, 2));
            break;
        }
    }
} else {
    console.log('✅ Bug not reproduced with this file.');
}
