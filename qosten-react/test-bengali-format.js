import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const testInput = `[বিষয়: পদার্থবিজ্ঞান]
[অধ্যায়:ভৌত রাশি ও তাদের পরিমাপ]
[পাঠ:পদার্থবিজ্ঞানের পরিচয়]
[বোর্ড:ঢাবি-২৪; বরিশাল-२১]
१.কোয়ান্টাম তত্ত্ব ও আপেক্ষিকতার তত্ত্বের সমন্বয় করে কে প্রতিকণার অস্তিত্ব অনুমান করেন?
ক)ডিরাক
খ)রন্টজেন
গ)বেকেরেল
ঘ)মেরি কুরি
সঠিক:ক
ব্যাখ্যা:
ডিরাক কোয়ান্টাম তত্ত্ব ও আপেক্ষিকতার সমন্বয় করেপ্রতিদ্রব্য (antimatter), বিশেষ করে পজিট্রনের অস্তিত্ব অনুমান করেছিলেন।`;

console.log('Testing Bengali MCQ format...\n');
const questions = parseMCQQuestions(testInput);

console.log('\n\n=== PARSED QUESTIONS ===');
questions.forEach((q, idx) => {
  console.log(`\nQuestion ${idx + 1}:`);
  console.log('Subject:', q.subject);
  console.log('Chapter:', q.chapter);
  console.log('Lesson:', q.lesson);
  console.log('Board:', q.board);
  console.log('Question:', q.questionText);
  console.log('Options:');
  q.options.forEach(opt => {
    console.log(`  ${opt.label}) ${opt.text}`);
  });
  console.log('Correct Answer:', q.correctAnswer);
  console.log('Explanation:', q.explanation);
});
