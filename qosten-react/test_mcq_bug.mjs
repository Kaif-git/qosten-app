import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const inputText = `প্রশ্ন ২:
[আইডি: ১৭৬৮২২৫০৬২১৯২]
[বিষয়: রসায়ন]
[অধ্যায়: রসায়ন ও শক্তি]
[পাঠ: প্রাকৃতিক উপকরণের রাসায়নিক গঠন]
[বোর্ড: প্রযোজ্য নয়]
১৮. শামুকের খোলসে \\(\\text{CaCO}_3\\) এর পরিমাণ –
ক) ৫০%
খ) ১০০%
গ) ৯৮%
ঘ) ৯৯%
সঠিক উত্তর: গ
ব্যাখ্যা: শামুকের খোলস প্রাথমিকভাবে ক্যালসিয়াম কার্বনেট (\\(\\text{CaCO}_3\\)) দিয়ে গঠিত। এতে কিছু জৈব প্রোটিন (কনচিওলিন) থাকলেও, খনিজ উপাদানের পরিমাণ অত্যন্ত বেশি, সাধারণত প্রায় ৯৮%।`;

const parsed = parseMCQQuestions(inputText);
console.log(JSON.stringify(parsed, null, 2));

// Validate
if (parsed.length === 0) {
  console.log('\n❌ FAIL: No questions parsed!');
} else {
  parsed.forEach((q, i) => {
    console.log(`\n--- Question ${i + 1} ---`);
    console.log('questionNumber:', q.questionNumber);
    console.log('questionText:', q.questionText?.substring(0, 60));
    console.log('subject:', q.subject);
    console.log('chapter:', q.chapter);
    console.log('lesson:', q.lesson);
    console.log('board:', q.board);
    console.log('options:', JSON.stringify(q.options));
    console.log('correctAnswer:', q.correctAnswer);
    console.log('explanation:', q.explanation?.substring(0, 60));
    
    const issues = [];
    if (!q.questionText) issues.push('Missing questionText');
    if (!q.options || q.options.length < 2) issues.push(`Has ${q.options?.length || 0} options`);
    if (!q.correctAnswer) issues.push('Missing correctAnswer');
    if (q.options && q.options.some(o => o.label === 'i' || o.label === 'ii' || o.label === 'iii' || o.label === 'iv')) issues.push('Has Roman numeral options');
    if (issues.length) console.log('❌ ISSUES:', issues.join(', '));
    else console.log('✅ OK');
  });
}
