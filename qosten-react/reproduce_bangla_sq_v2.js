const parseSQQuestions = (text, lang = 'en') => {
    const cleanedText = text.normalize('NFC').replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = ('\n' + cleanedText).split(/\n(?:---+|###|(?=\[?(?:Subject|Topic|বিষয়|বিষয়)[:ঃ]))/i).filter(s => s.trim());
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;
        const allLines = section.split('\n');
        let cleanLines = [];
        for (const line of allLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            cleanLines.push(trimmed);
        }
        
        let currentQuestion = null;
        const saveCurrentQuestion = () => {
            if (currentQuestion && (currentQuestion.question || currentQuestion.answer)) {
                questions.push(currentQuestion);
            }
            currentQuestion = null;
        };

        const usesQuestionPrefix = cleanLines.some(l => /^(?:Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)\s*[\d০-৯টে]+/i.test(l));

        for (const line of cleanLines) {
            const trimmed = line.trim();
            
            function dump(s) {
                return s.split('').map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
            }

            if (trimmed.includes('উত্তর')) {
                console.log(`[DEBUG] Potential answer line: "${trimmed}" (Hex: ${dump(trimmed)})`);
            }

            const questionHeaderMatch = trimmed.match(/^(?:Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)\s*([\d০-৯টে]+)/i);
            if (questionHeaderMatch && trimmed.length < 50) {
                saveCurrentQuestion();
                currentQuestion = { question: '', answer: '' };
                continue;
            }

            if (!currentQuestion) continue;

            const answerMatch = trimmed.match(/^(?:answer|ans|উত্তর)\s*[:=ঃ]\s*(.+)$/i) || 
                                (trimmed.match(/^(?:answer|ans|উত্তর)\s*[:=ঃ]?$/i) ? [trimmed, ""] : null);
            
            if (answerMatch) {
                console.log(`  [DEBUG] Matched Answer Header! (Match: ${JSON.stringify(answerMatch)})`);
                if (answerMatch[1]) {
                    currentQuestion.answer = answerMatch[1].trim();
                } else if (!currentQuestion.answer) {
                    currentQuestion.answer = ' ';
                }
                continue;
            }

            if (currentQuestion.answer && currentQuestion.answer.trim()) {
                currentQuestion.answer += '\n' + trimmed;
            } else if (currentQuestion.answer === ' ') {
                currentQuestion.answer = trimmed;
            } else {
                currentQuestion.question = (currentQuestion.question && currentQuestion.question.trim() ? currentQuestion.question + '\n' : '') + trimmed;
            }
        }
        saveCurrentQuestion();
    }
    return questions;
};

const input = `প্রশ্ন ১৬
ঐতিহাসিক আগরতলা মামলা দায়েরের পটভূমি ব্যাখ্যা কর।

উত্তর:
ঐতিহাসিক আগরতলা মামলা দায়ের করা হয়েছিল বাঙালিদের ৬ দফাভিত্তিক জাতীয়তাবাদী আন্দোলনকে ব্যাহত করার জন্য।`;

parseSQQuestions(input);