import fs from 'fs';
import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const filePath = 'D:\\OpenClawAutomations\\Super Question Processing\\organized_output\\Higher_Mathematics\\Ch2_MCQ\\Ch2_MCQ_ENGLISH.txt';
const text = fs.readFileSync(filePath, 'utf8');

const parsed = parseMCQQuestions(text);

const seen = new Map();
const duplicates = [];

parsed.forEach((q, index) => {
    const key = q.questionText;
    if (seen.has(key)) {
        duplicates.push({ index, duplicateOf: seen.get(key), text: key });
    } else {
        seen.set(key, index);
    }
});

console.log('Total parsed:', parsed.length);
if (duplicates.length > 0) {
    console.log('❌ Duplicates found:');
    duplicates.forEach(d => {
        console.log(`Question ${d.index + 1} is a duplicate of Question ${d.duplicateOf + 1}`);
        console.log('Text:', d.text);
    });
} else {
    console.log('✅ No duplicates found.');
}
