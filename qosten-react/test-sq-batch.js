const parseSQQuestions = (text, lang = 'en') => {
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = cleanedText.split(/\n---+\n/);
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const lines = section.split('\n').map(line => line.trim()).filter(line => line);
        let currentQuestion = null;
        let currentMetadata = { type: 'sq', language: lang };

        const saveCurrentQuestion = () => {
            if (currentQuestion && currentQuestion.question) {
                questions.push(currentQuestion);
            }
            currentQuestion = null;
        };

        for (const line of lines) {
            if (line.startsWith('[') && line.endsWith(']')) {
                 console.log("Found metadata candidate:", line);
                 const match = line.match(/\ Raipur:([^:ঃ]+)[:ঃ]\s*([^\]]*)\]/);
                 if (match) {
                    const key = match[1].trim().toLowerCase();
                    const value = match[2].trim();
                    console.log(`Parsed key: '${key}', value: '${value}'`);
                    const keyMap = {'subject': 'subject', 'বিষয়': 'subject', 'chapter': 'chapter', 'অধ্যায়': 'chapter', 'lesson': 'lesson', 'পাঠ': 'lesson', 'board': 'board', 'বোর্ড': 'board'};
                    if (keyMap[key]) {
                        currentMetadata[keyMap[key]] = value;
                        console.log("Updated metadata:", JSON.stringify(currentMetadata));
                    } else {
                        console.log("Key not in map:", key);
                    }
                 } else {
                     console.log("Regex match failed for:", line);
                 }
                 continue;
            }

            if (/^(প্রয়োগী|জ্ঞানমূলক|বোধমূলক)/.test(line)) continue;

            if (/^[\d০-৯]+[।.)\s]/.test(line)) {
                saveCurrentQuestion(); // Save previous question
                console.log("Starting new question with metadata:", JSON.stringify(currentMetadata));
                currentQuestion = { ...currentMetadata, question: '', answer: '' };

                let text = line.replace(/^[\d০-৯]+[।.)\s]*/, '').trim();
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

const input = `**[Subject: Biology]**
**[Chapter: Biology and Classification of Living Organisms]**
**[Lesson: Concept of Biology and its Branches]**
**[Board: D.B.-21]**
**1.** What is physical biology?
**Answer:** The branch of biology where theoretical concepts are usually discussed is called physical biology.

**[Subject: Biology]**
**[Chapter: Biology and Classification of Living Organisms]**
**[Lesson: Lessons on Life]**
**[Board: ]**
**12.** What is paleontology?
**Answer:** Paleontology or the science of fossils is a branch of science where prehistoric animals are described and fossils are studied.`;

console.log("Testing with input (Subset for brevity)...");
const questions = parseSQQuestions(input);