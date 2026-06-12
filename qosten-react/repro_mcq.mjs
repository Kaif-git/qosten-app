import fs from 'fs';
import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const filePath = '101 mcqs.txt';
const text = fs.readFileSync(filePath, 'utf8');

console.log('Parsing questions...');
const parsed = parseMCQQuestions(text);

console.log(`\nTotal parsed: ${parsed.length}`);

const parsedNumbers = parsed.map(q => q.questionNumber).filter(n => n);
console.log('Parsed Question Numbers:', parsedNumbers.join(', '));

// Find missing numbers
const allNumbers = [];
const headerRegex = /(?:Question|প্রশ্ন)\s*([\d০-৯]+)[.।:]/gi;
let match;
while ((match = headerRegex.exec(text)) !== null) {
    allNumbers.push(match[1]);
}

const missing = allNumbers.filter(n => !parsedNumbers.includes(n));
console.log('Missing Question Numbers:', missing.join(', '));

if (missing.length > 0) {
    console.log('\nDetailed check of first missing question:');
    const firstMissing = missing[0];
    const lines = text.split('\n');
    let found = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`Question ${firstMissing}:`) || lines[i].includes(`প্রশ্ন ${firstMissing}:`)) {
            console.log(`Found Question ${firstMissing} at line ${i + 1}`);
            console.log('Context around line ' + (i + 1) + ':');
            console.log(lines.slice(Math.max(0, i - 5), i + 15).join('\n'));
            found = true;
            break;
        }
    }
    if (!found) console.log(`Could not find Question ${firstMissing} in text using simple search.`);
}
