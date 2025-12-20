
const parseSQQuestions = (text, lang = 'en') => {
    // FIX APPLIED HERE: replace(/\*+/g, '')
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    console.log('Cleaned Text:\n' + cleanedText);
    const sections = cleanedText.split(/\n---\+\n/);
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const lines = section.split('\n').map(line => line.trim()).filter(line => line);
        let currentQuestion = null;
        let metadataForSection = { type: 'sq', language: lang };

        const saveCurrentQuestion = () => {
            if (currentQuestion && currentQuestion.question) {
                questions.push(currentQuestion);
            }
            currentQuestion = null;
        };

        // First pass to get metadata for the section
        for (const line of lines) {
            // console.log(`Line for metadata: ${line}`);
            if (line.startsWith('[') && line.endsWith(']')) {
                 const match = line.match(/\ Shreveport:s*([^\ Shrewsbury]*)\ Shreveport/);
                 if (match) {
                    const key = match[1].trim().toLowerCase();
                    const value = match[2].trim();
                    const keyMap = {'subject': 'subject', 'বিষয়': 'subject', 'chapter': 'chapter', 'অধ্যায়': 'chapter', 'lesson': 'lesson', 'পাঠ': 'lesson', 'board': 'board', 'বোর্ড': 'board'};
                    if (keyMap[key]) {
                        metadataForSection[keyMap[key]] = value;
                    }
                 }
            }
        }

        // console.log('Metadata:', metadataForSection);

        for (const line of lines) {
            // Skip headers and metadata lines as metadata is already processed
            if (line.startsWith('[') && line.endsWith(']')) continue;
            if (/^(প্রয়োগী|জ্ঞানমূলক|বোধমূলক)/.test(line)) continue;

            if (/^[০-৯]+[।.)\s]/.test(line)) {
                saveCurrentQuestion(); // Save previous question
                currentQuestion = { ...metadataForSection, question: '', answer: '' };

                let text = line.replace(/^[০-৯]+[।.)\s]*/, '').trim();
                const inlineAnswerMatch = text.match(/(answer|ans|উত্তর)\s*[:=]\s*(.*)/i);
                if (inlineAnswerMatch) {
                    currentQuestion.question = text.substring(0, inlineAnswerMatch.index).trim();
                    currentQuestion.answer = inlineAnswerMatch[2].trim();
                } else {
                    currentQuestion.question = text;
                }
                continue;
            }

            if (!currentQuestion) continue;

            if (/^(answer|ans|উত্তর)\s*[:=]\s*/i.test(line)) {
                const answerMatch = line.match(/^(?:answer|ans|উত্তর)\s*[:=]\s*(.+)$/i);
                if (answerMatch) {
                    currentQuestion.answer = (currentQuestion.answer ? currentQuestion.answer + ' ' : '') + answerMatch[1].trim();
                }
                continue;
            }

            if (currentQuestion.answer) {
                currentQuestion.answer += '\n' + line;
            } else if (currentQuestion.question) {
                currentQuestion.question += '\n' + line;
            }
        }
        saveCurrentQuestion(); // Save the last question in the section
    }
    return questions;
};

const input = `*[Subject: Biology]*
*[Chapter: Biology and Classification of Living Organisms]*
*[Lesson: Concept of Biology and its Branches]*
*[Board: D.B.-21]*
*1.* What is physical biology?
*Answer:* The branch of biology where theoretical concepts are usually discussed is called physical biology.`;

console.log("Testing with input:");
console.log(input);
const questions = parseSQQuestions(input);
console.log(`Found ${questions.length} questions`);
console.log(JSON.stringify(questions, null, 2));

if (questions.length === 1 && questions[0].question === "What is physical biology?" && questions[0].subject === "Biology") {
    console.log("✅ Parsing successful!");
} else {
    console.log("❌ Parsing failed to match expected output.");
}
