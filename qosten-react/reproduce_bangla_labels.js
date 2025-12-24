const { parseCQQuestions } = require('./src/utils/cqParser');

const testInput = String.raw`[Subject: Mathematics]
Question: (চট্টগ্রাম বোর্ড-২০২৪)

স্টেম (ইংরেজি):
(i) x/y+y/x=18 (ii) log(4z−1)/logz=2
অধ্যায় ৯ ও ১০ সংযুক্ত

স্টেম (ইংরেজি):
(i) C=(1−x)^6 , D=(1+x)^7  (ii) (x−1)^−1+(x−1)^−2+(x−1)^−3+......
অধ্যায় ৭ ও ১০ সংযুক্ত

ক. প্রশ্ন ক? ২
খ. প্রশ্ন খ? ৪
গ. প্রশ্ন গ? ৪

Answer:
ক. উত্তর ক
খ. উত্তর খ
গ. উত্তর গ`;

const questions = parseCQQuestions(testInput, 'bn');
if (questions.length > 0) {
    const q = questions[0];
    console.log('Board:', q.board);
    console.log('Question Text:', q.questionText);
    
    if (q.questionText.includes('স্টেম')) {
        console.error('FAILED: "স্টেম" label found in questionText!');
    } else if (q.questionText.includes('চট্টগ্রাম বোর্ড')) {
        console.error('FAILED: Board info found in questionText!');
    } else if (q.questionText.includes('Question:')) {
        console.error('FAILED: "Question:" label found in questionText!');
    } else {
        console.log('SUCCESS: Bangla labels are hidden and content is preserved.');
    }
} else {
    console.error('FAILED: No questions parsed!');
}
