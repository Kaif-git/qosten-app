/**
 * Parses lesson text into chapters, each containing topics, subtopics, and review questions.
 */
export function parseLessonText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string');
  }

  console.log('--- STARTING PARSE ---');
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

    if (!trimmed || trimmed === '---') continue;

    // Parse Subject and Chapter
    const subjectMatch = trimmed.match(/^(?:[*#-]*\s*)?(?:\*\*)?Subject:\s*(.*?)(?:\*\*)?(?:\s+(?:\*\*)?Chapter:|$)/i);
    const chapterMatch = trimmed.match(/(?:\*\*)?Chapter:\s*(.*?)(?:\*\*)?$/i);

    if (subjectMatch || (chapterMatch && !trimmed.startsWith('#'))) {
      const subject = subjectMatch ? subjectMatch[1].trim() : '';
      const chapterName = chapterMatch ? chapterMatch[1].trim() : '';

      if (subject || chapterName) {
        console.log(`FOUND CHAPTER: ${subject} / ${chapterName}`);
        let shouldCreateNew = false;
        const isCurrentEmpty = currentChapter && !currentChapter.chapter && currentChapter.topics.length === 0;

        if (!currentChapter) {
          shouldCreateNew = true;
        } else if (subject && chapterName) {
          shouldCreateNew = true;
        } else if (subject && !isCurrentEmpty) {
          shouldCreateNew = true;
        } else if (chapterName && currentChapter.chapter) {
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
          if (subject) currentChapter.subject = subject;
          if (chapterName) currentChapter.chapter = chapterName;
        }
        
        currentTopic = null;
        currentSubtopic = null;
        isParsingQuestions = false;
        continue;
      }
    }

    // Parse Topic
    const topicMatch = trimmed.match(/^(?:[*#•+-\s]*)?(?:###\s*)?(?:\*\*)?Topic(?:\s+[\d.]+)?\s*[:：ঃ.-]?\s*(.*?)(?:\*\*)?$/i);
    if (topicMatch) {
      const title = topicMatch[1].replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      console.log(`FOUND TOPIC: ${title}`);
      if (!currentChapter) {
        currentChapter = { subject: 'Unknown', chapter: 'General', topics: [] };
        chapters.push(currentChapter);
      }
      currentTopic = {
        title: title,
        subtopics: [],
        questions: []
      };
      currentChapter.topics.push(currentTopic);
      currentSubtopic = null;
      isParsingQuestions = false;
      continue;
    }

    // Parse Questions Header
    if (trimmed.toLowerCase().includes('review questions') || trimmed.includes('পর্যালোচনা প্রশ্ন ও উত্তর')) {
      console.log('FOUND QUESTIONS HEADER');
      isParsingQuestions = true;
      currentSubtopic = null;
      continue;
    }

    // Parse Subtopic
    const subtopicMatch = trimmed.match(/^(?:[*#•+-\s]*)?(?:####\s*)?(?:\*\*)?Subtopic(?:\s+[\d.]+)?\s*[:：ঃ.-]?\s*(.*?)(?:\*\*)?$/i);
    if (subtopicMatch) {
      const title = subtopicMatch[1].replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      console.log(`FOUND SUBTOPIC: ${title}`);
      if (currentTopic) {
        currentSubtopic = {
          title: title,
          definition: '',
          explanation: '',
          shortcut: '',
          mistakes: '',
          difficulty: ''
        };
        currentTopic.subtopics.push(currentSubtopic);
        isParsingQuestions = false;
        continue;
      }
    }

    // Parse Questions
    if (isParsingQuestions && currentTopic) {
      const qMatch = trimmed.match(/^(?:\*\*)?Q\d*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (qMatch) {
        currentQuestion = {
          question: qMatch[1].trim().replace(/\*\*$/, ''),
          options: [],
          correct_answer: '',
          explanation: ''
        };
        currentTopic.questions.push(currentQuestion);
        console.log(`FOUND QUESTION: ${currentQuestion.question.substring(0, 30)}...`);
        continue;
      }

      const correctMatch = trimmed.match(/^(?:\*\*)?Correct(?:\*\*)?\s*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (correctMatch && currentQuestion) {
        currentQuestion.correct_answer = correctMatch[1].trim().toLowerCase().replace(/\*\*$/, '').replace(/^\*\*?/, '');
        continue;
      }

      const explanationMatch = trimmed.match(/^(?:\*\*)?Explanation(?:\*\*)?\s*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (explanationMatch && currentQuestion) {
        currentQuestion.explanation = explanationMatch[1].trim().replace(/\*\*$/, '').replace(/^\*\*?/, '');
        continue;
      }

      const optionMatch = trimmed.match(/^(?:\*\*)?([a-d]|[ক-ঘ])[\).]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (optionMatch && currentQuestion) {
        currentQuestion.options.push({
          label: optionMatch[1].toLowerCase(),
          text: optionMatch[2].trim().replace(/\*\*$/, '').replace(/^\*\*?/, '')
        });
        continue;
      }
      
      if (currentQuestion) {
          if (currentQuestion.explanation) {
              currentQuestion.explanation += ' ' + trimmed;
          } else if (!currentQuestion.correct_answer && currentQuestion.options.length === 0) {
              currentQuestion.question += ' ' + trimmed;
          }
      }
      continue;
    }

    // Parse Subtopic properties
    if (currentTopic && !isParsingQuestions) {
      const propMatch = trimmed.match(/^[#*•+-\s]*(?:\*\*)?(Definition|সংজ্ঞা|Explanation|ব্যাখ্যা|Memorizing\/Understanding shortcut|মনে রাখার টিপস\/কৌশল|Common Misconceptions\/Mistake|সাধারণ ভুল ধারণা\/ভুল|Difficulty|জটিলতা)(?:\*\*)?[:：ঃ.]\s*(?:\*\*)?\s*(.*)$/i);
      
      if (propMatch) {
        const propName = propMatch[1].toLowerCase();
        let propValue = propMatch[2].trim();
        propValue = propValue.replace(/\*\*$/, '').replace(/^\*\*?/, '').trim();
        
        if (!currentSubtopic) {
          currentSubtopic = {
            title: currentTopic.title,
            definition: '',
            explanation: '',
            shortcut: '',
            mistakes: '',
            difficulty: ''
          };
          currentTopic.subtopics.push(currentSubtopic);
        }

        if (propName.includes('definition') || propName.includes('সংজ্ঞা')) {
          currentSubtopic.definition = propValue;
          currentSubtopic._lastProp = 'definition';
        } else if (propName.includes('explanation') || propName.includes('ব্যাখ্যা')) {
          currentSubtopic.explanation = propValue;
          currentSubtopic._lastProp = 'explanation';
        } else if (propName.includes('shortcut') || propName.includes('মনে রাখার টিপস')) {
          currentSubtopic.shortcut = propValue;
          currentSubtopic._lastProp = 'shortcut';
        } else if (propName.includes('misconceptions') || propName.includes('mistake') || propName.includes('সাধারণ ভুল ধারণা')) {
          currentSubtopic.mistakes = propValue;
          currentSubtopic._lastProp = 'mistakes';
        } else if (propName.includes('difficulty') || propName.includes('জটিলতা')) {
          currentSubtopic.difficulty = propValue;
          currentSubtopic._lastProp = 'difficulty';
        }
        continue;
      } else if (currentSubtopic && currentSubtopic._lastProp && !trimmed.startsWith('#') && !trimmed.match(/^\*\*?Topic/i) && !trimmed.match(/^\*\*?Subtopic/i) && !trimmed.match(/^Q\d*[:：ঃ]/i) && !trimmed.toLowerCase().includes('review questions')) {
        const prop = currentSubtopic._lastProp;
        currentSubtopic[prop] = (currentSubtopic[prop] ? currentSubtopic[prop] + '\n' : '') + trimmed;
        continue;
      }
    }

    // Capture general topic content
    if (currentTopic && !currentSubtopic && !isParsingQuestions && !trimmed.startsWith('#') && !trimmed.match(/^\*\*?Topic/i)) {
        if (!currentTopic.description) currentTopic.description = '';
        currentTopic.description = (currentTopic.description + '\n' + trimmed).trim();
    }
  }

  console.log('--- PARSE COMPLETE ---');
  return chapters;
}

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

    const qMatch = trimmed.match(/^(?:\*\*)?Q\d*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (qMatch) {
      currentQuestion = {
        question: qMatch[1].trim().replace(/\*\*$/, '').replace(/^\*\*?/, ''),
        options: [],
        correct_answer: '',
        explanation: ''
      };
      questions.push(currentQuestion);
      continue;
    }

    const correctMatch = trimmed.match(/^(?:\*\*)?Correct(?:\*\*)?\s*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (correctMatch && currentQuestion) {
      currentQuestion.correct_answer = correctMatch[1].trim().toLowerCase().replace(/\*\*$/, '').replace(/^\*\*?/, '');
      continue;
    }

    const explanationMatch = trimmed.match(/^(?:\*\*)?Explanation(?:\*\*)?\s*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (explanationMatch && currentQuestion) {
      currentQuestion.explanation = explanationMatch[1].trim().replace(/\*\*$/, '').replace(/^\*\*?/, '');
      continue;
    }

    const optionMatch = trimmed.match(/^(?:\*\*)?([a-d]|[ক-ঘ])[\).]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (optionMatch && currentQuestion) {
      currentQuestion.options.push({
        label: optionMatch[1].toLowerCase(),
        text: optionMatch[2].trim().replace(/\*\*$/, '').replace(/^\*\*?/, '')
      });
      continue;
    }

    if (currentQuestion && !trimmed.match(/^(?:\*\*)?Q\d*:/i) && !trimmed.match(/^([a-d]|[ক-ঘ])[\).]/i)) {
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
      if (topic.subtopics.length === 0 && topic.questions.length === 0) {
        errors.push(`${topicPrefix}No subtopics or questions found`);
      }
      
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
