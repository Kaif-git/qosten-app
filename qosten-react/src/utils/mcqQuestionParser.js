/**
 * Parser for MCQ questions with LaTeX formatting
 * Supports both English and Bengali (Bangla) formats:
 * 
 * English format:
 * ### *Question Set X*
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
      
      // Skip "Question Set X" header
      if (line.match(/^\*+Question Set\s+\d+\*+/i)) {
        continue;
      }
      
      // Parse metadata fields (handle 0, 1 (*), or 2 (**) asterisks and Bengali field names)
      // Subject/বিষয় - If we encounter a new subject, save the current question first
      if (line.match(/^\*{0,2}\[(Subject|বিষয়):\s*(.+?)\]\*{0,2}$/i)) {
        console.log('  ✅ Found Subject line:', line.substring(0, 80));
        // Save previous question if it exists and is valid
        if (currentQuestion.subject && currentQuestion.questionText && currentQuestion.options.length > 0) {
          console.log('    💾 Saving previous question before starting new one');
          if (inExplanation && explanationBuffer.length > 0) {
            currentQuestion.explanation = explanationBuffer.join('\n').trim();
          }
          questions.push({ ...currentQuestion });
        }
        
        // Reset for new question
        currentQuestion = {
          type: 'mcq',
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
        inExplanation = false;
        inQuestion = false;
        explanationBuffer = [];
        questionBuffer = [];
        
        const match = line.match(/^\*{0,2}\[(Subject|বিষয়):\s*(.+?)\]\*{0,2}$/i);
        currentQuestion.subject = match[2].trim();
      }
      // Chapter/অধ্যায়
      else if (line.match(/^\*{0,2}\[(Chapter|অধ্যায়):\s*(.+?)\]\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[(Chapter|অধ্যায়):\s*(.+?)\]\*{0,2}$/i);
        currentQuestion.chapter = match[2].trim();
        console.log('  ✅ Found Chapter:', match[2].trim());
      }
      // Lesson/পাঠ
      else if (line.match(/^\*{0,2}\[(Lesson|পাঠ):\s*(.+?)\]\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[(Lesson|পাঠ):\s*(.+?)\]\*{0,2}$/i);
        currentQuestion.lesson = match[2].trim();
      } 
      // Board/বোর্ড
      else if (line.match(/^\*{0,2}\[(Board|বোর্ড):\s*(.+?)\]\*{0,2}$/i)) {
        const match = line.match(/^\*{0,2}\[(Board|বোর্ড):\s*(.+?)\]\*{0,2}$/i);
        currentQuestion.board = match[2].trim();
      }
      // Parse question number and text (e.g., **6.** or *6.* or 6. or **৩.** Question text)
      // Supports both English (0-9) and Bengali (০-৯) numerals
      else if (line.match(/^\*{0,2}[\d০-৯]+\.\*{0,2}/)) {
        inQuestion = true;
        questionBuffer = [];
        // Remove the question number marker (handles 0, 1, or 2 asterisks and Bengali numerals)
        const questionText = line.replace(/^\*{0,2}[\d০-৯]+\.\*{0,2}\s*/, '').trim();
        console.log('  ✅ Found Question:', questionText.substring(0, 60) + '...');
        if (questionText) {
          questionBuffer.push(questionText);
        }
      }
      // Parse options (a), b), c), d) or Bengali ক), খ), গ), ঘ))
      else if (line.match(/^[a-dক-ঘ]\)/)) {
        console.log('  ✅ Found Option:', line.substring(0, 50));
        // Save question text if we were collecting it
        if (inQuestion && questionBuffer.length > 0) {
          currentQuestion.questionText = questionBuffer.join(' ').trim();
          questionBuffer = [];
          inQuestion = false;
        }
        
        // Extract option (handle both English and Bengali)
        const optionMatch = line.match(/^([a-dক-ঘ])\)\s*(.+)/);
        if (optionMatch) {
          let optionLabel = optionMatch[1];
          // Convert Bengali letters to English for consistency
          const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
          if (bengaliToEnglish[optionLabel]) {
            optionLabel = bengaliToEnglish[optionLabel];
          }
          currentQuestion.options.push({
            label: optionLabel,
            text: optionMatch[2].trim()
          });
        }
      }
      // Parse correct answer (handle 0, 1, or 2 asterisks and Bengali সঠিক, including format without spaces like সঠিক:ক)
      else if (line.match(/^\*{0,2}(Correct|সঠিক):\*{0,2}\s*([a-dক-ঘ])\s*\*{0,2}$/i) || line.match(/^(Correct|সঠিক):\s*([a-dক-ঘ])\s*$/i)) {
        const match = line.match(/^\*{0,2}(Correct|সঠিক):\*{0,2}\s*([a-dক-ঘ])\s*\*{0,2}$/i) || line.match(/^(Correct|সঠিক):\s*([a-dক-ঘ])\s*$/i);
        let answer = match[2].toLowerCase();
        console.log('  ✅ Found Correct answer:', answer);
        // Convert Bengali letters to English
        const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
        if (bengaliToEnglish[answer]) {
          answer = bengaliToEnglish[answer];
        }
        currentQuestion.correctAnswer = answer;
      }
      // Parse explanation (handle 0, 1, or 2 asterisks and Bengali ব্যাখ্যা, plus transliteration "Bekkha")
      else if (
        line.match(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha):\*{0,2}/i) ||
        line.match(/^(Explanation|ব্যাখ্যা|Bekkha):\s*$/i)
      ) {
        console.log('  ✅ Found Explanation line');
        inExplanation = true;
        explanationBuffer = [];
        // Check if explanation starts on same line
        const explanationText = line
          .replace(/^\*{0,2}(Explanation|ব্যাখ্যা|Bekkha):\*{0,2}/i, '')
          .replace(/^(Explanation|ব্যাখ্যা|Bekkha):\s*/i, '')
          .trim();
        if (explanationText) {
          explanationBuffer.push(explanationText);
        }
      }
      // Collect explanation lines
      else if (inExplanation) {
        // Stop at next question set marker or metadata (handle both English and Bengali)
        if (line.match(/^\*{0,2}\[(Subject|বিষয়):/i) || line.match(/^\*{0,2}Question Set/i)) {
          // This is the start of next question, process current one
          if (explanationBuffer.length > 0) {
            currentQuestion.explanation = explanationBuffer.join('\n').trim();
          }
          
          // Save current question if valid
          if (currentQuestion.subject && currentQuestion.questionText && currentQuestion.options.length > 0) {
            questions.push({ ...currentQuestion });
          }
          
          // Reset for next question
          currentQuestion = {
            type: 'mcq',
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
          inExplanation = false;
          explanationBuffer = [];
          
          // Process this line as metadata
          i--;
          continue;
        }
        explanationBuffer.push(line);
      }
      // Continue collecting question text if in question mode
      else if (inQuestion && !line.match(/^[a-dক-ঘ]\)/)) {
        questionBuffer.push(line);
      }
    }
    
    // Save last question
    if (inExplanation && explanationBuffer.length > 0) {
      currentQuestion.explanation = explanationBuffer.join('\n').trim();
    }
    if (currentQuestion.subject && currentQuestion.questionText && currentQuestion.options.length > 0) {
      console.log('  💾 Saving last question of set');
      questions.push(currentQuestion);
    } else {
      console.log('  ⚠️ Last question incomplete:', {
        hasSubject: !!currentQuestion.subject,
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
  return `### **Question Set 13**

**[Subject: Math]**  
**[Chapter: Algebraic Expressions]**  
**[Lesson: Algebraic Identities]**  
**[Board: D.B.-23]**  
**13.** If \\( x + y = \\sqrt{7} \\) and \\( x - y = \\sqrt{6} \\), then what is the value of \\( x^2 + y^2 \\)?  
a) \\( \\frac{1}{2} \\)  
b) \\( \\frac{13}{2} \\)  
c) \\( \\frac{15}{2} \\)  
d) \\( \\frac{17}{2} \\)  
**Correct: b**  
**Explanation:**  
\\[
x^2 + y^2 = \\frac{(x+y)^2 + (x-y)^2}{2} = \\frac{7 + 6}{2} = \\frac{13}{2}
\\]

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
*সঠিক:* গ  
*ব্যাখ্যা:* মেজর জেনারেল রাও ফরমান আলী পাকিস্তান সেনাবাহিনীর একজন উচ্চপদস্থ কর্মকর্তা ছিলেন।`;
}
