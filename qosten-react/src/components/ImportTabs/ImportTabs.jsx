import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';

const examples = {
  mcq: {
    en: `[Subject: Math]
[Chapter: Algebra]
[Lesson: Linear Equations]
[Board: CBSE]
[isQuizzable: true]
[Tags: easy, calculation]
1. What is the solution to 2x + 3 = 7?
a) 1
b) 2
c) 3
d) 4
Correct: b
Explanation: To solve 2x + 3 = 7, subtract 3 from both sides to get 2x = 4, then divide by 2 to find x = 2. Thus, the correct answer is option b.`,
    bn: `[Subject: Math]
[Chapter: Algebra]
[Lesson: Linear Equations]
[Board: CBSE]
[isQuizzable: true]
[Tags: easy, calculation]
1. 2x + 3 = 7 এর সমাধান কী?
a) 1
b) 2
c) 3
d) 4
Correct: b
Explanation: 2x + 3 = 7 সমাধান করতে, উভয় পাশ থেকে 3 বিয়োগ করুন এবং তারপর 2 দ্বারা ভাগ করুন। সুতরাং, সঠিক উত্তর হল b।`
  },
  cq: {
    en: `Question 1
[There is a picture]
Organelle M and N are marked in the diagram.
a. What is plasmalemma? (1)
b. Why are plastids called colour forming organs? (2)
c. Why is the organelle marked with N important for the living world? Explain. (3)
d. What types of problem will appear in living bodies if the part marked with M is absent? Analyse it. (4)

Answer:
a. The protoplasm of the living cell remains surrounded by a bilayered selectively permeable membrane known as plasmalemma or cell membrane.
b. The coloured organelles present within the cytoplasm of plant cells are known as plastids. They are responsible for the formation of colour of any plant part like leaves, flower and fruits. In absence of light plastids become colourless.
c. The N marked organelle is the chloroplast. Plants trap light energy by the chloroplast to manufacture carbohydrate food, releasing oxygen. This maintains oxygen balance and provides energy for living organisms.
d. The M-marked part is the centriole. If absent, cell division in animals would stop, halting growth and development as chromatids cannot separate during mitosis.
Subject: Biology
Chapter: Cell Structure and Function
Lesson: Organelles and Their Roles
Board: CBSE
isQuizzable: true
Tags: cell, organelle`,
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
Board: CBSE
isQuizzable: true
Tags: cell, organelle`
  },
  sq: {
    en: `[Subject: Physics]
[Chapter: Laws of Motion]
[Lesson: Newton's First Law]
[isQuizzable: true]
[Board: DB24]
[Tags: fundamental, theory]
1. What does Newton's First Law of Motion state?
Answer: Newton's First Law, also called the Law of Inertia, states that an object at rest will remain at rest, and an object in motion will continue moving at a constant velocity in a straight line, unless acted upon by an external unbalanced force. This law introduces the concept of inertia as a property of matter that resists changes to its state of motion.`,
    bn: `[Subject: Physics]
[Chapter: Laws of Motion]
[Lesson: Newton's First Law]
[isQuizzable: true]
[Board: DB24]
[Tags: fundamental, theory]
1. নিউটনের প্রথম গতিসূত্র কী বলে?
Answer: নিউটনের প্রথম গতিসূত্র, যা জড়তার সূত্র নামেও পরিচিত, বলে যে কোনও বস্তু বিশ্রামে থাকলে বিশ্রামে থাকবে এবং গতিশীল থাকলে স্থির বেগে সরলরেখায় চলতে থাকবে, যদি না কোনও বাহ্যিক অসমতুলিত বল এটির উপর কাজ করে।`
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
  const { addQuestion } = useQuestions();
  
  const example = examples[type][language];
  const title = titles[type][language];
  
  const parseMCQQuestions = (text, lang = 'en') => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const questions = [];
    let currentQuestion = null;
    let currentMetadata = {
      language: lang,
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      isQuizzable: true,
      tags: []
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse metadata
      if (line.startsWith('[') && line.endsWith(']')) {
        const metaContent = line.slice(1, -1);
        if (metaContent.includes(':')) {
          const [key, ...valueParts] = metaContent.split(':');
          const value = valueParts.join(':').trim();
          const lowerKey = key.toLowerCase().trim();
          
          switch (lowerKey) {
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
            case 'isquizzable':
              currentMetadata.isQuizzable = value.toLowerCase() === 'true';
              break;
            case 'tags':
              currentMetadata.tags = value.split(',').map(t => t.trim()).filter(t => t);
              break;
          }
        }
        continue;
      }
      
      // Parse questions (numbered lines)
      if (/^\d+\./.test(line)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        currentQuestion = {
          ...currentMetadata,
          type: 'mcq',
          question: line.replace(/^\d+\.\s*/, ''),
          options: [],
          correctAnswer: '',
          explanation: ''
        };
        continue;
      }
      
      // Parse options
      if (/^[a-d]\)/.test(line) && currentQuestion) {
        const optionLetter = line.charAt(0);
        const optionText = line.substring(2).trim();
        currentQuestion.options.push({
          label: optionLetter,
          text: optionText
        });
        continue;
      }
      
      // Parse correct answer
      if (line.toLowerCase().startsWith('correct:') && currentQuestion) {
        currentQuestion.correctAnswer = line.split(':')[1].trim().toLowerCase();
        continue;
      }
      
      // Parse explanation
      if (line.toLowerCase().startsWith('explanation:') && currentQuestion) {
        currentQuestion.explanation = line.substring(line.indexOf(':') + 1).trim();
        continue;
      }
    }
    
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    
    return questions;
  };
  
  const parseCQQuestions = (text, lang = 'en') => {
    const sections = text.split(/(?=Question \d+|প্রশ্ন \d+)/).filter(section => section.trim());
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
        isQuizzable: true,
        tags: [],
        image: null
      };
      
      let currentPart = null;
      let inAnswerSection = false;
      let questionTextLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (/^(Question \d+|প্রশ্ন \d+)/.test(line)) {
          continue;
        }
        
        if (line === '[There is a picture]' || line === '[ছবি আছে]') {
          question.image = '[There is a picture]';
          continue;
        }
        
        if (line.toLowerCase() === 'answer:' || line === 'উত্তর:') {
          inAnswerSection = true;
          question.questionText = questionTextLines.join('\n');
          continue;
        }
        
        if (line.toLowerCase().startsWith('subject:')) {
          question.subject = line.split(':')[1].trim();
          continue;
        }
        
        if (line.toLowerCase().startsWith('chapter:')) {
          question.chapter = line.split(':')[1].trim();
          continue;
        }
        
        if (line.toLowerCase().startsWith('lesson:')) {
          question.lesson = line.split(':')[1].trim();
          continue;
        }
        
        if (line.toLowerCase().startsWith('board:')) {
          question.board = line.split(':')[1].trim();
          continue;
        }
        
        if (line.toLowerCase().startsWith('isquizzable:')) {
          question.isQuizzable = line.split(':')[1].trim().toLowerCase() === 'true';
          continue;
        }
        
        if (line.toLowerCase().startsWith('tags:')) {
          question.tags = line.split(':')[1].split(',').map(t => t.trim()).filter(t => t);
          continue;
        }
        
        if (!inAnswerSection) {
          // Parse question parts
          if (/^[a-d]\./i.test(line)) {
            const partLetter = line.charAt(0).toLowerCase();
            const partText = line.substring(2).trim();
            const marksMatch = partText.match(/\((\d+)\)$/);
            const marks = marksMatch ? parseInt(marksMatch[1]) : 0;
            const textWithoutMarks = marksMatch ? partText.replace(/\s*\(\d+\)$/, '') : partText;
            
            currentPart = {
              letter: partLetter,
              text: textWithoutMarks,
              marks: marks,
              answer: ''
            };
            question.parts.push(currentPart);
          } else {
            questionTextLines.push(line);
          }
        } else {
          // Parse answers
          if (/^[a-d]\./i.test(line) && question.parts.length > 0) {
            const partLetter = line.charAt(0).toLowerCase();
            const answerText = line.substring(2).trim();
            const part = question.parts.find(p => p.letter === partLetter);
            if (part) {
              part.answer = answerText;
            }
          }
        }
      }
      
      if (question.questionText || question.parts.length > 0) {
        questions.push(question);
      }
    });
    
    return questions;
  };
  
  const parseSQQuestions = (text, lang = 'en') => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const questions = [];
    let currentQuestion = null;
    let currentMetadata = {
      language: lang,
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      isQuizzable: true,
      tags: []
    };
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Parse metadata
      if (line.startsWith('[') && line.endsWith(']')) {
        const metaContent = line.slice(1, -1);
        if (metaContent.includes(':')) {
          const [key, ...valueParts] = metaContent.split(':');
          const value = valueParts.join(':').trim();
          const lowerKey = key.toLowerCase().trim();
          
          switch (lowerKey) {
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
            case 'isquizzable':
              currentMetadata.isQuizzable = value.toLowerCase() === 'true';
              break;
            case 'tags':
              currentMetadata.tags = value.split(',').map(t => t.trim()).filter(t => t);
              break;
          }
        }
        continue;
      }
      
      // Parse questions (numbered lines)
      if (/^\d+\./.test(line)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        currentQuestion = {
          ...currentMetadata,
          type: 'sq',
          question: line.replace(/^\d+\.\s*/, ''),
          answer: ''
        };
        continue;
      }
      
      // Parse answer
      if (line.toLowerCase().startsWith('answer:') && currentQuestion) {
        currentQuestion.answer = line.substring(line.indexOf(':') + 1).trim();
        continue;
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
      alert(`Successfully parsed ${parsed.length} question(s)!`);
      
      // Add questions to the bank
      parsed.forEach(question => {
        addQuestion(question);
      });
      
    } catch (error) {
      console.error('Error parsing questions:', error);
      alert('Error parsing questions. Please check your format.');
    }
  };
  
  const clearInput = () => {
    setInputText('');
    setParsedQuestions([]);
  };

  return (
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
      
      {parsedQuestions.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Parsed Questions Preview:</h3>
          <p>{parsedQuestions.length} question(s) parsed and added to question bank.</p>
        </div>
      )}
    </div>
  );
}
