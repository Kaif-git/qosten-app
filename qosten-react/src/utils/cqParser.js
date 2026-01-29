const BENGALI_TO_ENGLISH = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };

const assignPartAnswer = (letter, content, currentQuestion, state) => {
    const enLetter = BENGALI_TO_ENGLISH[letter] || letter.toLowerCase();
    const targetPart = currentQuestion.parts.find(p => p.letter === enLetter);
    if (targetPart) {
        targetPart.answer = content.trim();
        state.currentAnswerPart = targetPart;
    }
};

const splitAndAssignParts = (text, startLetter, currentQuestion, state) => {
    const multiPartRegex = /\s+([a-dক-ঘ])[.:)।]\s+/gi;
    let lastIndex = 0;
    let currentLetter = startLetter;
    let match;
    
    while ((match = multiPartRegex.exec(text)) !== null) {
        const content = text.substring(lastIndex, match.index);
        assignPartAnswer(currentLetter, content, currentQuestion, state);
        currentLetter = match[1];
        lastIndex = multiPartRegex.lastIndex;
    }
    // Assign the remainder
    assignPartAnswer(currentLetter, text.substring(lastIndex), currentQuestion, state);
};

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
    let pendingStem = ''; // Persist stem across questions
    
    // Helper to save the current question and reset
    const saveCurrentQuestion = () => {
        if (currentQuestion) {
            // Finalize stimulus lines if any
            if (currentQuestion._state.stimulusLines.length > 0) {
                const stimText = currentQuestion._state.stimulusLines.join('\n').replace(/^>\s*/gm, '').trim();
                if (stimText) {
                    if (currentQuestion.questionText) {
                        // Avoid adding the same text again if it's already there
                        if (!currentQuestion.questionText.includes(stimText)) {
                            currentQuestion.questionText += '\n' + stimText;
                        }
                    } else {
                        currentQuestion.questionText = stimText;
                    }
                }
                currentQuestion._state.stimulusLines = [];
            }

            // Finalize question text from lines if not set
            if (currentQuestion._state.questionTextLines.length > 0) {
                const newText = currentQuestion._state.questionTextLines.join('\n').trim();
                if (newText) {
                    if (currentQuestion.questionText) {
                        if (!currentQuestion.questionText.includes(newText)) {
                            currentQuestion.questionText += '\n' + newText;
                        }
                    } else {
                        currentQuestion.questionText = newText;
                    }
                }
                currentQuestion._state.questionTextLines = [];
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
                    // RESET pendingStem when we successfully save a full question with parts
                    pendingStem = '';
                } else if (currentQuestion.questionText) {
                    // It was just a stem/text block, update pendingStem
                    pendingStem = currentQuestion.questionText;
                    console.log('  📌 Pending stem updated:', pendingStem.substring(0, 50) + '...');
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
            id: '',
            language: lang,
            questionText: pendingStem, // Inherit stem
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
        // Also support board info in the header line: Question: (বোর্ড)
        const isQuestionHeader = /^(Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)[:ঃ]?\s*([\d\u09E6-\u09EF\u0982]+|[\s(]*[\d\u09E6-\u09EF\u0982]+|[\s(]+(?:বোর্ড|Board))/i.test(line) && line.length < 60;
        
        // Separator: "---"
        const isSeparator = /^---+$/.test(line);
        
        // Metadata Block Start: [Subject: ...]
        // Updated: Allow optional spaces around brackets and keys (e.g. [ Subject: ... ])
        // Added alternative spelling for 'Chapter' (অধ্যায় vs অধ্যায়) to handle unicode differences
        const metadataRegex = /^(?:\[)?\s*(ID|Subject|Topic|Chapter|Lesson|Board|বিষয়|বিষয়|অধ্যায়|অধ্যায়|পাঠ|বোর্ড)\s*[:ঃ]\s*([^\]\n]*?)(?:\])?$/i;
        const isMetadataLine = metadataRegex.test(line);
        
        if (isSeparator) {
            console.log('  ✂️ Separator detected');
            startNewQuestion();
            continue; 
        }
        
        if (isQuestionHeader) {
            console.log(`  🆕 Question Header detected: ${line}`);
            // Try to extract board from header if present like "Question: (Dhaka Board-2024)"
            const boardMatch = line.match(/\(([^)]*(?:বোর্ড|Board)[^)]*)\)/i);
            const extractedBoard = boardMatch ? boardMatch[1].trim() : '';
            
            startNewQuestion();
            if (extractedBoard) {
                currentQuestion.board = extractedBoard;
                console.log(`    ✅ Extracted board from header: ${extractedBoard}`);
            }
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
                    'id': 'id',
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

        // Handle Stimulus section header (Stem: or উদ্দীপক:)
        // Matches "Stem:", "Stem (English):", "স্টেম:", "স্টেম (ইংরেজি):", "উদ্দীপক:", etc.
        const stemHeaderRegex = /^(Stem(\s*\(.*?\))?|স্টেম(\s*\(.*?\))?|উদ্দীপক)\s*[:ঃ]/i;
        if (stemHeaderRegex.test(line)) {
            // If current question has parts or substantial text, this starts a new one
            if (currentQuestion.parts.length > 0 || currentQuestion._state.inAnswerSection) {
                startNewQuestion();
            }
            state.inStimulusSection = true;
            state.inQuestionSection = false;
            state.inAnswerSection = false;
            state.stimulusLines = [];
            
            // Check for inline content (e.g. "Stem: here is content")
            const inlineContent = line.replace(stemHeaderRegex, '').trim();
            if (inlineContent) {
                state.stimulusLines.push(inlineContent);
            }
            continue;
        }

        // Handle "অধ্যায় ৯ ও ১০ সংযুক্ত" lines - treat as metadata or just skip
        if (/অধ্যায়\s*[\d\u09E6-\u09EF\sও,]+সংযুক্ত/i.test(line)) {
            console.log(`    ✅ Skipping connected chapters line: ${line}`);
            // Optionally save to chapter if not already set
            if (!currentQuestion.chapter) {
                currentQuestion.chapter = line.trim();
            }
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

        // Handle Bangla answer section header (উত্তর: or সমাধান:)
        if (/^(উত্তর|সমাধান)\s*:/i.test(line)) {
            state.inStimulusSection = false;
            state.inQuestionSection = false;
            state.inAnswerSection = true;
            
            // Check for inline content (e.g. "উত্তর: এখানে উত্তর")
            const inlineContent = line.replace(/^(উত্তর|সমাধান)\s*[:ঃ]\s*/i, '').trim();
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
        if (/^(answer|উত্তর|সমাধান|ans)\s*[:=ঃ]?/i.test(line) && !state.inAnswerSection) {
            state.inAnswerSection = true;
            state.currentAnswerPart = null; // Reset current answer part on new Answer: header
            if (!currentQuestion.questionText && state.questionTextLines.length > 0) {
                currentQuestion.questionText = state.questionTextLines.join('\n').trim();
            }
            console.log(`    ✅ Found Answer section.`);
            
            // Handle inline content
            const inlineContent = line.replace(/^(answer|উত্তর|সমাধান|ans)\s*[:=ঃ]?\s*/i, '').trim();
            if (inlineContent) {
                // If it's "Answer: a. something", we want to process "a. something" as a part answer
                if (inlineContent.match(/^(?:Part\s+)?([a-dক-ঘ])[.:)]/i)) {
                    line = inlineContent; 
                    // Fall through to handle content in the answer section loop below
                } else {
                    // It's just generic answer text, assign to last part if we have one
                    const lastPart = currentQuestion.parts[currentQuestion.parts.length - 1];
                    if (lastPart) {
                        lastPart.answer = inlineContent;
                        state.currentAnswerPart = lastPart;
                    }
                    continue;
                }
            } else {
                continue;
            }
        }

        // Handle content based on sections
        if (state.inStimulusSection) {
            // Optimization: Check if this line looks like a part (a., b., c., d.)
            // If it does, we should exit stimulus mode and let it be parsed as a part
            const isPartLine = /^(?:Part\s+)?([a-dক-ঘ])[:.)]\s*(.+)/i.test(line);
            
            if (isPartLine) {
                state.inStimulusSection = false;
                // Don't continue, let it fall through to the part parsing logic below
            } else {
                if (line.startsWith('>')) {
                    state.stimulusLines.push(line.replace(/^>\s*/, '').trim());
                } else if (line) {
                    state.stimulusLines.push(line);
                }
                continue;
            }
        }

        if (!state.inAnswerSection) {
            // Parse question parts (a., b., c., d. or ক., খ., গ., ঘ.)
            // Support "a.", "Part a:", "Part a.", "ক।"
            const partMatch = line.match(/^(?:Part\s+)?([a-dক-ঘ])[:.)।]\s*(.+)/i);
            if (partMatch) {
                let partLetter = partMatch[1].toLowerCase();
                let partText = partMatch[2].trim();
                
                // Convert Bengali letters
                const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                if (bengaliToEnglish[partLetter]) partLetter = bengaliToEnglish[partLetter];
                
                state.hasStartedParts = true;
                
                // Extract marks
                const marksMatch = partText.match(/[([ ]\s*([\d\u09E6-\u09EF]+)\s*[)\]]\s*$/);  
                let marks = 0;
                if (marksMatch) {
                    const bengaliNumerals = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                    let marksStr = marksMatch[1];
                    for (const [bn, en] of Object.entries(bengaliNumerals)) {
                        marksStr = marksStr.replace(new RegExp(bn, 'g'), en);
                    }
                    marks = parseInt(marksStr);
                    // Use slice to remove from end instead of replace which might hit earlier matches
                    partText = partText.slice(0, -marksMatch[0].length).trim();
                } else {
                    const standaloneMatch = partText.match(/\s+([\d\u09E6-\u09EF]+)\s*$/);
                    if (standaloneMatch) {
                        const bengaliNumerals = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                        let marksStr = standaloneMatch[1];
                        for (const [bn, en] of Object.entries(bengaliNumerals)) {
                            marksStr = marksStr.replace(new RegExp(bn, 'g'), en);
                        }
                        marks = parseInt(marksStr);
                        // Use slice to remove from end instead of replace which might hit earlier matches
                        partText = partText.slice(0, -standaloneMatch[0].length).trim();
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
                // Support "a.", "Part a:", "Part a.", "ক।"
                const partRegex = /^(?:Part\s+)?([a-dক-ঘ])[:.)।]\s*(.*)/i;
                const partMatch = line.match(partRegex);
                
                if (partMatch) {
                    let partLetter = partMatch[1].toLowerCase();
                    const partContent = partMatch[2].trim();
                    
                    // Convert Bengali letters consistently
                    if (BENGALI_TO_ENGLISH[partLetter]) partLetter = BENGALI_TO_ENGLISH[partLetter];

                    // Check if this line contains more parts
                    if (/\s+([a-dক-ঘ])[.:)।]\s+/i.test(partContent)) {
                        splitAndAssignParts(partContent, partLetter, currentQuestion, state);
                    } else {
                        const part = currentQuestion.parts.find(p => p.letter === partLetter);
                        if (part) {
                            part.answer = partContent;
                            state.currentAnswerPart = part;
                        } else {
                            // It's a new part! Exit answer section.
                            state.inAnswerSection = false;
                            state.currentAnswerPart = null;
                            
                            // Process as a new part
                            state.hasStartedParts = true;
                            currentQuestion.parts.push({
                                letter: partLetter,
                                text: partContent,
                                marks: 0,
                                answer: ''
                            });
                        }
                    }
                } else {
                    if (state.currentAnswerPart) {
                        // Continuation line
                        if (!state.currentAnswerPart.answer) {
                            state.currentAnswerPart.answer = line;
                        } else {
                            // If the line already ends with a newline (from isEmptyLine logic), don't add another
                            const separator = state.currentAnswerPart.answer.endsWith('\n') ? '' : '\n';
                            state.currentAnswerPart.answer += separator + line;
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