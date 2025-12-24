/**
 * Parse CQ (Creative Questions) from text.
 * Supports both English and Bangla formats.
 * 
 * @param {string} text - The raw text to parse.
 * @param {string} lang - 'en' or 'bn'.
 * @returns {Array} - Array of parsed question objects.
 */
export const parseCQQuestions = (text, lang = 'en') => {
    console.log('🔍 parseCQQuestions: Starting...');
    console.log('📄 Input length:', text.length);
    
    // Clean up the text: remove markdown bold ** and zero-width spaces
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    
    const lines = cleanedText.split('\n').map(line => line.trim());
    const questions = [];
    
    // State variables
    let currentQuestion = null;
    let pendingMetadata = {}; // Persist metadata across questions
    
    // Helper to save the current question and reset
    const saveCurrentQuestion = () => {
        if (currentQuestion) {
            // Finalize question text from lines if not set
            if (!currentQuestion.questionText && currentQuestion._state.questionTextLines.length > 0) {
                currentQuestion.questionText = currentQuestion._state.questionTextLines.join('\n').trim();
            }

            // If the question has content (text or parts), save it
            if ((currentQuestion.questionText && currentQuestion.questionText.trim()) || currentQuestion.parts.length > 0) {
                // Apply pending metadata if missing
                if (!currentQuestion.subject && pendingMetadata.subject) currentQuestion.subject = pendingMetadata.subject;
                if (!currentQuestion.chapter && pendingMetadata.chapter) currentQuestion.chapter = pendingMetadata.chapter;
                if (!currentQuestion.lesson && pendingMetadata.lesson) currentQuestion.lesson = pendingMetadata.lesson;
                if (!currentQuestion.board && pendingMetadata.board) currentQuestion.board = pendingMetadata.board;
                
                // Update pending metadata for the NEXT question (inheritance)
                if (currentQuestion.subject) pendingMetadata.subject = currentQuestion.subject;
                if (currentQuestion.chapter) pendingMetadata.chapter = currentQuestion.chapter;
                if (currentQuestion.lesson) pendingMetadata.lesson = currentQuestion.lesson;
                if (currentQuestion.board) pendingMetadata.board = currentQuestion.board;
                
                // Clean up empty parts
                currentQuestion.parts = currentQuestion.parts.filter(part => part.text.trim());
                
                if (currentQuestion.parts.length > 0) {
                    questions.push(currentQuestion);
                    console.log(`  💾 Question saved. Subject: ${currentQuestion.subject}, Board: ${currentQuestion.board}, Parts: ${currentQuestion.parts.length}`);
                } else {
                    console.log(`  ⚠️ Question skipped (no parts). Text length: ${currentQuestion.questionText.length}`);
                }
            } else if (currentQuestion.subject || currentQuestion.chapter || currentQuestion.lesson || currentQuestion.board) {
                // It was just a metadata block, update pendingMetadata
                if (currentQuestion.subject) pendingMetadata.subject = currentQuestion.subject;
                if (currentQuestion.chapter) pendingMetadata.chapter = currentQuestion.chapter;
                if (currentQuestion.lesson) pendingMetadata.lesson = currentQuestion.lesson;
                if (currentQuestion.board) pendingMetadata.board = currentQuestion.board;
                console.log('  📌 Metadata block updated:', JSON.stringify(pendingMetadata));
            }
        }
        currentQuestion = null;
    };

    // Helper to create a new question object
    const startNewQuestion = () => {
        saveCurrentQuestion();
        currentQuestion = {
            type: 'cq',
            language: lang,
            questionText: '',
            parts: [],
            subject: '',
            chapter: '',
            lesson: '',
            board: '',
            image: null,
            _state: {
                inAnswerSection: false,
                inStimulusSection: false,
                inQuestionSection: false,
                hasStartedParts: false,
                questionTextLines: [],
                stimulusLines: [],
                currentAnswerPart: null,
                useBulletPointFormat: false
            }
        };
    };

    // Initial question object
    startNewQuestion();

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Skip purely empty lines if they don't have meaning (e.g. at start)
        // But we want to preserve empty lines inside answers.
        const isEmptyLine = line === '';
        
        // --- 1. Detect New Question Signals ---
        
        // Header: "Question X" or "সৃজনশীল প্রশ্ন X" or "প্রশ্ন X"
        // Only if line is short (to avoid matching inside a sentence)
        // Updated: Strictly require digits to avoid matching "প্রশ্ন শুরু" etc.
        const isQuestionHeader = /^(Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)\s*[\d\u09E6-\u09EF\u0982]+/i.test(line) && line.length < 50;
        
        // Separator: "---"
        const isSeparator = /^---+$/.test(line);
        
        // Metadata Block Start: [Subject: ...]
        // Updated: Allow optional spaces around brackets and keys (e.g. [ Subject: ... ])
        // Added alternative spelling for 'Chapter' (অধ্যায় vs অধ্যায়) to handle unicode differences
        const metadataRegex = /^(?:\[)?\s*(Subject|Topic|Chapter|Lesson|Board|বিষয়|বিষয়|অধ্যায়|অধ্যায়|পাঠ|বোর্ড)\s*[:ঃ]\s*([^\]\n]*?)(?:\])?$/i;
        const isMetadataLine = metadataRegex.test(line);
        
        if (isSeparator) {
            console.log('  ✂️ Separator detected');
            startNewQuestion();
            continue; 
        }
        
        if (isQuestionHeader) {
            console.log(`  🆕 Question Header detected: ${line}`);
            startNewQuestion();
            continue; // Skip the header line itself
        }
        
        if (isMetadataLine) {
            // Check if we should start a new question
            // If current question has parts or substantial text, this metadata likely starts a new one
            if (currentQuestion.parts.length > 0 || currentQuestion._state.inAnswerSection) {
                console.log(`  🆕 New Metadata detected after content. Starting new question.`);
                startNewQuestion();
            }
            
            // Parse Metadata
            const match = line.match(metadataRegex);
            if (match) {
                const key = match[1].trim().toLowerCase();
                const value = match[2].trim();
                const keyMap = {
                    'subject': 'subject', 'topic': 'subject', 'বিষয়': 'subject', 'বিষয়': 'subject',
                    'chapter': 'chapter', 'অধ্যায়': 'chapter', 'অধ্যায়': 'chapter',
                    'lesson': 'lesson', 'পাঠ': 'lesson',
                    'board': 'board', 'বোর্ড': 'board'
                };
                const mappedKey = keyMap[key];
                if (mappedKey) {
                    currentQuestion[mappedKey] = value;
                    console.log(`    ✅ Metadata ${mappedKey}: ${value}`);
                }
            }
            continue;
        }
        
        // --- 2. Process Line within Current Question ---
        
        const state = currentQuestion._state;
        
        // Handle "বোর্ড: X" format (board metadata without brackets)
        if (/^(board|বোর্ড)\s*[:ঃ]/i.test(line)) {
            const boardMatch = line.match(/^(?:board|বোর্ড)\s*[:ঃ]\s*(.*)$/i);
            if (boardMatch) {
                currentQuestion.board = boardMatch[1].trim();
                console.log(`    ✅ Metadata board:`, currentQuestion.board);
            }
            continue;
        }

        // Handle Bangla stimulus section header (উদ্দীপক:)
        if (/^উদ্দীপক\s*:/i.test(line)) {
            state.inStimulusSection = true;
            state.inQuestionSection = false;
            state.inAnswerSection = false;
            state.stimulusLines = [];
            continue;
        }

        // Handle Bangla question section header (প্রশ্ন:)
        if (/^প্রশ্ন\s*:/i.test(line)) {
            if (state.stimulusLines.length > 0) {
                currentQuestion.questionText = state.stimulusLines.join('\n').replace(/^>\s*/gm, '').trim();
            }
            state.inStimulusSection = false;
            state.inQuestionSection = true;
            state.inAnswerSection = false;
            state.stimulusLines = [];
            state.questionTextLines = [];
            continue;
        }

        // Handle Bangla answer section header (উত্তর:)
        if (/^উত্তর\s*:/i.test(line)) {
            state.inStimulusSection = false;
            state.inQuestionSection = false;
            state.inAnswerSection = true;
            
            // Check for inline content (e.g. "উত্তর: এখানে উত্তর")
            const inlineContent = line.replace(/^উত্তর\s*[:ঃ]\s*/i, '').trim();
            if (inlineContent) {
                // Process as answer line
                line = inlineContent; 
                // Fall through to handle content
            } else {
                continue;
            }
        }

        // Image placeholder detection
        const isImagePlaceholder = 
          (line.startsWith('[') && line.endsWith(']') && (line.toLowerCase().includes('picture') || line.toLowerCase().includes('image') || line.includes('ছবি') || line.includes('চিত্র')))
          ||
          (line.toLowerCase() === 'picture' || line.toLowerCase() === 'image' || line === 'ছবি' || line === 'চিত্র');
        
        if (isImagePlaceholder) {
            currentQuestion.image = '[There is a picture]';
            // Only add to text if we are in stem/question mode
            if (!state.inAnswerSection) {
                state.questionTextLines.push(line);
            }
            continue;
        }

        // Answer section detection
        // Updated: Allow inline content (remove $ anchor)
        if (/^(answer|উত্তর|ans)\s*[:=ঃ]?/i.test(line) && !state.inAnswerSection) {
            state.inAnswerSection = true;
            if (!currentQuestion.questionText && state.questionTextLines.length > 0) {
                currentQuestion.questionText = state.questionTextLines.join('\n').trim();
            }
            console.log(`    ✅ Found Answer section.`);
            
            // Handle inline content
            const inlineContent = line.replace(/^(answer|উত্তর|ans)\s*[:=ঃ]?\s*/i, '').trim();
            if (inlineContent) {
                line = inlineContent;
            } else {
                continue;
            }
        }

        // Handle content based on sections
        if (state.inStimulusSection) {
            if (line.startsWith('>')) {
                state.stimulusLines.push(line.replace(/^>\s*/, '').trim());
            } else if (line) {
                state.stimulusLines.push(line);
            }
            continue;
        }

        if (!state.inAnswerSection) {
            // Parse question parts (a., b., c., d. or ক., খ., গ., ঘ.)
            const partMatch = line.match(/^([a-dক-ঘ])[.)]\s*(.+)$/);
            if (partMatch) {
                let partLetter = partMatch[1].toLowerCase();
                let partText = partMatch[2].trim();
                
                // Convert Bengali letters
                const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                if (bengaliToEnglish[partLetter]) partLetter = bengaliToEnglish[partLetter];
                
                state.hasStartedParts = true;
                
                // Extract marks
                const marksMatch = partText.match(/[(\[]\s*([\d\u09E6-\u09EF]+)\s*[)\]]\s*$/);  
                let marks = 0;
                if (marksMatch) {
                    const bengaliNumerals = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                    let marksStr = marksMatch[1];
                    for (const [bn, en] of Object.entries(bengaliNumerals)) {
                        marksStr = marksStr.replace(new RegExp(bn, 'g'), en);
                    }
                    marks = parseInt(marksStr);
                    partText = partText.replace(marksMatch[0], '').trim();
                } else {
                    const standaloneMatch = partText.match(/\s+([\d\u09E6-\u09EF]+)\s*$/);
                    if (standaloneMatch) {
                        const bengaliNumerals = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                        let marksStr = standaloneMatch[1];
                        for (const [bn, en] of Object.entries(bengaliNumerals)) {
                            marksStr = marksStr.replace(new RegExp(bn, 'g'), en);
                        }
                        marks = parseInt(marksStr);
                        partText = partText.replace(standaloneMatch[0], '').trim();
                    }
                }
                
                currentQuestion.parts.push({
                    letter: partLetter,
                    text: partText,
                    marks: marks,
                    answer: ''
                });
            } else {
                // Not a part line. If it's not a metadata line (checked earlier), add to stem.
                // If parts started, we usually ignore trailing lines unless they look important? 
                // Actually, if parts started, lines without a., b., etc. are usually continuations of previous part OR just noise.
                // But typically stem is before parts.
                
                if (!state.hasStartedParts && !isEmptyLine) {
                    // Only add to stem if parts haven't started
                    state.questionTextLines.push(line);
                } else if (state.hasStartedParts && !isEmptyLine) {
                    // Continuation of previous part question text?
                    // E.g. 
                    // a. What is
                    // this thing?
                    // Usually parser assumes single line parts. Let's try to append if plausible.
                    // For now, let's skip to be safe/simple or append to last part's text.
                    // Let's append to last part text if it exists.
                    const lastPart = currentQuestion.parts[currentQuestion.parts.length - 1];
                    if (lastPart) {
                        lastPart.text += ' ' + line;
                    }
                }
            }
        } else {
            // Answer Section
            if (isEmptyLine) {
                // Empty line in answer section -> preserve as newline in current answer part
                if (state.currentAnswerPart && state.currentAnswerPart.answer) {
                    // Avoid double newlines if already ends with one
                    if (!state.currentAnswerPart.answer.endsWith('\n')) {
                        state.currentAnswerPart.answer += '\n';
                    }
                }
                continue;
            }

            // Bullet points
            if (line.startsWith('·')) {
                state.useBulletPointFormat = true;
                const bulletAnswer = line.substring(1).trim();
                const nextEmptyPart = currentQuestion.parts.find(p => !p.answer || p.answer === '');
                if (nextEmptyPart) {
                    nextEmptyPart.answer = bulletAnswer;
                    state.currentAnswerPart = nextEmptyPart;
                }
            } else if (state.useBulletPointFormat && state.currentAnswerPart && !line.startsWith('·')) {
                if (state.currentAnswerPart.answer) {
                    state.currentAnswerPart.answer += ' ' + line;
                }
            } else {
                // Standard a. b. c. d.
                const answerMatch = line.match(/^([a-dক-ঘ])[.)]\s*(.+)$/);
                if (answerMatch) {
                    let partLetter = answerMatch[1].toLowerCase();
                    const answerText = answerMatch[2].trim();
                    const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                    if (bengaliToEnglish[partLetter]) partLetter = bengaliToEnglish[partLetter];
                    
                    const part = currentQuestion.parts.find(p => p.letter === partLetter);
                    if (part) {
                        part.answer = answerText;
                        state.currentAnswerPart = part;
                    }
                } else {
                    // Continuation line
                    // First try to append to currentAnswerPart
                    if (state.currentAnswerPart) {
                        const endsWithNewline = state.currentAnswerPart.answer.endsWith('\n');
                        if (!state.currentAnswerPart.answer) {
                            state.currentAnswerPart.answer = line;
                        } else if (endsWithNewline) {
                            state.currentAnswerPart.answer += line;
                        } else {
                            state.currentAnswerPart.answer += '\n' + line;
                        }
                    } else if (currentQuestion.parts.length > 0 && !state.useBulletPointFormat) {
                        // If no current answer part, append to the last part (fallback)
                        const lastPart = currentQuestion.parts[currentQuestion.parts.length - 1];
                        if (lastPart) {
                            const endsWithNewline = lastPart.answer && lastPart.answer.endsWith('\n');
                            if (!lastPart.answer) {
                                lastPart.answer = line;
                            } else if (endsWithNewline) {
                                lastPart.answer += line;
                            } else {
                                lastPart.answer += '\n' + line;
                            }
                            state.currentAnswerPart = lastPart;
                        }
                    }
                }
            }
        }
    }
    
    // Save the final question
    // Ensure text is set if not already
    if (currentQuestion) {
        if (!currentQuestion.questionText && currentQuestion._state.questionTextLines.length > 0) {
            currentQuestion.questionText = currentQuestion._state.questionTextLines.join('\n').trim();
        }
        saveCurrentQuestion();
    }
    
    console.log(`\n✅ Total CQ questions parsed: ${questions.length}`);
    return questions;
};