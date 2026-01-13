const parseSQQuestions = (text, lang = 'en') => {
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = ('\n' + cleanedText).split(/\n(?:---+|###|(?=\[?(?:Subject|Topic|বিষয়|বিষয়)[:ঃ]))/i).filter(s => s.trim());
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const allLines = section.split('\n');
        let sectionMetadata = { type: 'sq', language: lang };
        let cleanLines = [];
        for (const line of allLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            cleanLines.push(trimmed);
        }
        
        let currentQuestion = null;
        const saveCurrentQuestion = () => {
            if (currentQuestion && currentQuestion.question) {
                questions.push(currentQuestion);
            }
            currentQuestion = null;
        };

        for (const line of cleanLines) {
            const trimmed = line.trim();
            console.log(`TRIMMED: [${trimmed}] (${trimmed.length} chars)`);
            
            if (trimmed.startsWith('প্রশ্ন')) {
                console.log(`  Detected Question start`);
                saveCurrentQuestion();
                currentQuestion = { ...sectionMetadata, question: '', answer: '' };
                continue;
            }

            if (trimmed.startsWith('উত্তর')) {
                console.log(`  Detected Answer start via startsWith`);
                if (currentQuestion) {
                   currentQuestion.answer = ' ';
                   continue;
                }
            }

            if (!currentQuestion) continue;

            if (currentQuestion.answer === ' ') {
                currentQuestion.answer = trimmed;
            } else if (currentQuestion.answer) {
                currentQuestion.answer += '\n' + trimmed;
            } else {
                currentQuestion.question = (currentQuestion.question ? currentQuestion.question + '\n' : '') + trimmed;
            }
        }
        saveCurrentQuestion();
    }
    return questions;
};

const input = `প্রশ্ন ১
পূর্ব বাংলা কীভাবে পাকিস্তানের একটি প্রদেশে পরিণত হয়?

উত্তর:
১৯৪৭ সালে ভারতবর্ষে ব্রিটিশ শাসনের অবসান ঘটে।`;

const result = parseSQQuestions(input);
console.log(`Parsed ${result.length} questions`);
if (result.length > 0) {
    console.log(`Q: ${result[0].question}`);
    console.log(`A: ${result[0].answer}`);
}