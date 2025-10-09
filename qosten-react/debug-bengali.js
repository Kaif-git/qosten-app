import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const testInput = `**[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]**  
**[অধ্যায়: বাংলাদেশের স্বাধীনতা]**  
**[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি, সশস্ত্র সংগ্রাম ও সার্বভৌম বাংলাদেশের উদ্ভব]**  
**[বোর্ড: ডি.বি.-২৪]**  
**৩.** "অপারেশন সার্চলাইট"-এর মূল পরিকল্পনাকারী কে ছিলেন?  
ক) ইয়াহিয়া খান  
খ) আইয়ুব খান  
গ) রাও ফরমান আলী  
ঘ) জুলফিকার আলী ভুট্টো  
**সঠিক:** গ  
**ব্যাখ্যা:** মেজর জেনারেল রাও ফরমান আলী পাকিস্তান সেনাবাহিনীর একজন উচ্চপদস্থ কর্মকর্তা ছিলেন এবং তিনি ১৯৭১ সালের মুক্তিযুদ্ধ গণহত্যার মূল পরিকল্পনাকারী হিসেবে বিবেচিত হন।`;

console.log('Testing Bengali format with double asterisks...\n');
console.log('Input length:', testInput.length);
console.log('First line:', testInput.split('\n')[0]);
console.log('\n---Parsing---\n');

const parsed = parseMCQQuestions(testInput);

console.log('Parsed questions:', parsed.length);
console.log('\n');

if (parsed.length > 0) {
  parsed.forEach((q, idx) => {
    console.log(`Question ${idx + 1}:`);
    console.log(`  Subject: "${q.subject}"`);
    console.log(`  Chapter: "${q.chapter}"`);
    console.log(`  Lesson: "${q.lesson}"`);
    console.log(`  Board: "${q.board}"`);
    console.log(`  Question: "${q.questionText?.substring(0, 80)}..."`);
    console.log(`  Options: ${q.options.length}`);
    q.options.forEach(opt => {
      console.log(`    ${opt.label}) ${opt.text.substring(0, 50)}...`);
    });
    console.log(`  Correct: "${q.correctAnswer}"`);
    console.log(`  Explanation: "${q.explanation?.substring(0, 80)}..."`);
    console.log('');
  });
} else {
  console.log('❌ No questions parsed!');
  console.log('\nLet me check line by line...\n');
  
  const lines = testInput.split('\n').map(line => line.trim()).filter(line => line);
  lines.forEach((line, idx) => {
    console.log(`Line ${idx + 1}: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`);
    
    // Test each regex
    if (line.match(/^\*{0,2}\[(Subject|বিষয়):/i)) {
      console.log('  ✅ Matches Subject/বিষয়');
    }
    if (line.match(/^\*{0,2}\[(Chapter|অধ্যায়):/i)) {
      console.log('  ✅ Matches Chapter/অধ্যায়');
    }
    if (line.match(/^\*{0,2}\[(Lesson|পাঠ):/i)) {
      console.log('  ✅ Matches Lesson/পাঠ');
    }
    if (line.match(/^\*{0,2}\[(Board|বোর্ড):/i)) {
      console.log('  ✅ Matches Board/বোর্ড');
    }
    if (line.match(/^\*{0,2}[\d০-৯]+\.\*{0,2}/)) {
      console.log('  ✅ Matches Question number');
    }
    if (line.match(/^[a-dক-ঘ]\)/)) {
      console.log('  ✅ Matches Option');
    }
    if (line.match(/^\*{0,2}(Correct|সঠিক):/i)) {
      console.log('  ✅ Matches Correct/সঠিক');
    }
    if (line.match(/^\*{0,2}(Explanation|ব্যাখ্যা):/i)) {
      console.log('  ✅ Matches Explanation/ব্যাখ্যা');
    }
  });
}
