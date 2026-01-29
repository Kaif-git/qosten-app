import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';
import { detectAndFixMCQOptions } from './src/utils/mcqFixUtils.js';

const text = `প্রশ্ন ১৩৪:
[বিষয়: জীববিজ্ঞান]
[অধ্যায়: সমন্বয়]
[পাঠ: চলন]
[বোর্ড: N/A]
১৩৪। নিচের চিত্রের ভিত্তিতে ১৬৪-১৬৫ নং প্রশ্নের উত্তর দাও। [এখানে একটি ছবি আছে]
'A' এর জন্য নিচের কোনটি প্রযোজ্য?
ক) আলোক-চলন
খ) ভূ-চলন
গ) জল-চলন
ঘ) রাসায়নিক-চলন
সঠিক: ক
ব্যাখ্যা: ছবি না থাকায়, 'A' সম্ভবত একটি উদ্ভিদ অঙ্কুর আলোর দিকে বাঁকানো দেখায়, যা আলোক-চলনের একটি উদাহরণ।`;

console.log('--- Phase 1: Parsing ---');
const parsedQuestions = parseMCQQuestions(text);
console.log('Parsed Count:', parsedQuestions.length);

console.log('--- Phase 2: Fixing ---');
parsedQuestions.forEach((q, idx) => {
    console.log(`\nProcessing Question ${idx + 1}:`);
    console.log('Initial options count:', q.options.length);
    
    // In QuestionBank.jsx, it often tries to "fix" questions if options are merged
    const fixed = detectAndFixMCQOptions(q);
    if (fixed) {
        console.log('✅ FIXED by detectAndFixMCQOptions');
        console.log('Fixed options count:', fixed.options.length);
        console.log('Fixed question text:', fixed.questionText);
    } else {
        console.log('❌ NOT fixed by detectAndFixMCQOptions (returned null)');
    }
});
