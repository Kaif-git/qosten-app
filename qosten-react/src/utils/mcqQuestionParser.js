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
    if (!q || !q.questionText) return;

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

      // Append Roman statements to question text
      let statementsText = romanOptions.map(opt => `${opt.label}. ${opt.text}`).join('\n');
      q.questionText = q.questionText + '\n' + statementsText;
      
      // Keep only the choice options
      q.options = choiceOptions;

      // Re-run correct answer matching since options have changed
      if (q.correctAnswer) {
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
      id: '',
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      questionText: '',
      options: [],
      correctAnswer: '',
      explanation: '',
      language: 'en'
    };
    
    let inExplanation = false;
    let explanationBuffer = [];
    let questionBuffer = [];
    let inQuestion = false;
    
    const isOptionLine = (line, inQuestion, questionBuffer, currentQuestion, inExplanation) => {
      // Use \s* instead of \s+ after delimiter to support cases without spaces
      const isNumericOption = line.match(/^\s*([1-4]|[১-৪])[).।]\s*/);
      // Updated regex to support Roman numerals i, ii, iii, iv and optional space after delimiter
      const isAlphaOption = line.match(/^\s*([a-dক-ঘi]{1,3})[).।]\s*/) || line.match(/\s+([a-dক-ঘi]{1,3})\)\s*/);
      // Ensure it doesn't match metadata markers (added বিষয় alternate spelling and ID)
      const isMetadataLine = line.match(/^\*{0,2}\[?\s*(Correct|সঠিক|Explanation|ব্যাখ্যা|Bekkha|Subject|বিষয়|বিষয়|Chapter|অধ্যায়|Lesson|পাঠ|Board|বোর্ড|ID)/i);
      
      // Certain alpha options (a, b, c, d) should always be recognized if not in metadata
      const isCertainAlphaOption = line.match(/^\s*([a-dক-ঘ]{1})[).।]\s*/);

      return !isMetadataLine && (isCertainAlphaOption || isAlphaOption || (isNumericOption && !line.startsWith('**'))) && 
             !inExplanation && !line.startsWith('[') && 
             (isCertainAlphaOption || inQuestion || questionBuffer.length > 0 || (currentQuestion.questionText && currentQuestion.options.length > 0));
    };

    const handleNewQuestionStart = () => {
      // SAVE PREVIOUS QUESTION if it exists and has some content
      if (currentQuestion.questionText) {
        console.log('    💾 Saving previous question before starting next block');
        if (inExplanation && explanationBuffer.length > 0) {
          currentQuestion.explanation = explanationBuffer.join('\n').trim();
        }
        finalizeQuestion(currentQuestion);
        
        // Reset but KEEP METADATA (Subject, Chapter, etc.) for the next question
        const prevMetadata = {
          subject: currentQuestion.subject,
          chapter: currentQuestion.chapter,
          lesson: currentQuestion.lesson,
          board: currentQuestion.board,
          language: currentQuestion.language
        };
        
        currentQuestion = {
          type: 'mcq',
          id: '',
          ...prevMetadata,
          questionText: '',
          options: [],
          correctAnswer: '',
          explanation: ''
        };
        inExplanation = false;
        explanationBuffer = [];
        inQuestion = false;
        questionBuffer = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // ID field for unique identification - IGNORE and use as SEPARATOR
      if (line.match(/^\*{0,2}\[\s*ID\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        console.log('  🆔 Found ID line (using as separator):', line);
        handleNewQuestionStart();
        continue;
      }

      // Strip any other embedded [ID: ...] tags
      line = line.replace(/\[ID:\s*[^\]]+\]/gi, '').trim();
      if (!line) continue;
      
      // Skip "Question Set X" header or horizontal rules
      if (line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || line.match(/^[\s-]*---[\s-]*$/)) {
        inExplanation = false; // CRITICAL: Stop explanation mode immediately
        continue;
      }
      
      // Parse metadata fields (handle 0, 1 (*), or 2 (**) asterisks and Bengali field names)
      // Subject/বিষয়
      else if (line.match(/^\*{0,2}\[\s*(Subject|বিষয়|বিষয়)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        console.log('  ✅ Found Subject line:', line.substring(0, 80));
        handleNewQuestionStart();
        
        const match = line.match(/^\*{0,2}\[\s*(Subject|বিষয়|বিষয়)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.subject = match[2].trim();
      }
      // Chapter/অধ্যায়
      else if (line.match(/^\*{0,2}\[\s*(Chapter|অধ্যায়)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        handleNewQuestionStart();
        const match = line.match(/^\*{0,2}\[\s*(Chapter|অধ্যায়)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.chapter = match[2].trim();
        console.log('  ✅ Found Chapter:', match[2].trim());
      }
      // Lesson/পাঠ
      else if (line.match(/^\*{0,2}\[\s*(Lesson|পাঠ)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[\s*(Lesson|পাঠ)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.lesson = match[2].trim();
      } 
      // Board/বোর্ড
      else if (line.match(/^\*{0,2}\[\s*(Board|বোর্ড)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[\s*(Board|বোর্ড)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.board = match[2].trim();
      }
      // Parse options
      else if (isOptionLine(line, inQuestion, questionBuffer, currentQuestion, inExplanation)) {
        console.log('  ✅ Found Option(s) in line:', line.substring(0, 50));
        // Save question text if we were collecting it
        if (inQuestion && questionBuffer.length > 0) {
          currentQuestion.questionText = questionBuffer.join('\n').trim();
          questionBuffer = [];
          inQuestion = false;
        }
        
        // Extract all options from the line
        const optionPattern = /(?:^|\s+)([a-dক-ঘi1-4১-৪]{1,3})[).।]\s*(.+?)(?=\s+([a-dক-ঘi1-4১-৪]{1,3})[).।]\s*|$)/gi;
        let match;
        let foundAny = false;
        while ((match = optionPattern.exec(line)) !== null) {
          foundAny = true;
          let optionLabel = match[1].toLowerCase();
          // Convert labels for consistency
          const labelMap = { 
            'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
            '1': 'a', '2': 'b', '3': 'c', '4': 'd',
            '১': 'a', '২': 'b', '৩': 'c', '৪': 'd'
          };
          if (labelMap[optionLabel]) {
            optionLabel = labelMap[optionLabel];
          }
          currentQuestion.options.push({
            label: optionLabel,
            text: match[2].trim()
          });
        }
        
        if (foundAny) {
           inExplanation = false;
        }
      }
      // Parse question number and text
      else if (line.match(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?[\d০-৯]+[.।:]/i)) {
        handleNewQuestionStart();
        
        inQuestion = true;
        questionBuffer = [];
        // Remove the question number marker
        const questionText = line.replace(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?[\d০-৯]+[.।:]\*{0,2}\s*/i, '').trim();
        console.log('  ✅ Found Question text line:', questionText.substring(0, 60) + '...');
        if (questionText) {
          questionBuffer.push(questionText);
        }
      }
      // Parse correct answer
      else if (line.match(/^\*{0,2}(Correct|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]\s*\*{0,2}\s*(.+?)\s*\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}(Correct|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]\s*\*{0,2}\s*(.+?)\s*\*{0,2}$/i);
        let answerVal = match[2].trim();
        console.log('  ✅ Found Correct answer value:', answerVal);

        const robustNormalize = (str) => (str || '').toString()
          .normalize('NFC')
          .replace(/[\\*\s\u200B\u200C\u200D]+/g, '')
          .toLowerCase();

        const normalizedAnswer = robustNormalize(answerVal);
        const circledLabelMap = { '①': 'a', '②': 'b', '③': 'c', '④': 'd', '❶': 'a', '❷': 'b', '❸': 'c', '❹': 'd' };

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
                currentQuestion.correctAnswer = labelMap[label] || label;
            } else {
                matchingOption = currentQuestion.options.find(opt => {
                    const normalizedOptText = robustNormalize(opt.text);
                    return (normalizedOptText.length > 2 && (normalizedOptText.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedOptText)));
                });
                if (matchingOption) {
                    currentQuestion.correctAnswer = matchingOption.label;
                } else {
                    const firstChar = answerVal[0].toLowerCase();
                    const labelMap = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd', '1': 'a', '2': 'b', '3': 'c', '4': 'd', '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
                    currentQuestion.correctAnswer = labelMap[firstChar] || (['a', 'b', 'c', 'd'].includes(firstChar) ? firstChar : answerVal);
                }
            }
        }
      }
      // Parse explanation
      else if (line.match(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha)[\s:=ঃ：]*\*{0,2}/i) || line.match(/^(Explanation|ব্যাখ্যা|Bekkha)\s*$/i)) {
        console.log('  ✅ Found Explanation line');
        if (inQuestion && questionBuffer.length > 0) {
          currentQuestion.questionText = questionBuffer.join('\n').trim();
          questionBuffer = [];
          inQuestion = false;
        }
        inExplanation = true;
        explanationBuffer = [];
        const explanationText = line.replace(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha)[\s:=ঃ：]*\*{0,2}/i, '').trim();
        if (explanationText) explanationBuffer.push(explanationText);
      }
      // Collect explanation lines
      else if (inExplanation) {
        if (line.match(/^\*{0,2}\[\s*(Subject|বিষয়|বিষয়|Chapter|অধ্যায়|Lesson|পাঠ|Board|বোর্ড|ID)\s*:/i) || 
            line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)/i) || 
            line.match(/^(\*{0,2})\s*((Question|প্রশ্ন)\s*)?[\d০-৯]+[.।:]/i) ||
            line.match(/^[\s-]*---[\s-]*$/)) {
          if (explanationBuffer.length > 0) currentQuestion.explanation = explanationBuffer.join('\n').trim();
          if (currentQuestion.questionText) finalizeQuestion(currentQuestion);
          
          const prevMetadata = { subject: currentQuestion.subject, chapter: currentQuestion.chapter, lesson: currentQuestion.lesson, board: currentQuestion.board, language: currentQuestion.language };
          currentQuestion = { type: 'mcq', ...prevMetadata, questionText: '', options: [], correctAnswer: '', explanation: '' };
          inExplanation = false;
          explanationBuffer = [];
          
          if (line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)/i) || line.match(/^[\s-]*---[\s-]*$/)) continue;
          i--; continue;
        }
        explanationBuffer.push(line);
      }
      // Continue collecting question text if in question mode
      else if (inQuestion && !line.match(/^\s*([a-dক-ঘi1-4১-৪]{1,3})[).।]/)) {
        if (line.match(/^\*{0,2}\[\s*(Subject|বিষয়|বিষয়|Chapter|অধ্যায়|Lesson|পাঠ|Board|বোর্ড|ID)\s*:/i)) {
            if (currentQuestion.questionText) finalizeQuestion(currentQuestion);
            inQuestion = false;
            i--; continue;
        }
        questionBuffer.push(line);
      }
      // Catch-all for unnumbered questions
      else if (!inExplanation && !inQuestion) {
          const isMarker = line.match(/^\*{0,2}(Correct|সঠিক|Explanation|ব্যাখ্যা|Bekkha)/i) || 
                           line.match(/^\*{0,2}\[/) ||
                           line.match(/^[#*\s-/]*(Question\s*Set|প্রশ্ন\s*সেট)/i);
          if (!isMarker) {
              inQuestion = true;
              questionBuffer = [line];
              console.log('  ✨ Starting unnumbered question with line:', line.substring(0, 50));
          }
      }
    }
    
    // Save last question
    if (inExplanation && explanationBuffer.length > 0) {
      currentQuestion.explanation = explanationBuffer.join('\n').trim();
    }
    // Relaxed validation for saving last question: just question text is enough
    if (currentQuestion.questionText) {
      console.log('  💾 Saving last question of set');
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
export function validateMCQQuestion(question) {
  const errors = [];
  
  // Subject and Chapter are no longer strictly required for import to proceed
  
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
