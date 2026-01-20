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
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip "Question Set X" header or horizontal rules
      if (line.match(/^[#*\s\-\/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || line.match(/^[\s\-]*---[\s\-]*$/)) {
        inExplanation = false; // CRITICAL: Stop explanation mode immediately
        continue;
      }
      
      // Parse metadata fields (handle 0, 1 (*), or 2 (**) asterisks and Bengali field names)
      // ID field for unique identification
      if (line.match(/^\*{0,2}\[\s*ID\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[\s*ID\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.id = match[1].trim();
      }
      // Subject/বিষয় - If we encounter a new subject, save the current question first
      else if (line.match(/^\*{0,2}\[\s*(Subject|বিষয়)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        console.log('  ✅ Found Subject line:', line.substring(0, 80));
        // Save previous question if it exists and is valid
        if (currentQuestion.questionText && currentQuestion.options.length > 0) {
          console.log('    💾 Saving previous question before starting new metadata');
          if (inExplanation && explanationBuffer.length > 0) {
            currentQuestion.explanation = explanationBuffer.join('\n').trim();
          }
          finalizeQuestion(currentQuestion);
          
          // Reset for new question but keep previous metadata as fallback unless overwritten
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
            options: [],
            correctAnswer: '',
            explanation: ''
          };
        }
        
        inExplanation = false;
        inQuestion = false;
        explanationBuffer = [];
        questionBuffer = [];
        
        const match = line.match(/^\*{0,2}\[\s*(Subject|বিষয়)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.subject = match[2].trim();
      }
      // Chapter/অধ্যায়
      else if (line.match(/^\*{0,2}\[\s*(Chapter|অধ্যায়)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        inExplanation = false;
        const match = line.match(/^\*{0,2}\[\s*(Chapter|অধ্যায়)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.chapter = match[2].trim();
        console.log('  ✅ Found Chapter:', match[2].trim());
      }
      // Lesson/পাঠ
      else if (line.match(/^\*{0,2}\[\s*(Lesson|পাঠ)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        inExplanation = false;
        const match = line.match(/^\*{0,2}\[\s*(Lesson|পাঠ)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.lesson = match[2].trim();
      } 
      // Board/বোর্ড
      else if (line.match(/^\*{0,2}\[\s*(Board|বোর্ড)\s*:\s*(.+?)\s*\]\*{0,2}$/i)) {
        inExplanation = false;
        const match = line.match(/^\*{0,2}\[\s*(Board|বোর্ড)\s*:\s*(.+?)\s*\]\*{0,2}$/i);
        currentQuestion.board = match[2].trim();
      }
      // Parse options (a), b), c), d) or 1., 2., 3., 4. or Bengali equivalents or Roman numerals i., ii., iii., iv.)
      // Handle both start-of-line and inline options
      // Robust check: Label must be at start of line or preceded by space.
      // We prioritize options over question numbers if they look like 1-4 and we are in a question.
      // In this format, question numbers are usually bolded **1.** while options 1. are not.
      else if ((() => {
        const isNumericOption = line.match(/^\s*([1-4]|[১-৪])[\)\.।]\s+/);
        // Updated regex to support Roman numerals i, ii, iii, iv
        const isAlphaOption = line.match(/^\s*([a-dক-ঘi]{1,3})[\)\.।]\s+/) || line.match(/\s+([a-dক-ঘi]{1,3})\)\s+/);
        // Ensure it doesn't match metadata markers
        const isMetadataLine = line.match(/^\*{0,2}\[?\s*(Correct|সঠিক|Explanation|ব্যাখ্যা|Bekkha|Subject|বিষয়|Chapter|অধ্যায়|Lesson|পাঠ|Board|বোর্ড)/i);
        
        return !isMetadataLine && (isAlphaOption || (isNumericOption && !line.startsWith('**'))) && 
               !inExplanation && !line.startsWith('[') && 
               (inQuestion || questionBuffer.length > 0 || (currentQuestion.questionText && currentQuestion.options.length > 0));
      })()) {
        console.log('  ✅ Found Option(s) in line:', line.substring(0, 50));
        // Save question text if we were collecting it
        if (inQuestion && questionBuffer.length > 0) {
          currentQuestion.questionText = questionBuffer.join('\n').trim();
          questionBuffer = [];
          inQuestion = false;
        }
        
        // Extract all options from the line - updated regex for numeric labels and Roman numerals
        const optionPattern = /(?:^|\s+)([a-dক-ঘi1-4১-৪]{1,3})[\)\.।]\s*(.+?)(?=\s+([a-dক-ঘi1-4১-৪]{1,3})[\)\.।]\s*|$)/gi;
        let match;
        let foundAny = false;
        while ((match = optionPattern.exec(line)) !== null) {
          foundAny = true;
          let optionLabel = match[1].toLowerCase();
          // Convert Bengali letters and numbers to English labels for consistency
          const labelMap = { 
            'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
            '1': 'a', '2': 'b', '3': 'c', '4': 'd',
            '১': 'a', '২': 'b', '৩': 'c', '৪': 'd',
            'i': 'i', 'ii': 'ii', 'iii': 'iii', 'iv': 'iv'
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
            // Support: 1., **1.**, Question 1:, **Question 1:**
            else if (line.match(/^(\*{0,2})\s*(Question\s*)?[\d০-৯]+[\.।:]/i)) {
              const fullMatch = line.match(/^(\*{0,2})\s*(Question\s*)?([\d০-৯]+)[\.।:]/i);
              const qNum = fullMatch[3];
              console.log(`  🔍 Found potential question number: ${qNum}`);
      
              // SAVE PREVIOUS QUESTION if it exists and has some content
              if (currentQuestion.questionText) {
                console.log(`    💾 Saving question (ID: ${qNum || 'unknown'}) before starting next`);
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
                  ...prevMetadata,
                  questionText: '',
                  options: [],
                  correctAnswer: '',
                  explanation: ''
                };
                inExplanation = false;
                explanationBuffer = [];
              }
              
              inQuestion = true;
              questionBuffer = [];
              // Remove the question number marker
              const questionText = line.replace(/^(\*{0,2})\s*(Question\s*)?[\d০-৯]+[\.।:]\*{0,2}\s*/i, '').trim();
              console.log('  ✅ Found Question text line:', questionText.substring(0, 60) + '...');
              if (questionText) {
                questionBuffer.push(questionText);
              }
            }
      // Parse correct answer (handle 0, 1, or 2 asterisks and Bengali সঠিক, including format without spaces like সঠিক:ক)
      // Matches: Correct: a, **Correct: a**, **সঠিক উত্তর: খ**, সঠিক: ক, etc.
      else if (line.match(/^\*{0,2}(Correct|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]\s*\*{0,2}\s*(.+?)\s*\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}(Correct|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]\s*\*{0,2}\s*(.+?)\s*\*{0,2}$/i);
        let answerVal = match[2].trim();
        console.log('  ✅ Found Correct answer value:', answerVal);

        const robustNormalize = (str) => (str || '').toString()
          .normalize('NFC')
          .replace(/[\\*\s\u200B\u200C\u200D]+/g, '') // Remove all markdown, spaces and invisible chars
          .toLowerCase();

        const normalizedAnswer = robustNormalize(answerVal);
        
        // --- STEP 1: Exact Text Match ---
        // (Highest priority: If the answer value exactly matches one of the option texts)
        let matchingOption = currentQuestion.options.find(opt => {
          const normalizedOptText = robustNormalize(opt.text);
          return normalizedOptText === normalizedAnswer;
        });

        if (matchingOption) {
          currentQuestion.correctAnswer = matchingOption.label;
          console.log('    🎯 Exact text match found! Label:', matchingOption.label);
        } 
        // --- STEP 2: Label Match ---
        // (If it looks like a label "a", "a)", etc. AND it's short)
        else if (answerVal.match(/^([a-dক-ঘ]|[1-4]|[১-৪])(?:\s*[\)\.।]\s*|$)/i) && answerVal.length <= 4) {
          const labelMatch = answerVal.match(/^([a-dক-ঘ]|[1-4]|[১-৪])(?:\s*[\)\.।]\s*|$)/i);
          let label = labelMatch[1].toLowerCase();
          const labelMap = { 
            'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
            '1': 'a', '2': 'b', '3': 'c', '4': 'd',
            '১': 'a', '২': 'b', '৩': 'c', '৪': 'd'
          };
          if (labelMap[label]) label = labelMap[label];
          currentQuestion.correctAnswer = label;
          console.log('    🎯 Label match found! Label:', label);
        }
        // --- STEP 3: Fuzzy Text Match ---
        else {
          console.log(`    🔍 Attempting fuzzy match for text: "${normalizedAnswer}"`);
          matchingOption = currentQuestion.options.find(opt => {
            const normalizedOptText = robustNormalize(opt.text);
            return (normalizedOptText.length > 2 && (normalizedOptText.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedOptText)));
          });

          if (matchingOption) {
            currentQuestion.correctAnswer = matchingOption.label;
            console.log('    🎯 Fuzzy match found! Label:', matchingOption.label);
          } else {
            // Fallback: take first character if it's a valid label
            const firstChar = answerVal[0].toLowerCase();
            const labelMap = { 
              'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd',
              '1': 'a', '2': 'b', '3': 'c', '4': 'd',
              '১': 'a', '২': 'b', '৩': 'c', '৪': 'd'
            };
            if (['a', 'b', 'c', 'd'].includes(firstChar)) {
              currentQuestion.correctAnswer = firstChar;
            } else if (labelMap[firstChar]) {
              currentQuestion.correctAnswer = labelMap[firstChar];
            } else {
              currentQuestion.correctAnswer = answerVal;
            }
            console.log('    ⚠️ Fallback used. Final Correct Answer:', currentQuestion.correctAnswer);
          }
        }
      }
      // Parse explanation (handle 0, 1, or 2 asterisks and Bengali ব্যাখ্যা, plus transliteration "Bekkha")
      else if (
        line.match(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha)[\s:=ঃ：]*\*{0,2}/i) ||
        line.match(/^(Explanation|ব্যাখ্যা|Bekkha)\s*$/i)
      ) {
        console.log('  ✅ Found Explanation line');
        // Save question text if we were collecting it
        if (inQuestion && questionBuffer.length > 0) {
          currentQuestion.questionText = questionBuffer.join('\n').trim();
          questionBuffer = [];
          inQuestion = false;
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
      // Collect explanation lines
      else if (inExplanation) {
        // Stop at next question set marker or metadata (handle both English and Bengali)
        if (line.match(/^\*{0,2}\[\s*(Subject|বিষয়|বিষয়)\s*:/i) || line.match(/^[#*\s\-\/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || line.match(/^[\s\-]*---[\s\-]*$/)) {
          // This is the start of next question, process current one
          if (explanationBuffer.length > 0) {
            currentQuestion.explanation = explanationBuffer.join('\n').trim();
          }
          
          // Save current question if valid
          if (currentQuestion.questionText && currentQuestion.options.length > 0) {
            finalizeQuestion(currentQuestion);
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
            questionText: '',
            options: [],
            correctAnswer: '',
            explanation: ''
          };
          inExplanation = false;
          explanationBuffer = [];
          
          // If it was just a "Question Set" marker or horizontal rule, we don't want to re-process it as metadata
          if (line.match(/^[#*\s\-\/]*(Question\s*Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+/i) || line.match(/^[\s\-]*---[\s\-]*$/)) {
             continue;
          }

          // Process this line as metadata
          i--;
          continue;
        }
        
        // Extra safety: Don't collect other metadata lines as explanation text
        if (line.match(/^\*{0,2}\[\s*(Chapter|অধ্যায়|Lesson|পাঠ|Board|বোর্ড)\s*:/i)) {
            continue;
        }
        
        explanationBuffer.push(line);
      }
      // Continue collecting question text if in question mode
      // Stop if an option label is found at the beginning of the line
      else if (inQuestion && !line.match(/^[a-dক-ঘ]\)/)) {
        // Also stop if new metadata block is found (case where options are missing)
        if (line.match(/^\*{0,2}\[\s*(Subject|বিষয়|বিষয়|Chapter|অধ্যায়|Lesson|পাঠ|Board|বোর্ড)\s*:/i)) {
            // New question starting, save current one
            if (currentQuestion.questionText) {
                finalizeQuestion(currentQuestion);
            }
            // Logic to handle metadata will be in the metadata block
            // For now just stop question mode
            inQuestion = false;
            i--; // Reprocess line
            continue;
        }
        questionBuffer.push(line);
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
  
  if (!question.subject) {
    errors.push('Subject is required');
  }
  
  if (!question.chapter) {
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
