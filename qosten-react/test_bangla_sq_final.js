

const parseSQQuestions = (text, lang = 'en') => {
    // Normalize to NFC to handle Bangla characters consistently
    const cleanedText = text.normalize('NFC').replace(/\u200b/g, '').replace(/\*+/g, '');
    // Split by horizontal rules, hash markers, or when a new metadata block starts (preceded by newline)
    const sections = ('\n' + cleanedText).split(/\n(?:---+|###|(?=\[?(?:Subject|Topic|\u09ac\u09bf\u09b7\u09df|\u09ac\u09bf\u09b7\u09df)[:\u0983:])/i).filter(s => s.trim());
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const allLines = section.split('\n');
        
        // 1. Extract metadata and clean up lines
        let sectionMetadata = { type: 'sq', language: lang };
        let cleanLines = [];
        
        // Robust metadata regex supporting both [Key: Value] and Key: Value formats
        const metadataRegex = /^(?:\s*\[)?(Subject|Topic|Chapter|Lesson|Board|\u09ac\u09bf\u09b7\u09df|\u09ac\u09bf\u09b7\u09df|\u0985\u09a7\u09cd\u09af\u09be\u09af|\u09aa\u09be\u09a0|\u09ac\u09cb\u09b0\u09cd\u09a1)[:\u0983:]\s*([^\]\n]*?)(?:\s*\])?$/i;
        
        for (const line of allLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const metaMatch = trimmed.match(metadataRegex);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                const keyMap = {
                    'subject': 'subject', 'topic': 'subject', 'বিষয়': 'subject', 'বিষয়': 'subject',
                    'chapter': 'chapter', 'অধ্যায়': 'chapter',
                    'lesson': 'lesson', 'পাঠ': 'lesson',
                    'board': 'board', 'বোর্ড': 'board'
                };
                if (keyMap[key]) sectionMetadata[keyMap[key]] = value;
            } else {
                cleanLines.push(trimmed);
            }
        }
        
        const saveCurrentQuestion = () => {
            if (currentQuestion && (currentQuestion.question || currentQuestion.answer)) {
                // If we only have an answer but it's empty space placeholder, don't save
                if (currentQuestion.answer === ' ' && !currentQuestion.question) {
                    currentQuestion = null;
                    return;
                }
                questions.push(currentQuestion);
            }
            currentQuestion = null;
        };

        // Check if this section uses explicit "Question X" prefixes
        const usesQuestionPrefix = cleanLines.some(l => /^(?:Question|\u09aa\u09cd\u09b0\u09b6\u09cd\u09a8|Q\.?|\u09b8\u09c3\u099c\u09a8\u09b6\u09c0\u09b2\s+\u09aa\u09cd\u09b0\u09b6\u09cd\u09a8)\s*[\d\u09e6-\u09ef টে]+/i.test(l));

        let currentQuestion = null;
        for (const line of cleanLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Detect "Question X" headers as new question starts
            const questionHeaderMatch = trimmed.match(/^(?:Question|\u09aa\u09cd\u09b0\u09b6\u09cd\u09a8|Q\.?|\u09b8\u09c3\u099c\u09a8\u09b6\u09c0\u09b2\s+\u09aa\u09cd\u09b0\u09b6\u09cd\u09a8)\s*([\d\u09e6-\u09ef টে]+)/i;
            if (questionHeaderMatch && trimmed.length < 50) {
                saveCurrentQuestion();
                currentQuestion = { ...sectionMetadata, question: '', answer: '' };
                
                // If there's more text after "Question X:", use it as the beginning of question text
                const afterHeader = trimmed.replace(/^(?:Question|\u09aa\u09cd\u09b0\u09b6\u09cd\u09a8|Q\.?|\u09b8\u09c3\u099c\u09a8\u09b6\u09c0\u09b2\s+\u09aa\u09cd\u09b0\u09b6\u09cd\u09a8)\s*[\d\u09e6-\u09ef টে]*[:\u0983:]?\s*/i, '').trim();
                if (afterHeader) {
                    currentQuestion.question = afterHeader;
                }
                continue;
            }

            // Detect new question start (digit followed by separator, e.g., "1. ")
            if (/^[\d\u09e6-\u09ef]+[।.)\s]/.test(trimmed)) {
                // If we are using Question X prefixes, don't let a plain digit start a new question if we're already in an answer
                // This prevents numbered lists in answers from being treated as new questions
                const isInsideAnswer = currentQuestion && (currentQuestion.answer && currentQuestion.answer.trim());
                
                if (!usesQuestionPrefix || !isInsideAnswer) {
                    saveCurrentQuestion();
                    currentQuestion = { ...sectionMetadata, question: '', answer: '' };

                    let text = trimmed.replace(/^[\[\]\d\u09e6-\u09ef]+[।.)\s]*/, '').trim();
                    const inlineAnswerMatch = text.match(/(answer|ans|\u0989\u09a4\u09cd\u09a4\u09b0)\s*[:=:\u0983]\s*(.*)/i);
                    if (inlineAnswerMatch) {
                        currentQuestion.question = text.substring(0, inlineAnswerMatch.index).trim();
                        currentQuestion.answer = inlineAnswerMatch[2].trim();
                    } else {
                        currentQuestion.question = text;
                    }
                    continue;
                }
            }

            if (!currentQuestion) continue;

            // Detect answer marker
            const answerMatch = trimmed.match(/^(?:answer|ans|\u0989\u09a4\u09cd\u09a4\u09b0)\s*[:=:\u0983]\s*(.+)$/i) || 
                                (trimmed.match(/^(?:answer|ans|\u0989\u09a4\u09cd\u09a4\u09b0)\s*[:=:\u0983]?$/i) ? [trimmed, ""] : null);
            
            if (answerMatch) {
                if (answerMatch[1]) {
                    currentQuestion.answer = (currentQuestion.answer && currentQuestion.answer.trim() ? currentQuestion.answer + '\n' : '') + answerMatch[1].trim();
                } else if (!currentQuestion.answer) {
                    currentQuestion.answer = ' '; // Mark as started
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

const input = `[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]
[অধ্যায়: পূর্ব বাংলার রাজনৈতিক আন্দোলন ও জাতীয়তাবাদের উত্থান (১৯৪৭-১৯৭০)]
[পাঠ: ভাষা আন্দোলনের ভূমিকা: বাঙালি জাতীয়তাবাদের বিকাশ]
[বোর্ড: ]

প্রশ্ন ১
পূর্ব বাংলা কীভাবে পাকিস্তানের একটি প্রদেশে পরিণত হয়?

উত্তর:
১৯৪৭ সালে ভারতবর্ষে ব্রিটিশ শাসনের অবসান ঘটে। ফলে দুটি স্বাধীন রাষ্ট্র ভারত ও পাকিস্তানের জন্ম হয়। পূর্ব বাংলা ও পশ্চিম বাংলা তখন একই ভৌগোলিক অঞ্চলের অংশ ছিল। কিন্তু পূর্ব বাংলা মুসলিম অধ্যুষিত এলাকা হওয়ায় পাকিস্তানের একটি প্রদেশে পরিণত হয়। পাকিস্তানের প্রদেশ হওয়ার পর এর নামকরণ করা হয় পূর্ব পাকিস্তান।

---

[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]
[অধ্যায়: পূর্ব বাংলার রাজনৈতিক আন্দোলন ও জাতীয়তাবাদের উত্থান (১৯৪৭-১৯৭০)]
[পাঠ: ভাষা আন্দোলনের ভূমিকা: বাঙালি জাতীয়তাবাদের বিকাশ]
[বোর্ড: ]

প্রশ্ন ২
আন্তর্জাতিক মাতৃভাষা দিবস কী?

উত্তর:
১৯৯৯ সালের ১৭ নভেম্বর জাতিসংঘের সহযোগী সংস্থা ইউনেস্কো বাংলাদেশের শহীদ দিবস ২১ ফেব্রুয়ারিকে আন্তর্জাতিক মাতৃভাষা দিবস হিসেবে ঘোষণা করে। বাংলাকে রাষ্ট্রভাষা হিসেবে প্রতিষ্ঠার জন্য বাঙালি জাতির তীব্র আন্দোলন ১৯৫২ সালের ২১ ফেব্রুয়ারি রক্তাক্ত রূপ ধারণ করে। এ দিন পাকিস্তানি পুলিশ বাহিনী বিক্ষোভকারীদের উপর গুলি চালালে বহু লোক শহীদ হন। মাতৃভাষার জন্য বাঙালিদের এই আত্মত্যাগ ইতিহাসে একটি বিরল ঘটনা। বাঙালি জাতির ভাষার প্রতি ভালোবাসা ও তাদের আত্মত্যাগের মহিমাকে অমর করে রাখতে ইউনেস্কো ২১ ফেব্রুয়ারিকে আন্তর্জাতিক মাতৃভাষা দিবস ঘোষণা করে.
`;

const result = parseSQQuestions(input);
console.log(`Parsed ${result.length} questions`);
result.forEach((q, i) => {
    console.log(`--- Question ${i+1} ---`);
    console.log(`Q: ${q.question}`);
    console.log(`A: ${q.answer}`);
});
