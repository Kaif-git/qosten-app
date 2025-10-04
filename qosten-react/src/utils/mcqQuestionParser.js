/**
 * Parser for MCQ questions with LaTeX formatting
 * Supports the format:
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
 */

export function parseMCQQuestions(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const questions = [];
  
  // Split by horizontal rule or ### to separate question sets
  const questionSets = text.split(/---+|###/).filter(s => s.trim());
  
  for (const set of questionSets) {
    const lines = set.split('\n').map(line => line.trim()).filter(line => line);
    
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
      
      // Parse metadata fields (handle both * and **)
      if (line.match(/^\*+\[Subject:\s*(.+?)\]\*+/i)) {
        const match = line.match(/^\*+\[Subject:\s*(.+?)\]\*+/i);
        currentQuestion.subject = match[1].trim();
      } else if (line.match(/^\*+\[Chapter:\s*(.+?)\]\*+/i)) {
        const match = line.match(/^\*+\[Chapter:\s*(.+?)\]\*+/i);
        currentQuestion.chapter = match[1].trim();
      } else if (line.match(/^\*+\[Lesson:\s*(.+?)\]\*+/i)) {
        const match = line.match(/^\*+\[Lesson:\s*(.+?)\]\*+/i);
        currentQuestion.lesson = match[1].trim();
      } else if (line.match(/^\*+\[Board:\s*(.+?)\]\*+/i)) {
        const match = line.match(/^\*+\[Board:\s*(.+?)\]\*+/i);
        currentQuestion.board = match[1].trim();
      }
      // Parse question number and text (e.g., **6.** Question text)
      else if (line.match(/^\*+\d+\.\*+/)) {
        inQuestion = true;
        questionBuffer = [];
        // Remove the question number marker
        const questionText = line.replace(/^\*+\d+\.\*+\s*/, '').trim();
        if (questionText) {
          questionBuffer.push(questionText);
        }
      }
      // Parse options (a), b), c), d))
      else if (line.match(/^[a-d]\)/)) {
        // Save question text if we were collecting it
        if (inQuestion && questionBuffer.length > 0) {
          currentQuestion.questionText = questionBuffer.join(' ').trim();
          questionBuffer = [];
          inQuestion = false;
        }
        
        // Extract option
        const optionMatch = line.match(/^([a-d])\)\s*(.+)/);
        if (optionMatch) {
          currentQuestion.options.push({
            label: optionMatch[1],
            text: optionMatch[2].trim()
          });
        }
      }
      // Parse correct answer (handle both * and **)
      else if (line.match(/^\*+Correct:\s*([a-d])\*+/i)) {
        const match = line.match(/^\*+Correct:\s*([a-d])\*+/i);
        currentQuestion.correctAnswer = match[1].toLowerCase();
      }
      // Parse explanation (handle both * and **)
      else if (line.match(/^\*+Explanation:\*+/i)) {
        inExplanation = true;
        explanationBuffer = [];
        // Check if explanation starts on same line
        const explanationText = line.replace(/^\*+Explanation:\*+/i, '').trim();
        if (explanationText) {
          explanationBuffer.push(explanationText);
        }
      }
      // Collect explanation lines
      else if (inExplanation) {
        // Stop at next question set marker or metadata
        if (line.match(/^\*+\[Subject:/i) || line.match(/^\*+Question Set/i)) {
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
      else if (inQuestion && !line.match(/^[a-d]\)/)) {
        questionBuffer.push(line);
      }
    }
    
    // Save last question
    if (inExplanation && explanationBuffer.length > 0) {
      currentQuestion.explanation = explanationBuffer.join('\n').trim();
    }
    if (currentQuestion.subject && currentQuestion.questionText && currentQuestion.options.length > 0) {
      questions.push(currentQuestion);
    }
  }
  
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

### **Question Set 14**

**[Subject: Math]**  
**[Chapter: Algebraic Expressions]**  
**[Lesson: Algebraic Identities]**  
**[Board: M.B.-23]**  
**14.** If \\( p + q + r = 6 \\) and \\( p^2 + q^2 + r^2 = 14 \\), then what is the value of \\( (pq + qr + rp) \\)?  
a) 50  
b) 25  
c) 22  
d) 11  
**Correct: d**  
**Explanation:**  
\\[
(p+q+r)^2 = p^2+q^2+r^2 + 2(pq+qr+rp) \\Rightarrow 36 = 14 + 2(pq+qr+rp) \\Rightarrow pq+qr+rp = 11
\\]`;
}
