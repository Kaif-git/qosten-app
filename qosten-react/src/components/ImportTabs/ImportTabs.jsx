import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import QuestionPreview from '../QuestionPreview/QuestionPreview';
import { translateEnglishWordsToBangla } from '../../utils/translateToBangla';

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
    bn: `*[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]*  
*[অধ্যায়: বাংলাদেশের স্বাধীনতা]*  
*[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি, সশস্ত্র সংগ্রাম ও সার্বভৌম বাংলাদেশের উদ্ভব]*  
*[বোর্ড: ডি.বি.-২৪]*  
*৩.* "অপারেশন সার্চলাইট"-এর মূল পরিকল্পনাকারী কে ছিলেন?  
ক) ইয়াহিয়া খান  
খ) আইয়ুব খান  
গ) রাও ফরমান আলী  
ঘ) জুলফিকার আলী ভুট্টো  
*সঠিক:* গ  
*ব্যাখ্যা:* মেজর জেনারেল রাও ফরমান আলী পাকিস্তান সেনাবাহিনীর একজন উচ্চপদস্থ কর্মকর্তা ছিলেন এবং তিনি ১৯৭১ সালের মুক্তিযুদ্ধ গণহত্যার মূল পরিকল্পনাকারী হিসেবে বিবেচিত হন।

---

*[বিষয়: বাংলাদেশ ও বিশ্বপরিচয়]*  
*[অধ্যায়: বাংলাদেশের স্বাধীনতা]*  
*[পাঠ: মুক্তিযুদ্ধের প্রস্তুতি, সশস্ত্র সংগ্রাম ও সার্বভৌম বাংলাদেশের উদ্ভব]*  
*[বোর্ড: এম.বি.-২৪; বি.বি.-২৪]*  
*৪.* অস্থায়ী সরকারের অর্থমন্ত্রী কে ছিলেন?  
ক) তাজউদ্দীন আহমেদ  
খ) এ.এইচ.এম. কামারুজ্জামান  
গ) খন্দকার মোশতাক আহমেদ  
ঘ) এম. মনসুর আলী  
*সঠিক:* ঘ  
*ব্যাখ্যা:* মুজিবনগর সরকারে এম. মনসুর আলী অর্থমন্ত্রীর দায়িত্ব পালন করেন।`
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
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const { addQuestion } = useQuestions();
  
  const example = examples[type][language];
  const title = titles[type][language];
  
  const parseMCQQuestions = (text, lang = 'en') => {
    console.log('🔍 ImportTabs parseMCQQuestions: Starting...');
    console.log('📄 Input length:', text.length);
    console.log('📄 First 100 chars:', text.substring(0, 100));
    
    // Clean up the text: remove markdown bold * and ** (both single and double asterisks)
    const cleanedText = text.replace(/\*+/g, '').replace(/---+/g, '');
    console.log('🧽 Cleaned text length:', cleanedText.length);
    
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line);
    console.log('📝 Total lines:', lines.length);
    
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
      // Also handle Bengali field names: বিষয়, অধ্যায়, পাঠ, বোর্ড
      if ((line.startsWith('[') && line.endsWith(']')) || (line.includes('[') && line.includes(']'))) {
        const bracketMatch = line.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
          const metaContent = bracketMatch[1];
          if (metaContent.includes(':')) {
            const colonIndex = metaContent.indexOf(':');
            const key = metaContent.substring(0, colonIndex).trim().toLowerCase();
            const value = metaContent.substring(colonIndex + 1).trim();
            
            // Map Bengali keys to English equivalents
            const keyMap = {
              'subject': 'subject',
              'বিষয়': 'subject',
              'chapter': 'chapter',
              'অধ্যায়': 'chapter',
              'lesson': 'lesson',
              'পাঠ': 'lesson',
              'board': 'board',
              'বোর্ড': 'board'
            };
            
            const mappedKey = keyMap[key];
            if (mappedKey) {
              console.log(`  ✅ Found ${mappedKey}:`, value);
              // Save previous question if starting new one
              if (mappedKey === 'subject' && currentQuestion && currentQuestion.questionText && currentQuestion.options.length > 0) {
                console.log('    💾 Saving previous question');
                questions.push(currentQuestion);
                currentQuestion = null;
                currentMetadata = { language: lang, subject: '', chapter: '', lesson: '', board: '' };
              }
              currentMetadata[mappedKey] = value;
            }
          }
        }
        continue;
      }
      
      // Parse questions - handle English (0-9) and Bengali (০-৯) numerals
      if (/^[\d০-৯]+[.)\s]/.test(line) || /^Q[\d০-৯]*[.)\s]/.test(line)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        let questionText = line;
        // Remove various question prefixes flexibly (handle Bengali numerals)
        questionText = questionText.replace(/^[\d০-৯]+[.)\s]*/, '');
        questionText = questionText.replace(/^Q[\d০-৯]*[.)\s]*/, '');
        questionText = questionText.replace(/^Question\s*[\d০-৯]*[.)\s]*/, '');
        
        console.log('  ✅ Found Question:', questionText.substring(0, 60) + '...');
        
        currentQuestion = {
          ...currentMetadata,
          type: 'mcq',
          questionText: questionText.trim(),
          options: [],
          correctAnswer: '',
          explanation: ''
        };
        continue;
      }
      
      // Parse options - more flexible option matching (handle both English a-d and Bengali ক-ঘ)
      if (/^[a-dক-ঘ][.)\s]/i.test(line) && currentQuestion) {
        const optionMatch = line.match(/^([a-dক-ঘ])[.)\s]*(.+)$/i);
        if (optionMatch) {
          let optionLetter = optionMatch[1].toLowerCase();
          const optionText = optionMatch[2].trim();
          
          // Convert Bengali letters to English for consistency
          const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
          if (bengaliToEnglish[optionLetter]) {
            optionLetter = bengaliToEnglish[optionLetter];
          }
          
          currentQuestion.options.push({
            label: optionLetter,
            text: optionText
          });
        }
        continue;
      }
      
      // Parse correct answer - more flexible (handle both English and Bengali)
      if (/^(correct|answer|ans|সঠিক)\s*[:=]\s*/i.test(line) && currentQuestion) {
        const answerMatch = line.match(/^(?:correct|answer|ans|সঠিক)\s*[:=]\s*([a-dক-ঘ])\s*$/i);
        if (answerMatch) {
          let answer = answerMatch[1].toLowerCase();
          console.log('  ✅ Found Correct answer:', answer);
          // Convert Bengali letters to English
          const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
          if (bengaliToEnglish[answer]) {
            answer = bengaliToEnglish[answer];
          }
          currentQuestion.correctAnswer = answer;
        } else {
          console.log('  ⚠️ Failed to match correct answer in line:', line);
        }
        continue;
      }
      
      // Parse explanation - more flexible (handle both English and Bengali ব্যাখ্যা)
      if (/^(explanation|explain|exp|ব্যাখ্যা)\s*[:=]\s*/i.test(line) && currentQuestion) {
        const explanationMatch = line.match(/^(?:explanation|explain|exp|ব্যাখ্যা)\s*[:=]\s*(.+)$/i);
        if (explanationMatch) {
          console.log('  ✅ Found Explanation:', explanationMatch[1].substring(0, 50) + '...');
          currentQuestion.explanation = explanationMatch[1].trim();
        }
        continue;
      }
      
      // If we have a current question and this line doesn't match any pattern,
      // it might be a continuation of the question text or explanation
      if (currentQuestion && !line.match(/^[a-dক-ঘ][.)\s]/i) && !line.includes('[')) {
        // If the line looks like it could be part of the question
        if (currentQuestion.questionText && !currentQuestion.options.length) {
          currentQuestion.questionText += ' ' + line;
        } else if (currentQuestion.explanation) {
          currentQuestion.explanation += ' ' + line;
        }
      }
    }
    
    if (currentQuestion) {
      console.log('  💾 Saving last question');
      questions.push(currentQuestion);
    }
    
    console.log(`\n✅ ImportTabs: Total questions parsed: ${questions.length}`);
    return questions;
  };
  
  const parseCQQuestions = (text, lang = 'en') => {
    console.log('🔍 parseCQQuestions: Starting...');
    console.log('📄 Input length:', text.length);
    
    // Clean up the text: remove markdown bold ** but keep separator lines for splitting
    const cleanedText = text.replace(/\*\*/g, '');
    
    // Split by horizontal rule (---) to separate questions
    const sections = cleanedText.split(/\n---+\n/).filter(section => section.trim());
    console.log('📦 Question sections found:', sections.length);
    
    const questions = [];
    
    for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
      const section = sections[sectionIdx];
      console.log(`\n📋 Processing section ${sectionIdx + 1}/${sections.length}`);
      
      const lines = section.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) continue;
      
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
      let currentAnswerPart = null;
      let useBulletPointFormat = false; // Flag for bullet-point answer format
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Skip informational lines
        if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) {
          continue;
        }
        
        // Parse metadata - handle both [Field: Value] format with optional brackets
        // Support both English and Bengali field names
        if ((line.startsWith('[') && line.endsWith(']')) || (line.includes('[') && line.includes(']'))) {
          const bracketMatch = line.match(/\[([^\]]+)\]/);
          if (bracketMatch) {
            const metaContent = bracketMatch[1];
            if (metaContent.includes(':')) {
              const colonIndex = metaContent.indexOf(':');
              const key = metaContent.substring(0, colonIndex).trim().toLowerCase();
              const value = metaContent.substring(colonIndex + 1).trim();
              
              // Map Bengali keys to English
              const keyMap = {
                'subject': 'subject',
                'বিষয়': 'subject',
                'chapter': 'chapter',
                'অধ্যায়': 'chapter',
                'lesson': 'lesson',
                'পাঠ': 'lesson',
                'board': 'board',
                'বোর্ড': 'board'
              };
              
              const mappedKey = keyMap[key];
              if (mappedKey) {
                question[mappedKey] = value;
                console.log(`  ✅ Metadata ${mappedKey}:`, value);
              }
            }
          }
          continue;
        }
        
        // Handle "বোর্ড: X" format (board metadata without brackets)
        if (/^(board|বোর্ড)\s*:/i.test(line)) {
          const boardMatch = line.match(/^(?:board|বোর্ড)\s*:\s*(.+)$/i);
          if (boardMatch) {
            question.board = boardMatch[1].trim();
            console.log(`  ✅ Metadata board:`, question.board);
          }
          continue;
        }
        
        // Skip "Question X" or "প্রশ্ন X" headers
        if (/^(Question|প্রশ্ন|Q\.?)\s*[\d০-৯]*/i.test(line) && line.length < 20) {
          continue;
        }
        
        // Handle image indicators
        if (line.includes('picture') || line.includes('image') || line.includes('ছবি') || 
            line.includes('[There is a picture]') || line.includes('[ছবি আছে]')) {
          question.image = '[There is a picture]';
          questionTextLines.push(line);
          continue;
        }
        
        // Answer section indicators
        if (/^(answer|উত্তর|ans)\s*[:=]?\s*$/i.test(line)) {
          inAnswerSection = true;
          question.questionText = questionTextLines.join('\n').trim();
          console.log(`  ✅ Found Answer section. Stem length: ${question.questionText.length}`);
          continue;
        }
        
        if (!inAnswerSection) {
          // Parse question parts (a., b., c., d. or ক., খ., গ., ঘ.)
          const partMatch = line.match(/^([a-dক-ঘ])[.)\s]+(.+)$/i);
          if (partMatch) {
            let partLetter = partMatch[1].toLowerCase();
            let partText = partMatch[2].trim();
            
            // Convert Bengali letters to English
            const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
            if (bengaliToEnglish[partLetter]) {
              partLetter = bengaliToEnglish[partLetter];
            }
            
            // Extract marks - look for (1), (2), (3), (4) or Bengali numerals at the end
            // Also remove standalone Bengali numerals like ১, ২, ৩, ৪ at the end
            const marksMatch = partText.match(/[(\[]\s*([\d০-৯]+)\s*[)\]]\s*$/);  
            let marks = 0;
            if (marksMatch) {
              // Convert Bengali numerals to English
              const bengaliNumerals = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
              let marksStr = marksMatch[1];
              for (const [bn, en] of Object.entries(bengaliNumerals)) {
                marksStr = marksStr.replace(new RegExp(bn, 'g'), en);
              }
              marks = parseInt(marksStr);
              partText = partText.replace(marksMatch[0], '').trim();
            } else {
              // Also check for standalone Bengali numeral at the end (without parentheses)
              const standaloneMatch = partText.match(/\s+([০-৯]+)\s*$/);
              if (standaloneMatch) {
                const bengaliNumerals = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                let marksStr = standaloneMatch[1];
                for (const [bn, en] of Object.entries(bengaliNumerals)) {
                  marksStr = marksStr.replace(new RegExp(bn, 'g'), en);
                }
                marks = parseInt(marksStr);
                partText = partText.replace(standaloneMatch[0], '').trim();
              }
            }
            
            question.parts.push({
              letter: partLetter,
              text: partText,
              marks: marks,
              answer: ''
            });
            console.log(`  ✅ Part ${partLetter}: ${partText.substring(0, 50)}... (${marks} marks)`);
          } else {
            // Add to question text/stem if it doesn't look like metadata
            if (!line.match(/^\[.*\]$/) && !line.match(/^[a-z]+\s*:/i) && !line.match(/^(board|বোর্ড)\s*:/i)) {
              questionTextLines.push(line);
            }
          }
        } else {
          // In answer section - check for bullet-point format (·)
          if (line.startsWith('·')) {
            useBulletPointFormat = true;
            const bulletAnswer = line.substring(1).trim();
            
            // Find the next available part without an answer
            const nextEmptyPart = question.parts.find(p => !p.answer || p.answer === '');
            if (nextEmptyPart) {
              nextEmptyPart.answer = bulletAnswer;
              currentAnswerPart = nextEmptyPart;
              console.log(`  ✅ Bullet Answer ${nextEmptyPart.letter}: ${bulletAnswer.substring(0, 50)}...`);
            }
          } else if (useBulletPointFormat && currentAnswerPart && !line.startsWith('·') && !line.match(/^(board|বোর্ড)\s*:/i)) {
            // Continuation of bullet-point answer
            if (currentAnswerPart.answer) {
              currentAnswerPart.answer += ' ' + line;
            }
          } else {
            // Standard format: parse answers (a., b., c., d. or ক., খ., গ., ঘ.)
            const answerMatch = line.match(/^([a-dক-ঘ])[.)\s]+(.+)$/i);
            if (answerMatch) {
              let partLetter = answerMatch[1].toLowerCase();
              const answerText = answerMatch[2].trim();
              
              // Convert Bengali letters to English
              const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
              if (bengaliToEnglish[partLetter]) {
                partLetter = bengaliToEnglish[partLetter];
              }
              
              const part = question.parts.find(p => p.letter === partLetter);
              if (part) {
                part.answer = answerText;
                currentAnswerPart = part;
                console.log(`  ✅ Answer ${partLetter}: ${answerText.substring(0, 50)}...`);
              }
            } else if (!line.match(/^(board|বোর্ড)\s*:/i)) {
              // Multi-line answer continuation (not board metadata)
              if (currentAnswerPart && currentAnswerPart.answer) {
                currentAnswerPart.answer += ' ' + line;
              } else if (question.parts.length > 0 && !useBulletPointFormat) {
                // If no current answer part, append to the last part
                const lastPart = question.parts[question.parts.length - 1];
                if (lastPart) {
                  if (lastPart.answer) {
                    lastPart.answer += ' ' + line;
                  } else {
                    lastPart.answer = line;
                  }
                  currentAnswerPart = lastPart;
                }
              }
            }
          }
        }
      }
      
      // If questionText is still empty and we have collected lines, set it
      if (!question.questionText && questionTextLines.length > 0) {
        question.questionText = questionTextLines.join('\n').trim();
      }
      
      // Only add question if it has meaningful content
      // Accept questions with either subject metadata OR board metadata (for Bangla format)
      const hasMetadata = question.subject || question.board;
      const hasContent = (question.questionText && question.questionText.trim()) || question.parts.length > 0;
      
      if (hasMetadata && hasContent) {
        // Clean up empty parts
        question.parts = question.parts.filter(part => part.text.trim());
        questions.push(question);
        console.log(`  💾 Question saved with ${question.parts.length} parts`);
      } else {
        console.log(`  ⚠️ Question incomplete - not saved (hasMetadata: ${hasMetadata}, hasContent: ${hasContent})`);
      }
    }
    
    console.log(`\n✅ Total CQ questions parsed: ${questions.length}`);
    return questions;
  };
  
  const parseSQQuestions = (text, lang = 'en') => {
    // Clean up the text: remove markdown bold ** and separator lines
    const cleanedText = text.replace(/\*\*/g, '').replace(/---+/g, '');
    const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line);
    const questions = [];
    let currentQuestion = null;
    // Global metadata that applies to all questions
    let globalMetadata = {
      language: lang,
      subject: '',
      chapter: '',
      lesson: ''
    };
    // Per-question board metadata
    let nextQuestionBoard = '';
    
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
      // Support both English and Bengali field names
      if ((line.startsWith('[') && line.endsWith(']')) || (line.includes('[') && line.includes(']'))) {
        const bracketMatch = line.match(/\[([^\]]+)\]/);
        if (bracketMatch) {
          const metaContent = bracketMatch[1];
          if (metaContent.includes(':')) {
            const colonIndex = metaContent.indexOf(':');
            const key = metaContent.substring(0, colonIndex).trim().toLowerCase();
            const value = metaContent.substring(colonIndex + 1).trim();
            
            // Map Bengali keys to English
            const keyMap = {
              'subject': 'subject',
              'বিষয়': 'subject',
              'chapter': 'chapter',
              'অধ্যায়': 'chapter',
              'lesson': 'lesson',
              'পাঠ': 'lesson',
              'board': 'board',
              'বোর্ড': 'board'
            };
            
            const mappedKey = keyMap[key];
            if (mappedKey) {
              if (mappedKey === 'board') {
                // Board metadata is per-question, not global
                // Store it for the next question that will be parsed
                nextQuestionBoard = value;
              } else {
                // Subject, chapter, lesson are global metadata
                // These apply to ALL questions in the batch
                globalMetadata[mappedKey] = value;
                console.log(`  ✅ Global metadata ${mappedKey}:`, value);
              }
            }
          }
        }
        continue;
      }
      
      // Parse questions - support both English (0-9) and Bengali (০-৯) numerals
      if (/^[\d০-৯]+[.)\s]/.test(line) || /^Q[\d০-৯]*[.)\s]/.test(line)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        
        let questionText = line;
        // Remove various question prefixes flexibly (handle Bengali numerals)
        questionText = questionText.replace(/^[\d০-৯]+[.)\s]*/, '');
        questionText = questionText.replace(/^Q[\d০-৯]*[.)\s]*/, '');
        questionText = questionText.replace(/^Question\s*[\d০-৯]*[.)\s]*/, '');
        
        currentQuestion = {
          ...globalMetadata,
          type: 'sq',
          question: questionText.trim(),
          answer: '',
          board: nextQuestionBoard  // Use the board set by previous [বোর্ড:] tag
        };
        // Reset the per-question board metadata after using it
        nextQuestionBoard = '';
        continue;
      }
      
      // Parse answer - more flexible (handle inline answers with উত্তর:)
      if (/^(answer|ans|উত্তর)\s*[:=]\s*/i.test(line) && currentQuestion) {
        const answerMatch = line.match(/^(?:answer|ans|উত্তর)\s*[:=]\s*(.+)$/i);
        if (answerMatch) {
          currentQuestion.answer = answerMatch[1].trim();
        } else {
          // Answer marker without text (answer on next line)
          currentQuestion.answer = '';
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
    
    setIsUploading(true);
    setProgress({ current: 0, total: 1, status: 'Parsing questions...' });
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
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
        
        setIsUploading(false);
        
        console.log('✅ Parsing complete! Found', parsed.length, 'questions');
        
        if (parsed.length === 0) {
          alert('❌ No questions could be parsed. Please check your format and see console logs for details.');
          return;
        }
        
        alert(`✅ Successfully parsed ${parsed.length} ${language === 'bn' ? 'Bangla' : 'English'} question(s)!\n\nClick OK to preview and confirm.`);
        
        setParsedQuestions(parsed);
        setShowPreview(true);
        
      } catch (error) {
        console.error('Error parsing questions:', error);
        setIsUploading(false);
        alert('Error parsing questions. Please check your format.');
      }
    }, 100);
  };
  
  const confirmAddQuestions = async (editedQuestions) => {
    setIsUploading(true);
    setProgress({ current: 0, total: editedQuestions.length, status: 'Uploading questions...' });
    
    // Add edited questions to the bank, tracking duplicates
    let addedCount = 0;
    let duplicateCount = 0;
    const duplicateQuestions = [];
    
    // Upload in batches of 20 for better performance
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < editedQuestions.length; i += BATCH_SIZE) {
      const batch = editedQuestions.slice(i, i + BATCH_SIZE);
      
      // Upload batch in parallel
      const results = await Promise.allSettled(
        batch.map((question, batchIndex) => 
          addQuestion(question)
            .then(() => ({ success: true, index: i + batchIndex, question }))
            .catch(error => ({ success: false, error, index: i + batchIndex, question }))
        )
      );
      
      // Process results
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          addedCount++;
        } else {
          const errorData = result.value || {};
          const error = errorData.error;
          const question = errorData.question;
          
          if (error && error.message && (error.message.includes('Duplicate') || error.message.includes('duplicate'))) {
            duplicateCount++;
            const questionPreview = (question?.questionText || question?.question || '').substring(0, 50);
            duplicateQuestions.push(`${errorData.index + 1}. ${questionPreview}...`);
          } else {
            console.error('Error adding question:', error);
          }
        }
      });
      
      // Update progress after each batch
      setProgress({ 
        current: Math.min(i + BATCH_SIZE, editedQuestions.length), 
        total: editedQuestions.length, 
        status: 'Uploading questions...' 
      });
    }
    
    setIsUploading(false);
    
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
  
  const translateText = async () => {
    if (!inputText.trim()) {
      alert('Please enter some text to translate.');
      return;
    }
    
    setIsTranslating(true);
    try {
      const translated = await translateEnglishWordsToBangla(inputText);
      setInputText(translated);
      alert('✅ Translation complete!');
    } catch (error) {
      console.error('Translation error:', error);
      alert('❌ Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
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
      
      {isUploading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '20px' }}>{progress.status}</h3>
            {progress.total > 0 && (
              <>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginBottom: '15px',
                  color: '#9b59b6'
                }}>
                  {progress.current} / {progress.total}
                </div>
                <div style={{
                  width: '100%',
                  height: '30px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '15px',
                  overflow: 'hidden',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    width: `${(progress.current / progress.total) * 100}%`,
                    height: '100%',
                    backgroundColor: '#9b59b6',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ color: '#666', fontSize: '14px' }}>
                  {Math.round((progress.current / progress.total) * 100)}% Complete
                </div>
              </>
            )}
            {progress.total === 0 && (
              <div style={{ fontSize: '16px', color: '#666' }}>
                Please wait...
              </div>
            )}
          </div>
        </div>
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
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {language === 'bn' && (
            <button 
              onClick={translateText} 
              disabled={isTranslating || !inputText.trim()}
              style={{ backgroundColor: '#28a745', color: 'white' }}
            >
              {isTranslating ? 'Translating...' : '🌐 Translate English → Bangla'}
            </button>
          )}
          <button onClick={parseQuestions}>Parse Questions</button>
          <button className="danger" onClick={clearInput}>Clear</button>
        </div>
        
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
