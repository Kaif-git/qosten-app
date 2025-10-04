/**
 * Parser for math questions with LaTeX formatting
 * Supports the format:
 * **[Subject: ...]**
 * **[Chapter: ...]**
 * **[Lesson: ...]**
 * **[Board: ...]**
 * **Stem:** ...
 * **Question 1a** ...
 * **Answer 1a** ...
 */

export function parseMathQuestions(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const questions = [];
  
  // Split by horizontal rule or double newline to separate question sets
  const questionSets = text.split(/---+|\n\n\n+/).filter(s => s.trim());
  
  for (const set of questionSets) {
    const lines = set.split('\n');
    let currentQuestion = {
      type: 'cq', // Creative Question type
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      questionText: '', // Stem
      parts: [],
      language: 'en'
    };
    
    let currentPart = null;
    let inAnswer = false;
    let answerBuffer = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse metadata fields
      if (line.match(/\*\*\[Subject:\s*(.+?)\]\*\*/)) {
        currentQuestion.subject = line.match(/\*\*\[Subject:\s*(.+?)\]\*\*/)[1].trim();
      } else if (line.match(/\*\*\[Chapter:\s*(.+?)\]\*\*/)) {
        currentQuestion.chapter = line.match(/\*\*\[Chapter:\s*(.+?)\]\*\*/)[1].trim();
      } else if (line.match(/\*\*\[Lesson:\s*(.+?)\]\*\*/)) {
        currentQuestion.lesson = line.match(/\*\*\[Lesson:\s*(.+?)\]\*\*/)[1].trim();
      } else if (line.match(/\*\*\[Board:\s*(.+?)\]\*\*/)) {
        currentQuestion.board = line.match(/\*\*\[Board:\s*(.+?)\]\*\*/)[1].trim();
      }
      // Parse Stem
      else if (line.match(/\*\*Stem:\*\*/i)) {
        let stemText = line.replace(/\*\*Stem:\*\*/i, '').trim();
        // Continue reading lines until we hit a question
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/\*\*Question\s+\d+[a-z]\*\*/i)) {
          if (lines[j].trim()) {
            stemText += '\n' + lines[j].trim();
          }
          j++;
        }
        currentQuestion.questionText = stemText.trim();
        i = j - 1;
      }
      // Parse Question parts (e.g., **Question 1a**, **Question 2b**)
      else if (line.match(/\*\*Question\s+\d+([a-z])\*\*/i)) {
        // Save previous answer if exists
        if (inAnswer && currentPart && answerBuffer.length > 0) {
          currentPart.answer = answerBuffer.join('\n').trim();
          answerBuffer = [];
        }
        inAnswer = false;
        
        const match = line.match(/\*\*Question\s+\d+([a-z])\*\*/i);
        const letter = match[1].toLowerCase();
        
        let questionText = line.replace(/\*\*Question\s+\d+[a-z]\*\*/i, '').trim();
        // Continue reading lines until we hit an answer or next question
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/\*\*Answer\s+\d+[a-z]\*\*/i) && !lines[j].match(/\*\*Question\s+\d+[a-z]\*\*/i)) {
          if (lines[j].trim()) {
            questionText += '\n' + lines[j].trim();
          }
          j++;
        }
        
        currentPart = {
          letter: letter,
          text: questionText.trim(),
          marks: 5, // Default marks
          answer: ''
        };
        currentQuestion.parts.push(currentPart);
        i = j - 1;
      }
      // Parse Answer parts (e.g., **Answer 1a**, **Answer 2b**)
      else if (line.match(/\*\*Answer\s+\d+([a-z])\*\*/i)) {
        // Save previous answer if exists
        if (inAnswer && currentPart && answerBuffer.length > 0) {
          currentPart.answer = answerBuffer.join('\n').trim();
          answerBuffer = [];
        }
        
        const match = line.match(/\*\*Answer\s+\d+([a-z])\*\*/i);
        const letter = match[1].toLowerCase();
        
        // Find the corresponding part
        currentPart = currentQuestion.parts.find(p => p.letter === letter);
        if (currentPart) {
          inAnswer = true;
          answerBuffer = [];
          
          // Collect answer lines until next Question or Answer header
          let j = i + 1;
          while (j < lines.length && 
                 !lines[j].match(/\*\*Question\s+\d+[a-z]\*\*/i) && 
                 !lines[j].match(/\*\*Answer\s+\d+[a-z]\*\*/i) &&
                 !lines[j].match(/\*\*\[Subject:/)) {
            if (lines[j].trim()) {
              answerBuffer.push(lines[j].trim());
            }
            j++;
          }
          
          currentPart.answer = answerBuffer.join('\n').trim();
          answerBuffer = [];
          i = j - 1;
          inAnswer = false;
        }
      }
    }
    
    // Save last answer if still in progress
    if (inAnswer && currentPart && answerBuffer.length > 0) {
      currentPart.answer = answerBuffer.join('\n').trim();
    }
    
    // Only add if we have valid data
    if (currentQuestion.subject && currentQuestion.parts.length > 0) {
      questions.push(currentQuestion);
    }
  }
  
  return questions;
}

/**
 * Validate a math question object
 */
export function validateMathQuestion(question) {
  const errors = [];
  
  if (!question.subject) {
    errors.push('Subject is required');
  }
  
  if (!question.chapter) {
    errors.push('Chapter is required');
  }
  
  if (!question.parts || question.parts.length === 0) {
    errors.push('At least one question part is required');
  }
  
  question.parts?.forEach((part, index) => {
    if (!part.text) {
      errors.push(`Part ${part.letter}: Question text is required`);
    }
    if (!part.answer) {
      errors.push(`Part ${part.letter}: Answer is required`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format example text for the math import interface
 */
export function getMathQuestionExample() {
  return `**[Subject: Math]**
**[Chapter: Algebraic Expressions]**
**[Lesson: Factorization, Proofs, and Algebraic Manipulation]**
**[Board: Dinajpur Board-2024]**

**Stem:**
(i) \\( a^2 - 2\\sqrt{6a} + 1 = 0 \\) and (ii) \\( x - 5 = 2\\sqrt{6} \\)

**Question 1a**
Resolve into factors: \\( 4b^2 + \\frac{1}{4b^2} - 2 + 4b - \\frac{1}{b} \\)

**Question 1b**
Prove that, \\( x\\sqrt{x} - \\frac{1}{x\\sqrt{x}} = 22\\sqrt{2} \\)

**Question 1c**
Show that, \\( \\frac{a^{10} + 1}{a^3} = 922\\sqrt{6} \\)

**Answer 1a**
\\[
\\begin{aligned}
& 4b^2 + \\frac{1}{4b^2} - 2 + 4b - \\frac{1}{b} \\\\
&= (2b)^2 + \\left( \\frac{1}{2b} \\right)^2 - 2 \\cdot 2b \\cdot \\frac{1}{2b} + 2\\left( 2b - \\frac{1}{2b} \\right) \\\\
&= \\left( 2b - \\frac{1}{2b} \\right)^2 + 2\\left( 2b - \\frac{1}{2b} \\right) \\\\
&= \\left( 2b - \\frac{1}{2b} \\right) \\left( 2b - \\frac{1}{2b} + 2 \\right) \\quad \\text{(Ans.)}
\\end{aligned}
\\]

**Answer 1b**
\\[
\\begin{aligned}
\\text{Given: } & x - 5 = 2\\sqrt{6} \\\\
\\Rightarrow & x = 5 + 2\\sqrt{6} \\\\
\\Rightarrow & x = 3 + 2 + 2\\sqrt{3}\\sqrt{2} = (\\sqrt{3})^2 + 2\\sqrt{3}\\sqrt{2} + (\\sqrt{2})^2 \\\\
\\Rightarrow & x = (\\sqrt{3} + \\sqrt{2})^2 \\\\
\\Rightarrow & \\sqrt{x} = \\sqrt{3} + \\sqrt{2}
\\end{aligned}
\\]
\\[
\\begin{aligned}
\\frac{1}{\\sqrt{x}} &= \\frac{1}{\\sqrt{3} + \\sqrt{2}} \\times \\frac{\\sqrt{3} - \\sqrt{2}}{\\sqrt{3} - \\sqrt{2}} = \\frac{\\sqrt{3} - \\sqrt{2}}{3 - 2} = \\sqrt{3} - \\sqrt{2} \\\\
\\therefore & \\sqrt{x} - \\frac{1}{\\sqrt{x}} = (\\sqrt{3} + \\sqrt{2}) - (\\sqrt{3} - \\sqrt{2}) = 2\\sqrt{2}
\\end{aligned}
\\]
\\[
\\begin{aligned}
\\text{Now, } & x\\sqrt{x} - \\frac{1}{x\\sqrt{x}} = (\\sqrt{x})^3 - \\left( \\frac{1}{\\sqrt{x}} \\right)^3 \\\\
&= \\left( \\sqrt{x} - \\frac{1}{\\sqrt{x}} \\right)^3 + 3 \\cdot \\sqrt{x} \\cdot \\frac{1}{\\sqrt{x}} \\left( \\sqrt{x} - \\frac{1}{\\sqrt{x}} \\right) \\\\
&= (2\\sqrt{2})^3 + 3 \\cdot 1 \\cdot (2\\sqrt{2}) \\\\
&= 16\\sqrt{2} + 6\\sqrt{2} = 22\\sqrt{2} \\\\
&\\therefore x\\sqrt{x} - \\frac{1}{x\\sqrt{x}} = 22\\sqrt{2} \\quad \\text{(Proved)}
\\end{aligned}
\\]

**Answer 1c**
\\[
\\begin{aligned}
\\text{Given: } & a^2 - 2\\sqrt{6a} + 1 = 0 \\\\
\\Rightarrow & a^2 + 1 = 2\\sqrt{6a} \\\\
\\Rightarrow & a + \\frac{1}{a} = 2\\sqrt{6}
\\end{aligned}
\\]
\\[
\\begin{aligned}
\\text{L.H.S} &= \\frac{a^{10} + 1}{a^3} = a^7 + \\frac{1}{a^3} \\\\
&= \\left( a^2 + \\frac{1}{a^2} \\right) \\left( a^5 + \\frac{1}{a^5} \\right) - \\left( a + \\frac{1}{a} \\right) \\\\
&= \\left( (a + \\frac{1}{a})^2 - 2 \\right) \\left( (a + \\frac{1}{a})^5 - 5(a + \\frac{1}{a})^3 + 5(a + \\frac{1}{a}) \\right) - (a + \\frac{1}{a}) \\\\
&= \\left( (2\\sqrt{6})^2 - 2 \\right) \\left( (2\\sqrt{6})^5 - 5(2\\sqrt{6})^3 + 5(2\\sqrt{6}) \\right) - (2\\sqrt{6}) \\\\
&= (24 - 2) \\left( 922\\sqrt{6} \\right) - 2\\sqrt{6} \\quad \\text{[Simplifying the expression]} \\\\
&= (22)(922\\sqrt{6}) - 2\\sqrt{6} \\\\
&= 922\\sqrt{6} - 2\\sqrt{6} = 922\\sqrt{6} = \\text{R.H.S} \\\\
&\\therefore \\frac{a^{10} + 1}{a^3} = 922\\sqrt{6} \\quad \\text{(Showed)}
\\end{aligned}
\\]`;
}
