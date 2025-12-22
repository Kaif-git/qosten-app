const parseMCQQuestions = (text, lang = 'en') => {
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = cleanedText.split(/\n---+\n/);
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const lines = section.split('\n').map(line => line.trim()).filter(line => line);
        let currentQuestion = null;
        let currentMetadata = { language: lang };
        let inExplanation = false;

        const saveCurrentQuestion = () => {
            if (currentQuestion) {
                questions.push(currentQuestion);
                currentQuestion = null;
            }
        };

        for (const line of lines) {
            if (/^(Question\s+Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+$/i.test(line)) continue;
            if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) continue;

            if (line.startsWith('[') && line.endsWith(']')) {
                // CORRECTED LINE:
                const match = line.match(/\secutive_line_break_placeholder\[([^\]:]+[:：]\s*([^\]]*))\]/);
                if (match) {
                    const key = match[1].trim().toLowerCase();
                    const value = match[2].trim();
                    const keyMap = {'subject': 'subject', 'বিষয়': 'subject', 'chapter': 'chapter', 'অধ্যায়': 'chapter', 'lesson': 'lesson', 'পাঠ': 'lesson', 'board': 'board', 'বোর্ড': 'board'};
                    if (keyMap[key]) currentMetadata[keyMap[key]] = value;
                }
                inExplanation = false;
                continue;
            }

            // Start of a new question (must have dot or danda, NOT paren to distinguish from numeric options)
            if (/^[\d০-৯]+[।.]\s/.test(line)) {
                saveCurrentQuestion();
                currentQuestion = {
                    ...currentMetadata,
                    type: 'mcq',
                    questionText: line.replace(/^[\d০-৯]+[।.]\s*/, '').trim(),
                    options: [], correctAnswer: '', explanation: ''
                };
                inExplanation = false;
                continue;
            }

            if (!currentQuestion) continue;

            // Updated regex to support Bengali numerals 1-4 (১-৪)
            if (/^(?:[a-dক-ঘ]|[1-4১-৪])[.)\s]/i.test(line)) {
                 const optionMatch = line.match(/^([a-dক-ঘ1-4১-৪])[.)\s]*(.+)$/i);
                 if (optionMatch) {
                    let letter = optionMatch[1].toLowerCase();
                    const text = optionMatch[2].trim();
                    const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                    const numToChar = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
                    const bengaliNumToChar = { '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
                    
                    if (bengaliToEnglish[letter]) letter = bengaliToEnglish[letter];
                    if (numToChar[letter]) letter = numToChar[letter];
                    if (bengaliNumToChar[letter]) letter = bengaliNumToChar[letter];
                    
                    currentQuestion.options.push({ label: letter, text: text });
                 }
                 inExplanation = false;
                 continue;
            }

            if (/^(correct|answer|ans|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]/i.test(line)) {
                const answerMatch = line.match(/^(?:correct|answer|ans|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]\s*(.+)$/i);
                if (answerMatch) {
                    let answer = answerMatch[1].trim().split(/\s+/)[0].toLowerCase();
                     const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                     const numToChar = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
                     const bengaliNumToChar = { '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
                     
                    if (bengaliToEnglish[answer]) answer = bengaliToEnglish[answer];
                    if (numToChar[answer]) answer = numToChar[answer];
                    if (bengaliNumToChar[answer]) answer = bengaliNumToChar[answer];
                    
                    currentQuestion.correctAnswer = answer;
                }
                inExplanation = false; // reset, in case explanation is on next line
                continue;
            }

            const explanationMarker = /^(explanation|explain|exp|bekkha|ব্যাখ্যা)\s*[:=ঃ：]/i;
            if (explanationMarker.test(line)) {
                currentQuestion.explanation = line.replace(explanationMarker, '').trim();
                inExplanation = true;
                if(!currentQuestion.explanation) { // text is on the next line
                  continue;
                }
                continue; // Processed explanation on this line
            }

            if (inExplanation) {
                currentQuestion.explanation += (currentQuestion.explanation ? '\n' : '') + line;
            } else if (currentQuestion.correctAnswer && !currentQuestion.explanation) {
                // If we have a correct answer, any subsequent text is likely explanation
                currentQuestion.explanation = (currentQuestion.explanation ? currentQuestion.explanation + '\n' : '') + line;
                inExplanation = true;
            } else if (currentQuestion.questionText && currentQuestion.options.length === 0) { // Continuation of question text (before options)
                 currentQuestion.questionText += '\n' + line;
            }
        }
        saveCurrentQuestion();
    }
    return questions;
};

const input = `*[বিষয়: পদার্থবিদ্যা]*  
*[অধ্যায়: কার্য]*  
*১।* প্রশ্ন?  
ক) উত্তর ১  
খ) উত্তর ২  
গ) উত্তর ৩  
ঘ) উত্তর ৪  
*সঠিক: খ*  
*ব্যাখ্যা:* ব্যাখ্যা`;

const result = parseMCQQuestions(input, 'bn');
console.log(JSON.stringify(result, null, 2));