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
    const subjectHeaderMatch = trimmed.match(/^(?:[*#-]*\s*)?(?:\*\*)?Subject\s*[:：ঃ]\s*(.*?)(?:\*\*)?(?:\s+(?:\*\*)?Chapter\s*[:：ঃ]|$)/i);
    const chapterHeaderMatch = trimmed.match(/^(?:[*#-]*\s*)?(?:\*\*)?Chapter\s*[:：ঃ]\s*(.*?)(?:\*\*)?$/i);
    const bengaliSubjectMatch = trimmed.match(/^(?:[*#-]*\s*)?(?:\*\*)?বিষয়\s*[:：ঃ]\s*(.*?)(?:\*\*)?$/i);
    const bengaliChapterMatch = trimmed.match(/^(?:[*#-]*\s*)?(?:\*\*)?অধ্যায়\s*[:：ঃ]\s*(.*?)(?:\*\*)?$/i);

    // Logic for Chapter/Subject:
    // If we see "Subject" or "অধ্যায়", it's definitely a Chapter start.
    // If we see "বিষয়", it might be a Subject (if no chapter exists) or a Topic (if chapter exists).
    
    if (subjectHeaderMatch || chapterHeaderMatch || bengaliChapterMatch || (bengaliSubjectMatch && !currentChapter)) {
      let subject = '';
      let chapterName = '';

      if (subjectHeaderMatch) subject = subjectHeaderMatch[1].trim();
      if (chapterHeaderMatch) chapterName = chapterHeaderMatch[1].trim();
      if (bengaliSubjectMatch && !currentChapter) subject = bengaliSubjectMatch[1].trim();
      if (bengaliChapterMatch) chapterName = bengaliChapterMatch[1].trim();

      if (subject || chapterName) {
        // If current chapter is empty, update it
        if (currentChapter && currentChapter.topics.length === 0) {
          if (subject) currentChapter.subject = subject;
          if (chapterName) currentChapter.chapter = chapterName;
          console.log(`UPDATED EMPTY CHAPTER: ${currentChapter.subject} / ${currentChapter.chapter}`);
        } else {
          currentChapter = {
            subject: subject || (currentChapter ? currentChapter.subject : 'Unknown'),
            chapter: chapterName || 'General',
            topics: []
          };
          chapters.push(currentChapter);
          console.log(`NEW CHAPTER: ${currentChapter.subject} / ${currentChapter.chapter}`);
        }
        currentTopic = null;
        currentSubtopic = null;
        isParsingQuestions = false;
        continue;
      }
    }

    // Parse Topic (English "Topic" or Bengali "বিষয়" if we already have a chapter)
    const topicMatch = trimmed.match(/^(?:[*#•+-\s]*)?(?:###\s*)?(?:\*\*)?(Topic|বিষয়)\s*[:：ঃ.-]?\s*(.*?)(?:\*\*)?$/i);
    if (topicMatch) {
      const title = topicMatch[2].replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      
      if (!currentChapter) {
        currentChapter = { subject: 'Unknown', chapter: 'General', topics: [] };
        chapters.push(currentChapter);
      }

      console.log(`FOUND TOPIC: ${title}`);
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

    // Parse Subtopic
    const subtopicMatch = trimmed.match(/^(?:[*#•+-\s]*)?(?:####\s*)?(?:\*\*)?(Subtopic|উপবিষয়)\s*[:：ঃ.-]?\s*(.*?)(?:\*\*)?$/i);
    if (subtopicMatch && currentTopic) {
      const title = subtopicMatch[2].replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      console.log(`FOUND SUBTOPIC: ${title}`);
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

    // Parse Questions Header
    if (trimmed.toLowerCase().includes('review questions') || 
        trimmed.includes('পর্যালোচনা প্রশ্ন ও উত্তর') ||
        trimmed.includes('পুনরালোচনা প্রশ্ন ও উত্তর') ||
        trimmed.includes('বিষয়ভিত্তিক MCQ') ||
        trimmed.match(/^(?:###\s*)?(?:\*\*)?.*MCQ.*(?:\*\*)?$/i) ||
        trimmed.match(/^(?:###\s*)?(?:\*\*)?.*Questions.*(?:\*\*)?$/i) ||
        trimmed.match(/^(?:###\s*)?(?:\*\*)?.*প্রশ্ন.*(?:\*\*)?$/i)
       ) {
      console.log('FOUND QUESTIONS HEADER');
      isParsingQuestions = true;
      currentSubtopic = null;
      continue;
    }

    // Parse Questions
    if (isParsingQuestions && currentTopic) {
      // Support English and Bengali digits in Question number
      const qMatch = trimmed.match(/^(?:\*\*)?(?:Q|প্রশ্ন)\s*[\d০-৯]*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
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

      const correctMatch = trimmed.match(/^(?:\*\*)?(?:Correct|সঠিক|সঠিক উত্তর)(?:\*\*)?\s*[:：ঃ-]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (correctMatch && currentQuestion) {
        let ans = correctMatch[1].trim().toLowerCase().replace(/\*\*$/, '').replace(/^\*\*?/, '');
        if (ans === 'ক') ans = 'a';
        else if (ans === 'খ') ans = 'b';
        else if (ans === 'গ') ans = 'c';
        else if (ans === 'ঘ') ans = 'd';
        currentQuestion.correct_answer = ans;
        continue;
      }
  
      const explanationMatch = trimmed.match(/^(?:\*\*)?(?:Explanation|ব্যাখ্যা)(?:\*\*)?\s*[:：ঃ-]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (explanationMatch && currentQuestion) {
        currentQuestion.explanation = explanationMatch[1].trim().replace(/\*\*$/, '').replace(/^\*\*?/, '');
        continue;
      }

      const optionMatch = trimmed.match(/^(?:\*\*)?([a-d]|[ক-ঘ])[).]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
      if (optionMatch && currentQuestion) {
        let label = optionMatch[1].toLowerCase();
        if (label === 'ক') label = 'a';
        else if (label === 'খ') label = 'b';
        else if (label === 'গ') label = 'c';
        else if (label === 'ঘ') label = 'd';

        currentQuestion.options.push({
          label: label,
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
      const propMatch = trimmed.match(/^[#*•+-\s]*(?:\*\*)?(Definition|সংজ্ঞা|Explanation|ব্যাখ্যা|Memorizing\/Understanding shortcut|মুখস্থ\/বোঝার কৌশল|মনে রাখার টিপস\/কৌশল|Common Misconceptions\/Mistake|সাধারণ ভুল ধারণা\/ভুল|Difficulty|কঠিনতা|জটিলতা)(?:\*\*)?[:：ঃ.]\s*(?:\*\*)?\s*(.*)$/i);
      
      if (propMatch) {
        const propName = propMatch[1].toLowerCase();
        let propValue = propMatch[2].trim();
        propValue = propValue.replace(/\*\*$/, '').replace(/^\*\*?/, '').trim();
        
        // If no subtopic yet, create a default one with topic title
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
        } else if (propName.includes('shortcut') || propName.includes('কৌশল') || propName.includes('টিপস')) {
          currentSubtopic.shortcut = propValue;
          currentSubtopic._lastProp = 'shortcut';
        } else if (propName.includes('misconceptions') || propName.includes('mistake') || propName.includes('ভুল')) {
          currentSubtopic.mistakes = propValue;
          currentSubtopic._lastProp = 'mistakes';
        } else if (propName.includes('difficulty') || propName.includes('কঠিনতা') || propName.includes('জটিলতা')) {
          currentSubtopic.difficulty = propValue;
          currentSubtopic._lastProp = 'difficulty';
        }
        continue;
      } else if (currentSubtopic && currentSubtopic._lastProp && !trimmed.startsWith('#') && !trimmed.match(/^(?:বিষয়|অধ্যায়|উপবিষয়|Topic|Chapter|Subtopic)/i)) {
        const prop = currentSubtopic._lastProp;
        currentSubtopic[prop] = (currentSubtopic[prop] ? currentSubtopic[prop] + '\n' : '') + trimmed;
        continue;
      }
    }
  }

  // Filter out any empty chapters
  const finalChapters = chapters.filter(c => c.topics.length > 0);

  console.log('--- PARSE COMPLETE ---');
  return finalChapters;
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

    const qMatch = trimmed.match(/^(?:\*\*)?(?:Q|প্রশ্ন)\s*[\d০-৯]*[:：ঃ]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
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

    const correctMatch = trimmed.match(/^(?:\*\*)?(?:Correct|সঠিক|সঠিক উত্তর)(?:\*\*)?\s*[:：ঃ-]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (correctMatch && currentQuestion) {
      let ans = correctMatch[1].trim().toLowerCase().replace(/\*\*$/, '').replace(/^\*\*?/, '');
      if (ans === 'ক') ans = 'a';
      else if (ans === 'খ') ans = 'b';
      else if (ans === 'গ') ans = 'c';
      else if (ans === 'ঘ') ans = 'd';
      currentQuestion.correct_answer = ans;
      continue;
    }

    const explanationMatch = trimmed.match(/^(?:\*\*)?(?:Explanation|ব্যাখ্যা)(?:\*\*)?\s*[:：ঃ-]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (explanationMatch && currentQuestion) {
      currentQuestion.explanation = explanationMatch[1].trim().replace(/\*\*$/, '').replace(/^\*\*?/, '');
      continue;
    }

    const optionMatch = trimmed.match(/^(?:\*\*)?([a-d]|[ক-ঘ])[).]\s*(?:\*\*)?\s*(.*?)(?:\*\*)?$/i);
    if (optionMatch && currentQuestion) {
      let label = optionMatch[1].toLowerCase();
      if (label === 'ক') label = 'a';
      else if (label === 'খ') label = 'b';
      else if (label === 'গ') label = 'c';
      else if (label === 'ঘ') label = 'd';

      currentQuestion.options.push({
        label: label,
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
  }

  return questions;
}

export function validateLesson(chapters) {
  const errors = [];
  if (!Array.isArray(chapters) || chapters.length === 0) {
    errors.push('No valid lessons or chapters found. Please check your format (Subject: ..., Chapter: ..., Topic: ...).');
    return { valid: false, errors };
  }
  
  chapters.forEach((chapter, cIdx) => {
    const prefix = `Chapter ${cIdx + 1} (${chapter.chapter || 'Unnamed'}): `;
    if (!chapter.subject) errors.push(`${prefix}Subject is missing`);
    if (chapter.topics.length === 0) errors.push(`${prefix}No topics found`);
    
    chapter.topics.forEach((topic, idx) => {
      const topicPrefix = `${prefix}Topic "${topic.title || 'Unnamed'}": `;
      if (!topic.title) errors.push(`${topicPrefix}Missing title`);
      
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

/**
 * Converts chapter data (with topics, subtopics, and questions) to the importable Markdown format.
 */
export function formatLessonToMarkdown(subject, chapterName, topics) {
  let output = `Subject: ${subject}\nChapter: ${chapterName}\n\n`;

  topics.forEach(topic => {
    output += `### **Topic: ${topic.title}**\n`;
    
    // Add Subtopics
    if (topic.subtopics && topic.subtopics.length > 0) {
      topic.subtopics.forEach(st => {
        output += `**Subtopic: ${st.title}**\n`;
        if (st.definition) output += `*   **Definition:** ${st.definition}\n`;
        if (st.explanation) output += `*   **Explanation:** ${st.explanation}\n`;
        if (st.shortcut) output += `*   **Memorizing/Understanding shortcut:** ${st.shortcut}\n`;
        if (st.mistakes) output += `*   **Common Misconceptions/Mistake:** ${st.mistakes}\n`;
        if (st.difficulty) output += `*   **Difficulty:** ${st.difficulty}\n`;
        output += `\n`;
      });
    }

    // Add Questions
    if (topic.questions && topic.questions.length > 0) {
      output += `---\n\n### **Review Questions & Answers: ${topic.title}**\n`;
      topic.questions.forEach((q, idx) => {
        output += `**Q${idx + 1}: ${q.question}**\n`;
        q.options.forEach(opt => {
          output += `${opt.label}) ${opt.text}\n`;
        });
        output += `**Correct: ${q.correct_answer}**\n`;
        if (q.explanation) output += `**Explanation:** ${q.explanation}\n`;
        output += `\n`;
      });
    }

    output += `---\n\n`;
  });

  return output.trim().replace(/---\n*$/, ''); // Remove trailing separator
}
