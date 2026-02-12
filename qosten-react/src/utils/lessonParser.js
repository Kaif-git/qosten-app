/**
 * Parses lesson text into chapters, each containing topics, subtopics, and review questions.
 */
export function parseLessonText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  const lines = text.split('\n');
  const chapters = [];
  
  let currentChapter = null;
  let currentTopic = null;
  let currentSubtopic = null;
  let isParsingQuestions = false;
  let currentQuestion = null;

  const cleanLine = (l) => l.replace(/[​-\u200D\uFEFF]/g, '').trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = cleanLine(line);

    if (!trimmed) continue;

    // Parse Subject and Chapter (potentially on same line)
    // Supports: 
    // Subject: Biology Chapter: Reproduction
    // **Subject: Biology** **Chapter: Reproduction**
    const subjectMatch = trimmed.match(/^(?:\*\*)?Subject:\s*(.*?)(?:\*\*)?(?:\s+(?:\*\*)?Chapter:|$)/i);
    const chapterMatch = trimmed.match(/(?:\*\*)?Chapter:\s*(.*?)(?:\*\*)?$/i);

    if (subjectMatch || (chapterMatch && !trimmed.startsWith('###'))) {
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      const chapterName = chapterMatch ? chapterMatch[1].trim() : '';

      if (subject || chapterName) {
        let shouldCreateNew = false;
        const isCurrentEmpty = currentChapter && !currentChapter.chapter && currentChapter.topics.length === 0;

        if (!currentChapter) {
          shouldCreateNew = true;
        } else if (subject && chapterName) {
          // If both are on the same line, it's a new chapter start
          shouldCreateNew = true;
        } else if (subject && !isCurrentEmpty) {
          // If Subject is provided and current chapter already has content or a name
          shouldCreateNew = true;
        } else if (chapterName && currentChapter.chapter) {
          // If Chapter is provided and current chapter already has a name
          shouldCreateNew = true;
        }

        if (shouldCreateNew) {
          currentChapter = {
            subject: subject || (currentChapter ? currentChapter.subject : ''),
            chapter: chapterName,
            topics: []
          };
          chapters.push(currentChapter);
        } else {
          // Update current chapter instead of creating new
          if (subject) currentChapter.subject = subject;
          if (chapterName) currentChapter.chapter = chapterName;
        }
        
        currentTopic = null;
        currentSubtopic = null;
        isParsingQuestions = false;
        continue;
      }
    }

    // Ensure we have a chapter to add things to
    if (!currentChapter && (trimmed.startsWith('###') || trimmed.startsWith('**Subtopic'))) {
       currentChapter = { subject: 'Unknown', chapter: 'General', topics: [] };
       chapters.push(currentChapter);
    }

    // Parse Topic
    // Matches: ### **Topic: Topic Name** or ### Topic: Topic Name
    const topicMatch = trimmed.match(/^###\s+(?:\*\*)?Topic:\s*(.*?)(?:\*\*)?$/i);
    if (topicMatch) {
      currentTopic = {
        title: topicMatch[1].trim(),
        subtopics: [],
        questions: []
      };
      currentChapter.topics.push(currentTopic);
      currentSubtopic = null;
      isParsingQuestions = false;
      continue;
    }

    // Parse Questions Header
    if (trimmed.includes('###') && trimmed.toLowerCase().includes('review questions & answers')) {
      isParsingQuestions = true;
      currentSubtopic = null;
      continue;
    }

    // Parse Subtopic
    // Matches: #### **Subtopic X: Name** or **Subtopic X: Name**
    const subtopicMatch = trimmed.match(/^(?:####\s+)?(?:\*\*)?Subtopic\s*\d*:\s*(.*?)(?:\*\*)?$/i);
    if (subtopicMatch && currentTopic && !isParsingQuestions) {
      currentSubtopic = {
        title: subtopicMatch[1].trim(),
        definition: '',
        explanation: '',
        shortcut: '',
        mistakes: '',
        difficulty: ''
      };
      currentTopic.subtopics.push(currentSubtopic);
      continue;
    }

    // Parse Subtopic properties
    if (currentSubtopic && !isParsingQuestions) {
      if (trimmed.includes('**Definition:**')) {
        currentSubtopic.definition = trimmed.replace(/^[*\-\s]*\*\*Definition:\*\*\s*/i, '').trim();
      } else if (trimmed.includes('**Explanation:**')) {
        currentSubtopic.explanation = trimmed.replace(/^[*\-\s]*\*\*Explanation:\*\*\s*/i, '').trim();
      } else if (trimmed.includes('**Memorizing/Understanding shortcut:**')) {
        currentSubtopic.shortcut = trimmed.replace(/^[*\-\s]*\*\*Memorizing\/Understanding shortcut:\*\*\s*/i, '').trim();
      } else if (trimmed.includes('**Common Misconceptions/Mistake:**')) {
        currentSubtopic.mistakes = trimmed.replace(/^[*\-\s]*\*\*Common Misconceptions\/Mistake:\*\*\s*/i, '').trim();
      } else if (trimmed.includes('**Difficulty:**')) {
        currentSubtopic.difficulty = trimmed.replace(/^[*\-\s]*\*\*Difficulty:\*\*\s*/i, '').trim();
      }
      continue;
    }

    // Parse Questions and Answers (MCQ Format)
    if (isParsingQuestions && currentTopic) {
      // Matches Q1: or **Q1: ...**
      const qMatch = trimmed.match(/^(?:\*\*)?Q\d*:\s*(.*?)(?:\*\*)?$/i);
      if (qMatch) {
        currentQuestion = {
          question: qMatch[1].trim(),
          options: [],
          correct_answer: '',
          explanation: ''
        };
        currentTopic.questions.push(currentQuestion);
        continue;
      }

      // Matches options: a) or **a)** or ক) etc.
      const optionMatch = trimmed.match(/^(?:\*\*)?([a-d]|[ক-ঘ])\)\s*(.*?)(?:\*\*)?$/i);
      if (optionMatch && currentQuestion) {
        currentQuestion.options.push({
          label: optionMatch[1].toLowerCase(),
          text: optionMatch[2].trim()
        });
        continue;
      }

      // Matches Correct: or **Correct:**
      const correctMatch = trimmed.match(/^(?:\*\*)?Correct:\s*(.*?)(?:\*\*)?$/i);
      if (correctMatch && currentQuestion) {
        currentQuestion.correct_answer = correctMatch[1].trim().toLowerCase();
        continue;
      }

      // Matches Explanation: or **Explanation:**
      const explanationMatch = trimmed.match(/^(?:\*\*)?Explanation:\s*(.*?)(?:\*\*)?$/i);
      if (explanationMatch && currentQuestion) {
        currentQuestion.explanation = explanationMatch[1].trim();
        continue;
      }
      
      // If it's just text and we have a current question, it might be part of the explanation
      if (currentQuestion && !trimmed.match(/^(?:\*\*)?Q\d*:/i) && !trimmed.match(/^([a-d]|[ক-ঘ])\)/i) && !trimmed.startsWith('---')) {
          if (currentQuestion.explanation) {
              currentQuestion.explanation += ' ' + trimmed;
          } else if (!currentQuestion.correct_answer && currentQuestion.options.length === 0) {
              // Might be continuation of question text
              currentQuestion.question += ' ' + trimmed;
          }
      }
    }
  }

  return chapters;
}

/**
 * Parses only a block of questions (useful for batch adding to existing topics).
 */
export function parseQuestionsOnly(text) {
  if (!text || typeof text !== 'string') return [];
  
  const lines = text.split('\n');
  const questions = [];
  let currentQuestion = null;

  const cleanLine = (l) => l.replace(/[​-\u200D\uFEFF]/g, '').trim();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = cleanLine(line);
    if (!trimmed) continue;

    const qMatch = trimmed.match(/^(?:\*\*)?Q\d*:\s*(.*?)(?:\*\*)?$/i);
    if (qMatch) {
      currentQuestion = {
        question: qMatch[1].trim(),
        options: [],
        correct_answer: '',
        explanation: ''
      };
      questions.push(currentQuestion);
      continue;
    }

    const optionMatch = trimmed.match(/^(?:\*\*)?([a-d]|[ক-ঘ])\)\s*(.*?)(?:\*\*)?$/i);
    if (optionMatch && currentQuestion) {
      currentQuestion.options.push({
        label: optionMatch[1].toLowerCase(),
        text: optionMatch[2].trim()
      });
      continue;
    }

    const correctMatch = trimmed.match(/^(?:\*\*)?Correct:\s*(.*?)(?:\*\*)?$/i);
    if (correctMatch && currentQuestion) {
      currentQuestion.correct_answer = correctMatch[1].trim().toLowerCase();
      continue;
    }

    const explanationMatch = trimmed.match(/^(?:\*\*)?Explanation:\s*(.*?)(?:\*\*)?$/i);
    if (explanationMatch && currentQuestion) {
      currentQuestion.explanation = explanationMatch[1].trim();
      continue;
    }

    if (currentQuestion && !trimmed.match(/^(?:\*\*)?Q\d*:/i) && !trimmed.match(/^([a-d]|[ক-ঘ])\)/i)) {
      if (currentQuestion.explanation) {
        currentQuestion.explanation += ' ' + trimmed;
      } else if (!currentQuestion.correct_answer && currentQuestion.options.length === 0) {
        currentQuestion.question += ' ' + trimmed;
      }
    }
  }

  return questions;
}

export function validateLesson(chapters) {
  const errors = [];
  if (!Array.isArray(chapters) || chapters.length === 0) {
    errors.push('No chapters found');
    return { valid: false, errors };
  }
  
  chapters.forEach((chapter, cIdx) => {
    const prefix = `Chapter ${cIdx + 1} (${chapter.chapter || 'Unnamed'}): `;
    if (!chapter.subject) errors.push(`${prefix}Subject is missing`);
    if (!chapter.chapter) errors.push(`${prefix}Chapter name is missing`);
    if (chapter.topics.length === 0) errors.push(`${prefix}No topics found`);
    
    chapter.topics.forEach((topic, idx) => {
      const topicPrefix = `${prefix}Topic "${topic.title || 'Unnamed'}": `;
      if (!topic.title) errors.push(`${topicPrefix}Missing title`);
      if (topic.subtopics.length === 0) errors.push(`${topicPrefix}No subtopics found`);
      
      topic.questions.forEach((q, qIdx) => {
        const qPrefix = `${topicPrefix}Question ${qIdx + 1}: `;
        if (!q.question) errors.push(`${qPrefix}Missing text`);
        if (q.options.length < 2) errors.push(`${qPrefix}Must have at least 2 options`);
        if (!q.correct_answer) errors.push(`${qPrefix}Missing the correct answer`);
      });
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}