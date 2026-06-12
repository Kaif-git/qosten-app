/**
 * Parser for MCQ questions with LaTeX formatting
 * Supports both English and Bengali (Bangla) formats:
 * 
 * English format:
 * *[Subject: ...]*
 * *[Chapter: ...]*
 * *[Lesson: ...]*
 * *[Board: ...]*
 * *X.* Question text with LaTeX
 * a) Option A
 * b) Option B
 * c) Option C
 * d) Option D
 * *Correct: x*
 * *Explanation:*
 * Explanation text with LaTeX
 * 
 * Bengali format:
 * *[বিষয়: ...]*
 * *[অধ্যায়: ...]*
 * *[পাঠ: ...]*
 * *[বোর্ড: ...]*
 * *X.* Question text
 * ক) Option A
 * খ) Option B
 * গ) Option C
 * ঘ) Option D
 * *সঠিক:* গ
 * *ব্যাখ্যা:*
 * Explanation text
 */

export function parseMCQQuestions(text) {
  if (!text || typeof text !== 'string') {
    console.log('❌ parseMCQQuestions: Invalid input - text is', typeof text);
    return [];
  }

  console.log('🔍 parseMCQQuestions: Starting parse...');
  console.log('📄 Input length:', text.length, 'characters');
  console.log('📄 First 100 chars:', text.substring(0, 100));

  const questions = [];

  const finalizeQuestion = (q) => {
    if (!q) {
      console.log('    ⚠️ Skipping question: No question object');
      return;
    }
    if (!q.questionText && !q.stem) {
      console.log('    ⚠️ Skipping question: Missing questionText. ID:', q.id, 'Number:', q.questionNumber);
      return;
    }

    // Prepend stem if exists
    if (q.stem) {
      q.questionText = q.stem + '\n' + (q.questionText || '');
      q.question = q.questionText;
    }

    // --- HEURISTIC: Cleanup misidentified Roman numeral options ---
    // If the question has standard choice labels (a, b, c, d or ক, খ, গ, ঘ) 
    // AND it also has Roman numeral labels (i, ii, iii, iv), 
    // the Roman numeral labels are likely part of the question statements.
    const hasStandardLabels = q.options.some(opt => ['a', 'b', 'c', 'd', 'ক', 'খ', 'গ', 'ঘ'].includes(opt.label));
    const hasRomanLabels = q.options.some(opt => ['i', 'ii', 'iii', 'iv'].includes(opt.label));

    if (hasStandardLabels && hasRomanLabels) {
      console.log('    🛠 Heuristic: Moving Roman numeral statements back into question text');
      const romanOptions = q.options.filter(opt => ['i', 'ii', 'iii', 'iv'].includes(opt.label));
      const choiceOptions = q.options.filter(opt => !['i', 'ii', 'iii', 'iv'].includes(opt.label));

      // Format Roman statements
      let statementsText = romanOptions.map(opt => `${opt.label}. ${opt.text}`).join('\n');
      
      // Try to insert statements in correct order: 
      // If the question text has multiple lines and the last one looks like a question sentence,
      // insert statements before that last line.
      const qLines = q.questionText.split('\n');
      if (qLines.length > 1 && (qLines[qLines.length-1].includes('?') || qLines[qLines.length-1].includes('কোনটি') || qLines[qLines.length-1].includes('নিচের'))) {
        const lastLine = qLines.pop();
        q.questionText = qLines.join('\n') + '\n' + statementsText + '\n' + lastLine;
      } else {
        q.questionText = q.questionText + '\n' + statementsText;
      }
      
      q.question = q.questionText;
      
      // Keep only the choice options
      q.options = choiceOptions;

      // Re-run correct answer matching since options have changed
      if (q.correctAnswer) {
        const ans = q.correctAnswer.toLowerCase();
        const isAlreadyLabel = ['a', 'b', 'c', 'd', 'ক', 'খ', 'গ', 'ঘ'].includes(ans);
        if (isAlreadyLabel && choiceOptions.some(opt => opt.label === ans)) {
          q.correctAnswer = ans;
          console.log('    🎯 Answer is already a valid label after cleanup. Label:', q.correctAnswer);
        } else {
          const rawAnswer = q.correctAnswer;
          const robustNormalize = (str) => (str || '').toString()
            .normalize('NFC')
            .replace(/[\\*\s\u200B\u200C\u200D]+/g, '')
            .toLowerCase();
          
          const normalizedAnswer = robustNormalize(rawAnswer);
          const matchingOption = q.options.find(opt => {
            const normalizedOptText = robustNormalize(opt.text);
            return normalizedOptText === normalizedAnswer || 
                   (normalizedOptText.length > 2 && (normalizedOptText.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedOptText)));
          });

          if (matchingOption) {
            q.correctAnswer = matchingOption.label;
            console.log('    🎯 Re-matched correct answer after cleanup. Label:', q.correctAnswer);
          }
        }
      }
    }

    questions.push({ ...q });
  };
  
  // Split by horizontal rule or ### to separate question sets
  const questionSets = text.split(/---+|###/).filter(s => s.trim());
  console.log('📦 Question sets after split:', questionSets.length);
  
  for (let setIdx = 0; setIdx < questionSets.length; setIdx++) {
    const set = questionSets[setIdx];
    console.log(`\n📋 Processing question set ${setIdx + 1}/${questionSets.length}`);
    const lines = set.split('\n').map(line => line.trim()).filter(line => line);
    console.log(`  📝 Lines in this set: ${lines.length}`);
    
     let currentQuestion = {
       type: 'mcq',
       questionNumber: '',
       id: '',
       subject: '',
       chapter: '',
       lesson: '',
       board: '',
       stem: '',
       questionText: '',
       question: '',
       options: [],
       correctAnswer: '',
       explanation: '',
       language: 'en'
     };
    
    let inExplanation = false;
    let inStem = false;
    let explanationBuffer = [];
    let stemBuffer = [];
    let questionBuffer = [];
    let inQuestion = false;
    let pendingQuestionPrefix = '';
    
    const isOptionLine = (line, inQuestion, questionBuffer, currentQuestion, inExplanation) => {
      const isNumericOption = line.match(/^\s*([1-4]|[১-৪])[).।]\s*/);
      const isAlphaOption = line.match(/^\s*([a-dক-ঘ]{1})[).।]\s*/) || line.match(/^\s*([a-dক-ঘ]{1})\)\s*/);
      const isRomanOption = line.match(/^\s*(i{1,3}|iv)[).।]\s*/i);
      const isMetadataLine = line.match(/^\*{0,2}\[?\s*(ID|আইডি|Correct|সঠিক|Explanation|ব্যাখ্যা|Bekkha|Subject|বিষয়|বিষয়|Chapter|অধ্যায়|অধ্যায়|Lesson|পাঠ|Board|বোর্ড|Stem|উদ্দীপক)/i);
      return !isMetadataLine && (isAlphaOption || isRomanOption || (isNumericOption && !line.startsWith('**'))) && 
             !inExplanation && !line.startsWith('[') && 
              (inQuestion || questionBuffer.length > 0 || ((currentQuestion.questionText || currentQuestion.stem) && currentQuestion.options.length > 0));
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      console.log(`  📝 Processing line ${i+1}: "${line}"`);
      
      // 1. Detect New Question Start (Question X:, প্রশ্ন X., etc.)
      const headerMatch = line.match(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?([\d০-৯]+)[.।:]/i);
      if (headerMatch) {
        const qNum = headerMatch[4];
        
        // If we are in an explanation, avoid misidentifying numbered lists (e.g., "1. ...") as new questions
        // unless the header explicitly contains "Question" or "প্রশ্ন".
        if (inExplanation && !headerMatch[3]) {
            console.log(`    ℹ️ Skipping potential list item in explanation: "${line}"`);
            explanationBuffer.push(line);
            continue;
        }

        // Require an explicit "Question"/"প্রশ্ন" keyword, or some metadata to be set,
        // before treating a lone number (e.g. "1. ...") as a question header.
        // This prevents numbered translation-instruction lines from becoming junk questions.
        const hasAnyMeta = currentQuestion.subject || currentQuestion.chapter || 
                           currentQuestion.lesson || currentQuestion.board ||
                           currentQuestion.questionNumber;
        if (!headerMatch[3] && !hasAnyMeta) {
            console.log(`    ℹ️ Skipping numbered line without metadata context: "${line}"`);
            // If there's no active question context, keep collecting into pendingQuestionPrefix
            // (it will be discarded when the first real metadata/header is found)
            continue;
        }

        // NEW: If the line has the same question number as the current question AND
        // there's no explicit "Question"/"প্রশ্ন" keyword, treat it as continuation text.
        // This handles cases like "12. In the figure, which of the following is correct?"
        // appearing after the stem but before the options.
        if (!headerMatch[3] && currentQuestion.questionNumber === qNum && (inQuestion || currentQuestion.questionText)) {
            console.log(`    ℹ️ Same-number continuation, not new header: "${line}"`);
            const cleanText = line.replace(/^(\*{0,2})\s*[\d০-৯]+[.।:]\*{0,2}\s*/i, '').trim();
            if (inQuestion) {
                questionBuffer.push(cleanText);
            } else {
                pendingQuestionPrefix = cleanText;
            }
            continue;
        }

        console.log(`    🆕 New Question Header detected: ${qNum}`);

        if (currentQuestion.questionText || (inQuestion && questionBuffer.length > 0)) {
          console.log(`    💾 Saving previous question before starting Q${qNum}`);
          
          if (inQuestion && questionBuffer.length > 0) {
            const qText = questionBuffer.join('\n').trim();
            currentQuestion.questionText = currentQuestion.questionText 
              ? currentQuestion.questionText + '\n' + qText 
              : qText;
            currentQuestion.question = currentQuestion.questionText;
          }

          if (inExplanation && explanationBuffer.length > 0) {
            currentQuestion.explanation = explanationBuffer.join('\n').trim();
          }
          if (inStem && stemBuffer.length > 0) {
            currentQuestion.stem = stemBuffer.join('\n').trim();
          }
          finalizeQuestion(currentQuestion);
          
           const prevMetadata = {
             subject: currentQuestion.subject,
             chapter: currentQuestion.chapter,
             lesson: currentQuestion.lesson,
             board: currentQuestion.board,
             language: currentQuestion.language
           };
           
           currentQuestion = {
             type: 'mcq',
             ...prevMetadata,
             questionNumber: '',
             stem: '',
             questionText: '',
             question: '',
             options: [],
             correctAnswer: '',
             explanation: ''
           };
          inExplanation = false;
          inStem = false;
          explanationBuffer = [];
          stemBuffer = [];
          pendingQuestionPrefix = '';
        }
        
         inQuestion = true;
         questionBuffer = [];
         currentQuestion.questionNumber = qNum;
         const questionText = line.replace(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?[\d০-৯]+[.।:]\*{0,2}\s*/i, '').trim();
         if (pendingQuestionPrefix) {
          if (questionBuffer.length > 0) {
            questionBuffer.unshift(pendingQuestionPrefix);
          } else if (questionText) {
            questionBuffer.push(pendingQuestionPrefix);
          }
          pendingQuestionPrefix = '';
        }
        if (questionText) {
          questionBuffer.push(questionText);
        }
        continue;
      }

      if (line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || line.match(/^[\s-]*---[\s-]*$/)) {
        console.log('    ✂️ Separator detected');
        inExplanation = false;
        pendingQuestionPrefix = '';
        continue;
      }
      
      if (line.match(/^\*{0,2}\[?\s*(ID|আইডি)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i)) {
        // ID is ignored as per user request
        console.log(`    🆔 Found ID (ignoring): ${line}`);
        if (inExplanation && explanationBuffer.length > 0) {
          currentQuestion.explanation = explanationBuffer.join('\n').trim();
        }
        inExplanation = false;
      }
      else if (line.match(/^\*{0,2}\[?\s*(Question|প্রশ্ন)\s+([\d০-৯]+)\s*[:=]?\s*\]?\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[?\s*(Question|প্রশ্ন)\s+([\d০-৯]+)\s*[:=]?\s*\]?\*{0,2}$/i);
        console.log(`    ❓ Found Question metadata: #${match[2]}`);
        if (currentQuestion.questionNumber) {
          // If there's already a question number, save any in-progress question first
          if (currentQuestion.questionText || (inQuestion && questionBuffer.length > 0)) {
            if (inQuestion && questionBuffer.length > 0) {
              const qText = questionBuffer.join('\n').trim();
              currentQuestion.questionText = currentQuestion.questionText 
                ? currentQuestion.questionText + '\n' + qText 
                : qText;
              currentQuestion.question = currentQuestion.questionText;
              questionBuffer = [];
            }
            if (inExplanation && explanationBuffer.length > 0) {
              currentQuestion.explanation = explanationBuffer.join('\n').trim();
            }
            if (inStem && stemBuffer.length > 0) {
              currentQuestion.stem = stemBuffer.join('\n').trim();
            }
            finalizeQuestion(currentQuestion);
            const prevMetadata = {
              subject: currentQuestion.subject,
              chapter: currentQuestion.chapter,
              lesson: currentQuestion.lesson,
              board: currentQuestion.board,
              language: currentQuestion.language
            };
            currentQuestion = {
              type: 'mcq',
              ...prevMetadata,
              questionNumber: '',
              stem: '',
              questionText: '',
              question: '',
              options: [],
              correctAnswer: '',
              explanation: ''
            };
            inQuestion = false;
            questionBuffer = [];
          }
        }
        currentQuestion.questionNumber = match[2];
        inExplanation = false;
        inStem = false;
      }
      else if (line.match(/^\*{0,2}\[?\s*(Type|ধরন|টাইপ)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i)) {
        console.log(`    🏷️ Found Type (ignoring): ${line}`);
        if (inExplanation && explanationBuffer.length > 0) {
          currentQuestion.explanation = explanationBuffer.join('\n').trim();
        }
        inExplanation = false;
      }
      else if (line.match(/^\*{0,2}\[?\s*(Subject|বিষয়|বিষয়)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[?\s*(Subject|বিষয়|বিষয়)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i);
        console.log(`    📚 Found Subject: ${match[2].trim()}`);
        if (currentQuestion.questionText || (inQuestion && questionBuffer.length > 0)) {
          if (inQuestion && questionBuffer.length > 0) {
            const qText = questionBuffer.join('\n').trim();
            currentQuestion.questionText = currentQuestion.questionText 
              ? currentQuestion.questionText + '\n' + qText 
              : qText;
            currentQuestion.question = currentQuestion.questionText;
          }
          if (inExplanation && explanationBuffer.length > 0) {
            currentQuestion.explanation = explanationBuffer.join('\n').trim();
          }
          if (inStem && stemBuffer.length > 0) {
            currentQuestion.stem = stemBuffer.join('\n').trim();
          }
          finalizeQuestion(currentQuestion);
          const prevMetadata = {
            subject: currentQuestion.subject,
            chapter: currentQuestion.chapter,
            lesson: currentQuestion.lesson,
            board: currentQuestion.board,
            language: currentQuestion.language
          };
          currentQuestion = {
            type: 'mcq',
            ...prevMetadata,
            questionText: '',
            question: '',
            options: [],
            correctAnswer: '',
            explanation: ''
          };
          inQuestion = false;
          questionBuffer = [];
        }
        inExplanation = false;
        explanationBuffer = [];
        pendingQuestionPrefix = '';
        currentQuestion.subject = match[2].trim();
      }
      else if (line.match(/^\*{0,2}\[?\s*(Chapter|অধ্যায়|অধ্যায়)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[?\s*(Chapter|অধ্যায়|অধ্যায়)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i);
        currentQuestion.chapter = match[2].trim();
        console.log(`    📖 Found Chapter: ${currentQuestion.chapter}`);
        inExplanation = false;
      }
      else if (line.match(/^\*{0,2}\[?\s*(Lesson|পাঠ)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[?\s*(Lesson|পাঠ)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i);
        currentQuestion.lesson = match[2].trim();
        console.log(`    📝 Found Lesson: ${currentQuestion.lesson}`);
        inExplanation = false;
      } 
      else if (line.match(/^\*{0,2}\[?\s*(Board|বোর্ড)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[?\s*(Board|বোর্ড)\s*[:=]\s*(.+?)\s*\]?\*{0,2}$/i);
        currentQuestion.board = match[2].trim();
        console.log(`    🏛️ Found Board: ${currentQuestion.board}`);
        inExplanation = false;
        inStem = false;
      }
      else if (line.match(/^\*{0,2}\[?\s*(Stem|উদ্দীপক)\s*[:=]\s*(.*?)\s*\]?\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[?\s*(Stem|উদ্দীপক)\s*[:=]\s*(.*?)\s*\]?\*{0,2}$/i);
        console.log('    🔍 Found Stem marker');
        inStem = true;
        inExplanation = false;
        stemBuffer = [];
        if (match[2].trim()) {
          stemBuffer.push(match[2].trim());
        }
      }
      else if (isOptionLine(line, inQuestion, questionBuffer, currentQuestion, inExplanation)) {
        console.log('    🔘 Found Option line');
        
        // Flush any pending context into question text before processing options
        if (pendingQuestionPrefix) {
          currentQuestion.questionText = currentQuestion.questionText 
            ? currentQuestion.questionText + '\n' + pendingQuestionPrefix
            : pendingQuestionPrefix;
          currentQuestion.question = currentQuestion.questionText;
          pendingQuestionPrefix = '';
        }
        
         const isRomanStatement = line.match(/^\s*\(i{1,3}|iv\)[).।]\s*/i) || line.match(/^\s*(i{1,3}|iv)[).।]\s*/i);
         const isStandardChoice = !isRomanStatement && (line.match(/^\s*([a-dক-ঘ]|[1-4]|[১-৪])[).।]\s*/) || line.match(/\s+([a-dক-ঘ]|[1-4]|[১-৪])\)\s*/));

        if (inQuestion && questionBuffer.length > 0) {
          const qText = questionBuffer.join('\n').trim();
          // Append if already has text (e.g. from Roman statement earlier)
          currentQuestion.questionText = currentQuestion.questionText 
            ? currentQuestion.questionText + '\n' + qText 
            : qText;
          currentQuestion.question = currentQuestion.questionText;
          questionBuffer = [];
          
          if (isStandardChoice) {
            inQuestion = false;
            console.log(`    ✅ Question text finalized (Choice found): ${qText.substring(0, 30)}...`);
          } else {
            console.log(`    📝 Question buffer flushed (Statement found): ${qText.substring(0, 30)}...`);
          }
        } else if (inQuestion && isStandardChoice) {
          // Case where an option starts immediately after header without other lines
          inQuestion = false;
        }

        const optionPattern = /(?:^|\s+)([a-dক-ঘi1-4১-৪]{1,3})[).।]\s*(.+)$/;

        // Find $...$ math ranges to exclude false matches inside math content (e.g., "B)" inside $...$)
        const mathRanges = [];
        const mathRe = /\$[^$]*\$/g;
        let mathMatch;
        while ((mathMatch = mathRe.exec(line)) !== null) {
          mathRanges.push({ start: mathMatch.index, end: mathMatch.index + mathMatch[0].length });
        }
        const isInsideMath = (pos) => mathRanges.some(r => pos >= r.start && pos < r.end);

        let foundAny = false;
        const optionMatch = line.match(optionPattern);
        if (optionMatch) {
          let optionLabel = optionMatch[1].toLowerCase();
          const labelMap = { 
            'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
            '1': 'a', '2': 'b', '3': 'c', '4': 'd',
            '১': 'a', '২': 'b', '৩': 'c', '৪': 'd',
            'i': 'i', 'ii': 'ii', 'iii': 'iii', 'iv': 'iv'
          };
          if (labelMap[optionLabel]) optionLabel = labelMap[optionLabel];
          currentQuestion.options.push({ label: optionLabel, text: optionMatch[2].trim() });
          foundAny = true;
        }
        if (foundAny) inExplanation = false;
      }
      else if (line.match(/^\*{0,2}(Correct|সঠিক(?:\s*উত্তর)?|Answer|উত্তর)\s*[:=ঃ：]\s*\*{0,2}\s*(.+?)\s*\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}(Correct|সঠিক(?:\s*উত্তর)?|Answer|উত্তর)\s*[:=ঃ：]\s*\*{0,2}\s*(.+?)\s*\*{0,2}$/i);
        let answerVal = match[2].trim();
        console.log(`    🎯 Found Correct answer: ${answerVal}`);
        
        const robustNormalize = (str) => (str || '').toString().normalize('NFC').replace(/[\\*\s\u200B\u200C\u200D]+/g, '').toLowerCase();
        const normalizedAnswer = robustNormalize(answerVal);
        const circledLabelMap = { '①': 'a', '②': 'b', '③': 'c', '④': 'd', '⑤': 'e', '❶': 'a', '❷': 'b', '❸': 'c', '❹': 'd', '❺': 'e' };

        if (answerVal.length === 1 && circledLabelMap[answerVal]) {
          currentQuestion.correctAnswer = circledLabelMap[answerVal];
        } else {
          let matchingOption = currentQuestion.options.find(opt => robustNormalize(opt.text) === normalizedAnswer);
          if (matchingOption) {
            currentQuestion.correctAnswer = matchingOption.label;
          } else if (answerVal.match(/^([a-dক-ঘ]|[1-4]|[১-৪])(?:\s*[).।]\s*|$)/i) && answerVal.length <= 4) {
            const labelMatch = answerVal.match(/^([a-dক-ঘ]|[1-4]|[১-৪])(?:\s*[).।]\s*|$)/i);
            let label = labelMatch[1].toLowerCase();
            const labelMap = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd', '1': 'a', '2': 'b', '3': 'c', '4': 'd', '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
            if (labelMap[label]) label = labelMap[label];
            currentQuestion.correctAnswer = label;
          } else {
            matchingOption = currentQuestion.options.find(opt => {
              const normOpt = robustNormalize(opt.text);
              return (normOpt.length > 2 && (normOpt.includes(normalizedAnswer) || normalizedAnswer.includes(normOpt)));
            });
            if (matchingOption) {
              currentQuestion.correctAnswer = matchingOption.label;
            } else {
              const firstChar = answerVal[0].toLowerCase();
              const labelMap = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd', '1': 'a', '2': 'b', '3': 'c', '4': 'd', '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
              currentQuestion.correctAnswer = (['a', 'b', 'c', 'd'].includes(firstChar)) ? firstChar : (labelMap[firstChar] || answerVal);
            }
          }
        }
        console.log(`    ✅ Final matched label: ${currentQuestion.correctAnswer}`);
      }

      // Parse explanation (handle 0, 1, or 2 asterisks and Bengali ব্যাখ্যা, plus transliteration "Bekkha")
      else if (
        line.match(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha)[\s:=ঃ：]*\*{0,2}/i) ||
        line.match(/^(Explanation|ব্যাখ্যা|Bekkha)\s*$/i)
      ) {
        console.log('  ✅ Found Explanation line');
        // Save question text if we were collecting it
        if (inQuestion && questionBuffer.length > 0) {
          const qText = questionBuffer.join('\n').trim();
          currentQuestion.questionText = qText;
          currentQuestion.question = qText;
          questionBuffer = [];
          inQuestion = false;
        }
        // Save stem if we were collecting it (inStem can remain true if stem-ending
        // lines like the question continuation or options were handled by earlier branches)
        if (inStem && stemBuffer.length > 0) {
          currentQuestion.stem = stemBuffer.join('\n').trim();
          inStem = false;
          stemBuffer = [];
        }
        inExplanation = true;
        explanationBuffer = [];
        // Check if explanation starts on same line (stripping marker and bolding)
        const explanationText = line
          .replace(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha)[\s:=ঃ：]*\*{0,2}/i, '')
          .trim();
        if (explanationText) {
          console.log(`    📝 Captured inline explanation: "${explanationText.substring(0, 30)}..."`);
          explanationBuffer.push(explanationText);
        }
      }
      // Collect stem lines
      else if (inStem) {
        // Stop at next question start, metadata or options
        if (line.match(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?[\d০-৯]+[.।:]/i) || 
            line.match(/^\*{0,2}\[?\s*(ID|আইডি|Subject|বিষয়|বিষয়|Chapter|অধ্যায়|অধ্যায়|Lesson|পাঠ|Board|বোর্ড|Stem|উদ্দীপক|Correct|সঠিক|Explanation|ব্যাখ্যা)/i) ||
            line.match(/^\s*([a-dক-ঘi1-4১-৪]{1,3})[).।]/)) {
          currentQuestion.stem = stemBuffer.join('\n').trim();
          inStem = false;
          // If stopped at an option-like line, enter question mode so options are parsed
          if (line.match(/^\s*([a-dক-ঘi1-4১-৪]{1,3})[).।]/)) {
            inQuestion = true;
            questionBuffer = [];
          }
          i--; // Reprocess
          continue;
        }
        stemBuffer.push(line);
      }
      // Collect explanation lines
      else if (inExplanation) {
        // Stop at next question set marker, metadata or new question marker
        if (line.match(/^\*{0,2}\[?\s*(ID|আইডি|Subject|বিষয়|বিষয়)\s*:/i) || 
            line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || 
            line.match(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?[\d০-৯]+[.।:]/i) ||
            line.match(/^[\s-]*---[\s-]*$/)) {
          // This is the start of next question, process current one
           if (explanationBuffer.length > 0) {
             currentQuestion.explanation = explanationBuffer.join('\n').trim();
           }
           
           // Reset for next question
          const prevMetadata = {
            subject: currentQuestion.subject,
            chapter: currentQuestion.chapter,
            lesson: currentQuestion.lesson,
            board: currentQuestion.board,
            language: currentQuestion.language
          };
          currentQuestion = {
            type: 'mcq',
            ...prevMetadata,
            stem: '',
            questionText: '',
            question: '',
            options: [],
            correctAnswer: '',
            explanation: ''
          };
          inExplanation = false;
          inStem = false;
          explanationBuffer = [];
          stemBuffer = [];
          
          // If it was just a "Question Set" marker or horizontal rule, we don't want to re-process it as metadata
          if (line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || line.match(/^[\s-]*---[\s-]*$/)) {
             continue;
          }

          // Process this line as metadata or question start
          i--;
          continue;
        }
        
        // Extra safety: Don't collect other metadata lines as explanation text
        if (line.match(/^\*{0,2}\[?\s*(Chapter|অধ্যায়|অধ্যায়|Lesson|পাঠ|Board|বোর্ড)\s*:/i)) {
            continue;
        }
        
        explanationBuffer.push(line);
      }
      // Continue collecting question text if in question mode
      // Stop if an option label is found at the beginning of the line
      // Improved regex to match what isOptionLine matches
      else if (inQuestion && !line.match(/^\s*([a-dক-ঘi1-4১-৪]{1,3})[).।]/)) {
        // Also stop if new metadata block is found (case where options are missing)
        if (line.match(/^\*{0,2}\[?\s*(ID|আইডি|Subject|বিষয়|বিষয়|Chapter|অধ্যায়|অধ্যায়|Lesson|পাঠ|Board|বোর্ড|Stem|উদ্দীপক)\s*[:=]/i)) {
            // New question starting, save current one
            if (currentQuestion.questionText || questionBuffer.length > 0) {
                if (questionBuffer.length > 0) {
                  const qText = questionBuffer.join('\n').trim();
                  currentQuestion.questionText = currentQuestion.questionText 
                    ? currentQuestion.questionText + '\n' + qText 
                    : qText;
                  currentQuestion.question = currentQuestion.questionText;
                }
                finalizeQuestion(currentQuestion);
            }
            // Logic to handle metadata will be in the metadata block
            // For now just stop question mode
            inQuestion = false;
            questionBuffer = [];
            i--; // Reprocess line
            continue;
        }
        questionBuffer.push(line);
      } else if (!inQuestion && !inStem && !inExplanation && line.trim() && currentQuestion.subject &&
                 !line.match(/^\s*([a-dক-ঘi1-4১-৪]{1,3})[).।]/)) {
        pendingQuestionPrefix = (pendingQuestionPrefix ? pendingQuestionPrefix + '\n' : '') + line.trim();
      }
    }
    
    // Save last question
    if (inQuestion && questionBuffer.length > 0) {
      const qText = questionBuffer.join('\n').trim();
      currentQuestion.questionText = currentQuestion.questionText 
        ? currentQuestion.questionText + '\n' + qText 
        : qText;
      currentQuestion.question = currentQuestion.questionText;
      questionBuffer = [];
    }
    if (inExplanation && explanationBuffer.length > 0) {
      currentQuestion.explanation = explanationBuffer.join('\n').trim();
    }
    if (inStem && stemBuffer.length > 0) {
      currentQuestion.stem = stemBuffer.join('\n').trim();
    }
    if (pendingQuestionPrefix) {
      currentQuestion.questionText = pendingQuestionPrefix;
      currentQuestion.question = pendingQuestionPrefix;
      pendingQuestionPrefix = '';
    }
    // Relaxed validation for saving last question: question text or stem is enough
    if (currentQuestion.questionText || currentQuestion.stem) {
      console.log('  💾 Saving last question of set');
      const qText = currentQuestion.questionText || '';
      currentQuestion.question = qText; // Ensure both are set
      finalizeQuestion(currentQuestion);
    } else {
      console.log('  ⚠️ Last question incomplete:', {
        hasQuestion: !!currentQuestion.questionText,
        optionCount: currentQuestion.options.length
      });
    }

  }
  
  console.log(`\n✅ Total questions parsed: ${questions.length}`);
  return questions;
}

/**
 * Validate an MCQ question object
 */
export function validateMCQQuestion(question, opts = {}) {
  const { requireSubject = false, requireChapter = false } = opts;
  const errors = [];
  
  if (requireSubject && !question.subject) {
    errors.push('Subject is required');
  }
  
  if (requireChapter && !question.chapter) {
    errors.push('Chapter is required');
  }
  
  if (!question.questionText) {
    errors.push('Question text is required');
  }
  
  if (!question.options || question.options.length < 2) {
    errors.push('At least 2 options are required');
  }
  
  if (!question.correctAnswer) {
    errors.push('Correct answer is required');
  } else if (question.options && !question.options.some(opt => opt.label === question.correctAnswer)) {
    errors.push('Correct answer must match one of the option labels');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Detect quality issues in a parsed question without blocking import.
 * Returns an array of issue descriptions (empty = clean question).
 */
export function getQuestionIssues(question) {
  const issues = [];
  if (!question) return ['Question object is null'];

  if (!question.questionText || question.questionText.trim().length < 5) {
    issues.push('Question text is empty or too short');
  }

  if (!question.options || question.options.length === 0) {
    issues.push('No options found');
  } else if (question.options.length < 2) {
    issues.push(`Only ${question.options.length} option(s), expected 4`);
  } else if (question.options.length !== 4) {
    issues.push(`Has ${question.options.length} options instead of 4`);
  }

  if (!question.correctAnswer) {
    issues.push('Correct answer is missing');
  } else if (question.options && !question.options.some(opt => opt.label === question.correctAnswer)) {
    issues.push(`Correct answer "${question.correctAnswer}" does not match any option label`);
  }

  // Check for options that look like LaTeX fragments (e.g., "= 1$" or unclosed math)
  if (question.options) {
    question.options.forEach((opt, i) => {
      const t = (opt.text || '').trim();
      if (!t) {
        issues.push(`Option ${opt.label} is empty`);
      } else if (t.startsWith('=') || /^[\s,;.?!]*$/.test(t)) {
        issues.push(`Option ${opt.label} looks like a LaTeX fragment: "${t.substring(0, 20)}"`);
      } else if (t.startsWith('\\') && !t.startsWith('\\(') && !t.startsWith('\\[')) {
        // Starts with a backslash command but not wrapped in math mode - likely a fragment
        issues.push(`Option ${opt.label} looks like a raw LaTeX command: "${t.substring(0, 20)}"`);
      } else if ((t.startsWith('$') || t.startsWith('\\(')) && !(t.endsWith('$') || t.endsWith('\\)'))) {
        // Math mode opened but not closed - likely truncated
        issues.push(`Option ${opt.label} has unclosed math: "${t.substring(0, 20)}"`);
      }
    });
  }

  // Check for duplicate option labels
  const labels = question.options.map(o => o.label);
  const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
  if (dupes.length > 0) {
    issues.push(`Duplicate option labels: ${[...new Set(dupes)].join(', ')}`);
  }

  return issues;
}

/**
 * Filter out dead/bad questions from an array, returning clean and removed lists.
 */
export function filterDeadQuestions(questions) {
  const clean = [];
  const removed = [];
  questions.forEach((q, i) => {
    const issues = getQuestionIssues(q);
    if (issues.length > 0) {
      removed.push({ index: i, label: `Q${q.questionNumber || i + 1}`, issues, question: q });
    } else {
      clean.push(q);
    }
  });
  return { clean, removed };
}

/**
 * Validate an array of MCQ question objects.
 * Returns { valid: [], invalid: [{question, errors}] }
 * @param {Array} questions - Array of parsed MCQ question objects
 * @param {Object} [opts] - Options
 * @param {boolean} [opts.requireSubject=true] - Whether to require subject field
 * @param {boolean} [opts.requireChapter=true] - Whether to require chapter field
 */
export function validateMCQQuestions(questions, opts = {}) {
  const { requireSubject = true, requireChapter = true } = opts;
  const valid = [];
  const invalid = [];

  questions.forEach((q, i) => {
    const errors = [];
    const label = `Q${q.questionNumber || i + 1}`;

    if (!q.questionText) {
      errors.push('Question text is empty');
    }
    if (!q.options || q.options.length < 2) {
      errors.push(`Has ${q.options?.length || 0} option(s), need at least 2`);
    }
    if (!q.correctAnswer) {
      errors.push('Correct answer is missing');
    }
    if (requireSubject && !q.subject) {
      errors.push('Subject is missing');
    }
    if (requireChapter && !q.chapter) {
      errors.push('Chapter is missing');
    }

    if (errors.length === 0) {
      valid.push(q);
    } else {
      invalid.push({ index: i, label, question: q, errors });
    }
  });

  return { valid, invalid };
}

/**
 * Format example text for the MCQ import interface
 */
export function getMCQQuestionExample() {
  return `**[Subject: Math]**  
**[Chapter: Algebraic Expressions]**  
**[Lesson: Algebraic Identities]**  
**[Board: D.B.-23]**  
**13.** If \\( x + y = \\sqrt{7} \\) and \\( x - y = \\sqrt{6} \\), then what is the value of \\( x^2 + y^2 \\)?  
a) \\( \\frac{1}{2} \\)  
b) \\( \\frac{13}{2} \\)  
c) \\( \\frac{15}{2} \\)  
d) \\( \\frac{17}{2} \\)  
**Correct: \\frac{13}{2}**  
**Explanation:**  
\\[
x^2 + y^2 = \\frac{(x+y)^2 + (x-y)^2}{2} = \\frac{7 + 6}{2} = \\frac{13}{2}
\\]

---

### **Stem Format Example**
[Subject: Bengali First Paper]
[Chapter: Prose]
[Lesson: Am-Antir Bhepu]
[Board: N/A]
**Stem: রিপন ও রুমা দুই ভাই-বোন। তাদের বয়সের পার্থক্য চার বছর। একে অন্যের উপর নির্ভরশীল হলেও বিভিন্ন জিনিস একে অন্যকে তারা দেখাতে চায় না। রুমার খেলার সামগ্রী রিপন লুকিয়ে রাখে। রুমার বিভিন্ন আদেশ, আবদার রিপন মানতে চায় না। এই নিয়ে ওদের মাকে নানা বিড়ম্বনার মধ্যে পড়তে হয়।**
3. উদ্দীপকটি 'আম-আঁটির ভেঁপু' গল্পের কোন দিককে প্রতিফলিত করেছে
a) ভাই-বোনের সম্পর্ক
b) ভাই-বোনের বিরোধ
c) ভাই-বোনের আবদার
d) মায়ের চিন্তা
Correct: a

---

### **Bracketed Metadata Format (No Asterisks)**
[Subject: Chemistry]
[Chapter: Concept of Mole and Chemical Counting]
[Lesson: Mole and Avogadro's Number]
[Board: SCHOLAISHOME, Sylhet]
15.What is the number of molecule found in 1 g CaCO_3?
a) 6.02 \\times 10^{21}
b) 6.02 \\times 10^{22}
c) 6.02 \\times 10^{23}
d) 6.02 \\times 10^{24}
**Correct: 6.02 \\times 10^{23}**
Explanation: Molar mass of calcium carbonate is 100 g/mol which means 100 g calcium carbonate has 6.02 \\times 10^{23} molecules.

---

### **Bengali Format Example**

*[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]*  
*[অধ্যায়: বাংলাদেশের স্বাধীনতা]*  
*[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি]*  
*[বোর্ড: ডি.বি.-২৪]*  
*৩.* "অপারেশন সার্চলাইট"-এর মূল পরিকল্পনাকারী কে ছিলেন?  
ক) ইয়াহিয়া খান  
খ) আইয়ুব খান  
গ) রাও ফরমান আলী  
ঘ) জুলফিকার আলী ভুট্টো  
**সঠিক: রাও ফরমান আলী**  
*ব্যাখ্যা:* মেজর জেনারেল রাও ফরমান আলী পাকিস্তান সেনাবাহিনীর একজন উচ্চপদস্থ কর্মকর্তা ছিলেন।`;
}
