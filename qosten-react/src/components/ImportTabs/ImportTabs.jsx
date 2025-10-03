import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import QuestionPreview from '../QuestionPreview/QuestionPreview';

const examples = {
  mcq: {
    en: `**[Subject: Physics]**
**[Chapter: Physical Quantities and Their Measurements]**
**[Lesson: Introduction to Physics]**
**[Board: D.B.-24; B.B.-23]**
**1.** By the combination of quantum theory and the theory of relativity, who declared hypothesised existence of an anti particle?
a) Dirac
b) Roentgen
c) Becquerel
d) Marie Curie
**Correct: a**
**Explanation:** Paul Dirac combined quantum mechanics and special relativity, predicting the existence of antimatter.

---

Alternate format (also supported):
[Subject: Math]
[Chapter: Algebra]
[Lesson: Linear Equations]
[Board: CBSE]
1. What is the solution to 2x + 3 = 7?
a) 1
b) 2
c) 3
d) 4
Correct: b
Explanation: To solve 2x + 3 = 7, subtract 3 from both sides to get 2x = 4, then divide by 2 to find x = 2.`,
    bn: `**[Subject: পদার্থবিজ্ঞান]**
**[Chapter: ভৌত রাশি এবং তাদের পরিমাপ]**
**[Lesson: পদার্থবিজ্ঞানের ভূমিকা]**
**[Board: ডি.বি.-24]**
**1.** কোয়ান্টাম তত্ত্ব এবং আপেক্ষিকতার তত্ত্বের সমন্বয়ে কে প্রতিকণার অস্তিত্ব ঘোষণা করেছিলেন?
a) ডিরাক
b) রন্টজেন
c) বেকেরেল
d) মেরি কুরি
**Correct: a**
**Explanation:** পল ডিরাক কোয়ান্টাম মেকানিক্স এবং বিশেষ আপেক্ষিকতা একত্রিত করে প্রতিপদার্থের অস্তিত্বের পূর্বাভাস দিয়েছিলেন।`
  },
  cq: {
    en: `**[Subject: Biology]**
**[Chapter: Cell Structure and Function]**
**[Lesson: Organelles and Their Roles]**
**[Board: CBSE]**
**Question 1**
[There is a picture]
Organelle M and N are marked in the diagram.
a. What is plasmalemma? (1)
b. Why are plastids called colour forming organs? (2)
c. Why is the organelle marked with N important for the living world? Explain. (3)
d. What types of problem will appear in living bodies if the part marked with M is absent? Analyse it. (4)

**Answer:**
a. The protoplasm of the living cell remains surrounded by a bilayered selectively permeable membrane known as plasmalemma or cell membrane.
b. The coloured organelles present within the cytoplasm of plant cells are known as plastids. They are responsible for the formation of colour of any plant part like leaves, flower and fruits. In absence of light plastids become colourless.
c. The N marked organelle is the chloroplast. Plants trap light energy by the chloroplast to manufacture carbohydrate food, releasing oxygen. This maintains oxygen balance and provides energy for living organisms.
d. The M-marked part is the centriole. If absent, cell division in animals would stop, halting growth and development as chromatids cannot separate during mitosis.

---

Alternate format (also supported):
Question 1
Subject: Biology
Chapter: Cell Structure
Lesson: Organelles
Board: CBSE
a. Question part (1)
b. Question part (2)
Answer:
a. Answer text
b. Answer text`,
    bn: `প্রশ্ন 1
ডায়াগ্রামে অর্গানেল M এবং N চিহ্নিত করা হয়েছে।
a. প্লাজমালেমা কী? (1)
b. প্লাস্টিডগুলিকে কেন রঙ গঠনকারী অঙ্গ বলা হয়? (2)
c. N চিহ্নিত অর্গানেলটি জীবজগতের জন্য কেন গুরুত্বপূর্ণ? ব্যাখ্যা করুন। (3)
d. M চিহ্নিত অংশ অনুপস্থিত থাকলে জীবদেহে কী ধরনের সমস্যা দেখা দেবে? বিশ্লেষণ করুন। (4)

উত্তর:
a. জীবকোষের প্রোটোপ্লাজম একটি দ্বিস্তরীয় নির্বাচনীভাবে প্রবেশযোগ্য ঝিল্লি দ্বারা ঘেরা থাকে, যা প্লাজমালেমা বা কোষঝিল্লি নামে পরিচিত।
b. উদ্ভিদ কোষের সাইটোপ্লাজমে উপস্থিত রঙিন অর্গানেলগুলি প্লাস্টিড নামে পরিচিত। এগুলি উদ্ভিদের পাতা, ফুল এবং ফলের রঙ গঠনের জন্য দায়ী।
c. N চিহ্নিত অর্গানেলটি হল ক্লোরোপ্লাস্ট। উদ্ভিদ ক্লোরোপ্লাস্ট দ্বারা আলোক শক্তি ধরে রাখে এবং অক্সিজেন নির্গত করে।
d. M চিহ্নিত অংশটি হল সেন্ট্রিওল। এটি অনুপস্থিত থাকলে প্রাণীকোষে কোষ বিভাজন বন্ধ হয়ে যাবে।
Subject: Biology
Chapter: Cell Structure and Function
Lesson: Organelles and Their Roles
Board: CBSE`
  },
  sq: {
    en: `**[Subject: Physics]**
**[Chapter: Laws of Motion]**
**[Lesson: Newton's First Law]**
**[Board: DB24]**
**1.** What does Newton's First Law of Motion state?
**Answer:** Newton's First Law, also called the Law of Inertia, states that an object at rest will remain at rest, and an object in motion will continue moving at a constant velocity in a straight line, unless acted upon by an external unbalanced force. This law introduces the concept of inertia as a property of matter that resists changes to its state of motion.

---

Alternate format (also supported):
[Subject: Physics]
[Chapter: Laws of Motion]
[Lesson: Newton's First Law]
[Board: DB24]
1. What does Newton's First Law of Motion state?
Answer: Newton's First Law states that an object at rest will remain at rest...`,
    bn: `**[Subject: পদার্থবিজ্ঞান]**
**[Chapter: গতির নিয়ম]**
**[Lesson: নিউটনের প্রথম সূত্র]**
**[Board: ডিবি24]**
**1.** নিউটনের প্রথম গতিসূত্র কী বলে?
**Answer:** নিউটনের প্রথম গতিসূত্র, যা জড়তার সূত্র নামেও পরিচিত, বলে যে কোনও বস্তু বিশ্রামে থাকলে বিশ্রামে থাকবে এবং গতিশীল থাকলে স্থির বেগে সরলরেখায় চলতে থাকবে, যদি না কোনও বাহ্যিক অসমতুলিত বল এটির উপর কাজ করে।`
  }
};

const titles = {
  mcq: { en: 'Bulk Import Questions', bn: 'Bulk Import Bangla Questions' },
  cq: { en: 'Bulk Import Constructive Questions (CQ)', bn: 'Bulk Import Bangla Constructive Questions (CQ)' },
  sq: { en: 'Bulk Import Short Questions (SQ)', bn: 'Bulk Import Bangla Short Questions (SQ)' }
};

export default function ImportTabs({ type = 'mcq', language = 'en' }) {
  const [inputText, setInputText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const { addQuestion } = useQuestions();
  
  const example = examples[type][language];
  const title = titles[type][language];
  
  const parseMCQQuestions = (text, lang = 'en') => {
    // Clean up the text: remove markdown bold ** and extra whitespace
    const cleanedText = text.replace(/\*\*/g, '').replace(/---+/g, '');
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line);
    const questions = [];
    let currentQuestion = null;
    let currentMetadata = {
      language: lang,
      subject: '',
      chapter: '',
      lesson: '',
      board: ''
    };
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Skip separator lines and informational text
      if (line.match(/^[-=]+$/)) {
        continue;
      }
      
      // Skip informational lines like "Alternate format"
      if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) {
        continue;
      }
      
      // Parse metadata - handle both [Field: Value] and **[Field: Value]** formats
      if ((line.startsWith('[') && line.endsWith(']')) || (line.includes('[') && line.includes(']'))) {
        const bracketMatch = line.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
          const metaContent = bracketMatch[1];
          if (metaContent.includes(':')) {
            const colonIndex = metaContent.indexOf(':');
            const key = metaContent.substring(0, colonIndex).trim().toLowerCase();
            const value = metaContent.substring(colonIndex + 1).trim();
            
            switch (key) {
              case 'subject':
                currentMetadata.subject = value;
                break;
              case 'chapter':
                currentMetadata.chapter = value;
                break;
              case 'lesson':
                currentMetadata.lesson = value;
                break;
              case 'board':
                currentMetadata.board = value;
                break;
              default:
                // Ignore other properties
                break;
            }
          }
        }
        continue;
      }
      
      // Parse questions - more flexible numbering (handles both 1. and **1.**)  
      if (/^\d+[.)\s]/.test(line) || /^Q\d*[.)\s]/.test(line)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        let questionText = line;
        // Remove various question prefixes flexibly
        questionText = questionText.replace(/^\d+[.)\s]*/, '');
        questionText = questionText.replace(/^Q\d*[.)\s]*/, '');
        questionText = questionText.replace(/^Question\s*\d*[.)\s]*/, '');
        
        currentQuestion = {
          ...currentMetadata,
          type: 'mcq',
          question: questionText.trim(),
          options: [],
          correctAnswer: '',
          explanation: ''
        };
        continue;
      }
      
      // Parse options - more flexible option matching
      if (/^[a-d][.)\s]/i.test(line) && currentQuestion) {
        const optionMatch = line.match(/^([a-d])[.)\s]*(.+)$/i);
        if (optionMatch) {
          const optionLetter = optionMatch[1].toLowerCase();
          const optionText = optionMatch[2].trim();
          currentQuestion.options.push({
            label: optionLetter,
            text: optionText
          });
        }
        continue;
      }
      
      // Parse correct answer - more flexible
      if (/^(correct|answer|ans)\s*[:=]\s*/i.test(line) && currentQuestion) {
        const answerMatch = line.match(/^(?:correct|answer|ans)\s*[:=]\s*([a-d])\b/i);
        if (answerMatch) {
          currentQuestion.correctAnswer = answerMatch[1].toLowerCase();
        }
        continue;
      }
      
      // Parse explanation - more flexible
      if (/^(explanation|explain|exp)\s*[:=]\s*/i.test(line) && currentQuestion) {
        const explanationMatch = line.match(/^(?:explanation|explain|exp)\s*[:=]\s*(.+)$/i);
        if (explanationMatch) {
          currentQuestion.explanation = explanationMatch[1].trim();
        }
        continue;
      }
      
      // If we have a current question and this line doesn't match any pattern,
      // it might be a continuation of the question text or explanation
      if (currentQuestion && !line.match(/^[a-d][.)\s]/i) && !line.includes('[')) {
        // If the line looks like it could be part of the question
        if (currentQuestion.question && !currentQuestion.options.length) {
          currentQuestion.question += ' ' + line;
        } else if (currentQuestion.explanation) {
          currentQuestion.explanation += ' ' + line;
        }
      }
    }
    
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    return questions;
  };
  
  const parseCQQuestions = (text, lang = 'en') => {
    // Clean up the text: remove markdown bold ** and separator lines
    const cleanedText = text.replace(/\*\*/g, '').replace(/---+/g, '');
    
    // More flexible section splitting - handle various question indicators
    const sections = cleanedText.split(/(?=(?:Question|প্রশ্ন|Q\.?|\d+\.)\s*\d*)/).filter(section => section.trim());
    const questions = [];
    
    sections.forEach(section => {
      const lines = section.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) return;
      
      const question = {
        type: 'cq',
        language: lang,
        questionText: '',
        parts: [],
        subject: '',
        chapter: '',
        lesson: '',
        board: '',
        image: null
      };
      
      let inAnswerSection = false;
      let questionTextLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Skip separator lines and informational text
        if (line.match(/^[-=]+$/)) {
          continue;
        }
        
        // Skip informational lines
        if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) {
          continue;
        }
        
        // Skip question headers - more flexible matching
        if (/^(Question|প্রশ্ন|Q\.?)\s*\d*/i.test(line)) {
          continue;
        }
        
        // Handle image indicators
        if (line.includes('picture') || line.includes('image') || line.includes('ছবি') || 
            line.includes('[There is a picture]') || line.includes('[ছবি আছে]')) {
          question.image = '[There is a picture]';
          continue;
        }
        
        // Answer section indicators - more flexible
        if (/^(answer|উত্তর|ans)\s*[:=]?\s*$/i.test(line)) {
          inAnswerSection = true;
          question.questionText = questionTextLines.join('\n').trim();
          continue;
        }
        
        // Metadata parsing - handle both bracket format and colon format
        if ((line.startsWith('[') && line.endsWith(']')) || (line.includes('[') && line.includes(']'))) {
          const bracketMatch = line.match(/\[([^\]]+)\]/);
          if (bracketMatch) {
            const metaContent = bracketMatch[1];
            if (metaContent.includes(':')) {
              const colonIndex = metaContent.indexOf(':');
              const key = metaContent.substring(0, colonIndex).trim().toLowerCase();
              const value = metaContent.substring(colonIndex + 1).trim();
              
              if (['subject', 'chapter', 'lesson', 'board'].includes(key)) {
                question[key] = value;
              }
            }
          }
          continue;
        }
        
        // Also handle non-bracket metadata format
        const metadataMatch = line.match(/^(subject|chapter|lesson|board)\s*[:=]\s*(.+)$/i);
        if (metadataMatch) {
          const key = metadataMatch[1].toLowerCase();
          const value = metadataMatch[2].trim();
          question[key] = value;
          continue;
        }
        
        // Skip removed properties (isquizzable, tags)
        if (/^(isquizzable|tags)\s*[:=]/i.test(line)) {
          continue;
        }
        
        if (!inAnswerSection) {
          // Parse question parts - more flexible
          const partMatch = line.match(/^([a-d])[.)\s]*(.+)$/i);
          if (partMatch) {
            const partLetter = partMatch[1].toLowerCase();
            let partText = partMatch[2].trim();
            
            // Extract marks more flexibly
            const marksMatch = partText.match(/[(\[]\s*(\d+)\s*[)\]]/g);
            let marks = 0;
            if (marksMatch) {
              const lastMarkMatch = marksMatch[marksMatch.length - 1];
              const markNumber = lastMarkMatch.match(/\d+/);
              if (markNumber) {
                marks = parseInt(markNumber[0]);
                partText = partText.replace(lastMarkMatch, '').trim();
              }
            }
            
            question.parts.push({
              letter: partLetter,
              text: partText,
              marks: marks,
              answer: ''
            });
          } else {
            // Add to question text if it doesn't look like metadata
            if (!line.includes(':') || !line.match(/^[a-z]+\s*:/i)) {
              questionTextLines.push(line);
            }
          }
        } else {
          // Parse answers - more flexible
          const answerMatch = line.match(/^([a-d])[.)\s]*(.+)$/i);
          if (answerMatch && question.parts.length > 0) {
            const partLetter = answerMatch[1].toLowerCase();
            const answerText = answerMatch[2].trim();
            const part = question.parts.find(p => p.letter === partLetter);
            if (part) {
              part.answer = answerText;
            }
          } else if (question.parts.length > 0) {
            // This might be a continuation of the last answer
            const lastPart = question.parts[question.parts.length - 1];
            if (lastPart && lastPart.answer) {
              lastPart.answer += ' ' + line;
            }
          }
        }
      }
      
      // Only add question if it has meaningful content
      if ((question.questionText && question.questionText.trim()) || question.parts.length > 0) {
        // Clean up empty parts
        question.parts = question.parts.filter(part => part.text.trim() || part.answer.trim());
        questions.push(question);
      }
    });
    
    return questions;
  };
  
  const parseSQQuestions = (text, lang = 'en') => {
    // Clean up the text: remove markdown bold ** and separator lines
    const cleanedText = text.replace(/\*\*/g, '').replace(/---+/g, '');
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line);
    const questions = [];
    let currentQuestion = null;
    let currentMetadata = {
      language: lang,
      subject: '',
      chapter: '',
      lesson: '',
      board: ''
    };
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Skip separator lines and informational text
      if (line.match(/^[-=]+$/)) {
        continue;
      }
      
      // Skip informational lines
      if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) {
        continue;
      }
      
      // Parse metadata - more flexible bracket matching
      if ((line.startsWith('[') && line.endsWith(']')) || (line.includes('[') && line.includes(']'))) {
        const bracketMatch = line.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
          const metaContent = bracketMatch[1];
          if (metaContent.includes(':')) {
            const colonIndex = metaContent.indexOf(':');
            const key = metaContent.substring(0, colonIndex).trim().toLowerCase();
            const value = metaContent.substring(colonIndex + 1).trim();
            
            switch (key) {
              case 'subject':
                currentMetadata.subject = value;
                break;
              case 'chapter':
                currentMetadata.chapter = value;
                break;
              case 'lesson':
                currentMetadata.lesson = value;
                break;
              case 'board':
                currentMetadata.board = value;
                break;
              default:
                // Ignore removed properties
                break;
            }
          }
        }
        continue;
      }
      
      // Parse questions - more flexible numbering
      if (/^\d+[.)\s]/.test(line) || /^Q\d*[.)\s]/.test(line)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        let questionText = line;
        // Remove various question prefixes flexibly
        questionText = questionText.replace(/^\d+[.)\s]*/, '');
        questionText = questionText.replace(/^Q\d*[.)\s]*/, '');
        questionText = questionText.replace(/^Question\s*\d*[.)\s]*/, '');
        
        currentQuestion = {
          ...currentMetadata,
          type: 'sq',
          question: questionText.trim(),
          answer: ''
        };
        continue;
      }
      
      // Parse answer - more flexible
      if (/^(answer|ans|উত্তর)\s*[:=]\s*/i.test(line) && currentQuestion) {
        const answerMatch = line.match(/^(?:answer|ans|উত্তর)\s*[:=]\s*(.+)$/i);
        if (answerMatch) {
          currentQuestion.answer = answerMatch[1].trim();
        }
        continue;
      }
      
      // If we have a current question and this line doesn't match any pattern,
      // it might be a continuation of the question or answer
      if (currentQuestion && !line.includes('[')) {
        if (currentQuestion.answer) {
          // Continuation of answer
          currentQuestion.answer += ' ' + line;
        } else if (currentQuestion.question && !line.match(/^(answer|ans|উত্তর)\s*[:=]/i)) {
          // Continuation of question
          currentQuestion.question += ' ' + line;
        }
      }
    }
    
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    return questions;
  };
  
  const parseQuestions = () => {
    if (!inputText.trim()) {
      alert('Please enter some questions to parse.');
      return;
    }
    
    let parsed = [];
    try {
      switch (type) {
        case 'mcq':
          parsed = parseMCQQuestions(inputText, language);
          break;
        case 'cq':
          parsed = parseCQQuestions(inputText, language);
          break;
        case 'sq':
          parsed = parseSQQuestions(inputText, language);
          break;
        default:
          parsed = parseMCQQuestions(inputText, language);
      }
      
      if (parsed.length === 0) {
        alert('No questions could be parsed. Please check your format.');
        return;
      }
      
      setParsedQuestions(parsed);
      setShowPreview(true);
      
    } catch (error) {
      console.error('Error parsing questions:', error);
      alert('Error parsing questions. Please check your format.');
    }
  };
  
  const confirmAddQuestions = (editedQuestions) => {
    // Add edited questions to the bank, tracking duplicates
    let addedCount = 0;
    let duplicateCount = 0;
    const duplicateQuestions = [];
    
    editedQuestions.forEach((question, index) => {
      try {
        addQuestion(question);
        addedCount++;
      } catch (error) {
        if (error.message.includes('Duplicate')) {
          duplicateCount++;
          const questionPreview = (question.questionText || question.question || '').substring(0, 50);
          duplicateQuestions.push(`${index + 1}. ${questionPreview}...`);
        } else {
          console.error('Error adding question:', error);
        }
      }
    });
    
    // Show summary message
    let message = `Successfully added ${addedCount} question(s)!`;
    if (duplicateCount > 0) {
      message += `\n${duplicateCount} duplicate question(s) were skipped.`;
      if (duplicateQuestions.length > 0 && duplicateQuestions.length <= 5) {
        message += '\n\nSkipped questions:\n' + duplicateQuestions.join('\n');
      }
    }
    alert(message);
    setShowPreview(false);
    
    // Clear the input after successful upload
    if (addedCount > 0) {
      setInputText('');
      setParsedQuestions([]);
    }
  };
  
  const cancelPreview = () => {
    setShowPreview(false);
  };
  
  const clearInput = () => {
    setInputText('');
    setParsedQuestions([]);
  };

  return (
    <>
      {showPreview && parsedQuestions.length > 0 && (
        <QuestionPreview
          questions={parsedQuestions}
          onConfirm={confirmAddQuestions}
          onCancel={cancelPreview}
        />
      )}
      
      <div className="panel">
        <h2>{title}</h2>
        <p>Format your questions like this:</p>
        <pre className="mcq-example">{example}</pre>
        <textarea 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste your ${type.toUpperCase()} questions here...`}
          style={{ minHeight: '200px' }}
        />
        <button onClick={parseQuestions}>Parse Questions</button>
        <button className="danger" onClick={clearInput}>Clear</button>
        
        {parsedQuestions.length > 0 && !showPreview && (
          <div style={{ marginTop: '20px' }}>
            <h3>Parsed Questions Preview:</h3>
            <p>{parsedQuestions.length} question(s) parsed and added to question bank.</p>
          </div>
        )}
      </div>
    </>
  );
}
