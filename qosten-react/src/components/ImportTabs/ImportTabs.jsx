import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestions } from '../../context/QuestionContext';
import QuestionPreview from '../QuestionPreview/QuestionPreview';
import { translateEnglishWordsToBangla } from '../../utils/translateToBangla';
import { parseCQQuestions } from '../../utils/cqParser';

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
  const navigate = useNavigate();
  
  const example = examples[type][language];
  const title = titles[type][language];
  
  const parseMCQQuestions = (text, lang = 'en') => {
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = cleanedText.split(/\n---\+\n/);
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const lines = section.split('\n').map(line => line.trim()).filter(line => line);
        let currentQuestion = null;
        let currentMetadata = { language: lang };
        let inExplanation = false;

        const saveCurrentQuestion = () => {
            if (currentQuestion) {
                questions.push(currentQuestion);
                currentQuestion = null;
            }
        };

        for (const line of lines) {
            if (/^(Question\s+Set|প্রশ্ন\s*সেট)\s*[\d০-৯]+$/i.test(line)) continue;
            if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) continue;

            if (line.startsWith('[') && line.endsWith(']')) {
                const match = line.match(/\[([^:ঃ]+)[:ঃ]\s*([^\]]*)\]/);
                if (match) {
                    const key = match[1].trim().toLowerCase();
                    const value = match[2].trim();
                    const keyMap = {'subject': 'subject', 'বিষয়': 'subject', 'chapter': 'chapter', 'অধ্যায়': 'chapter', 'lesson': 'lesson', 'পাঠ': 'lesson', 'board': 'board', 'বোর্ড': 'board'};
                    if (keyMap[key]) currentMetadata[keyMap[key]] = value;
                }
                inExplanation = false;
                continue;
            }

            // Start of a new question (must have dot or danda, NOT paren to distinguish from numeric options)
            // Updated to allow optional space after dot/danda (e.g., "15.What")
            if (/^[\d০-৯]+[।.]/.test(line)) {
                // Robust heuristic to distinguish "1. Question" from "1. Option"
                // Updated to allow optional space
                const isSmallNum = /^[1-4১-৪][।.]/.test(line);
                let isOption = false;

                if (currentQuestion) {
                    // 1. If Question is already "closed" (has answer/explanation), any number is a New Question
                    if (currentQuestion.correctAnswer || currentQuestion.explanation) {
                        isOption = false;
                        console.log(`    🚫 Line "${line.substring(0,15)}"..." -> New Question (Previous closed)`);
                    }
                    // 2. Roman Context - "Which is correct?" always expects options
                    else if (currentQuestion.questionText && (
                             currentQuestion.questionText.includes('কোনটি সঠিক') || 
                             currentQuestion.questionText.includes('Which is correct') ||
                             currentQuestion.questionText.includes('নিচের কোনটি'))) {
                        if (isSmallNum) {
                            isOption = true;
                            console.log(`    ✅ Line "${line.substring(0,15)}"..." -> Option (Roman Context)`);
                        }
                    }
                    // 3. Sequential Option Check
                    // If we see "1." and have 0 options, it's Option 1.
                    // If we see "2." and have 1 option, it's Option 2.
                    // If we see "2." and have 4 options, it's New Question 2.
                    else if (isSmallNum) {
                        const numMatch = line.match(/^([1-4১-৪])[।.]/);
                        if (numMatch) {
                            const numStr = numMatch[1];
                            const bengaliMap = {'১':1, '২':2, '৩':3, '৪':4};
                            const numVal = bengaliMap[numStr] || parseInt(numStr);
                            
                            // It is an option ONLY if it follows the sequence (current options + 1)
                            // Allow strict sequential (1->2->3) or if it's 1 and we have none.
                            if (numVal === currentQuestion.options.length + 1) {
                                isOption = true;
                                console.log(`    ✅ Line "${line.substring(0,15)}"..." -> Option ${numVal} (Sequential match)`);
                            } else {
                                console.log(`    🚫 Line "${line.substring(0,15)}"..." -> New Question (Sequence mismatch: ${numVal} vs next ${currentQuestion.options.length + 1})`);
                            }
                        }
                    }
                }
                
                if (!isOption) {
                    saveCurrentQuestion();
                    currentQuestion = {
                        ...currentMetadata,
                        type: 'mcq',
                        // Handle potential lack of space after dot
                        questionText: line.replace(/^[\[\d০-৯]+[।.]\s*/, '').trim(),
                        options: [], correctAnswer: '', explanation: ''
                    };
                    console.log(`    🆕 New Question Started: ${line.substring(0, 20)}...`);
                    inExplanation = false;
                    continue;
                }
            }

            if (!currentQuestion) continue;

            // Updated regex to support Bengali numerals 1-4 (১-৪)
            if (/^(?:[a-dক-ঘ]|[1-4১-৪])[.)\s]/i.test(line)) {
                 const optionMatch = line.match(/^([a-dক-ঘ1-4১-৪])[.)\s]*(.+)$/i);
                 if (optionMatch) {
                    let letter = optionMatch[1].toLowerCase();
                    const text = optionMatch[2].trim();
                    const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                    const numToChar = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
                    const bengaliNumToChar = { '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
                    
                    if (bengaliToEnglish[letter]) letter = bengaliToEnglish[letter];
                    if (numToChar[letter]) letter = numToChar[letter];
                    if (bengaliNumToChar[letter]) letter = bengaliNumToChar[letter];
                    
                    currentQuestion.options.push({ label: letter, text: text });
                 }
                 inExplanation = false;
                 continue;
            }

            if (/^(correct|answer|ans|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]/i.test(line)) {
                const answerMatch = line.match(/^(?:correct|answer|ans|সঠিক(?:\s*উত্তর)?)\s*[:=ঃ：]\s*(.+)$/i);
                if (answerMatch) {
                    // Clean up answer: remove trailing paren if present (e.g. "a)" -> "a")
                    let answer = answerMatch[1].trim().split(/\s+/)[0].replace(/[).]+$/, '').toLowerCase();
                     const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
                     const numToChar = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
                     const bengaliNumToChar = { '১': 'a', '২': 'b', '৩': 'c', '৪': 'd' };
                     
                    if (bengaliToEnglish[answer]) answer = bengaliToEnglish[answer];
                    if (numToChar[answer]) answer = numToChar[answer];
                    if (bengaliNumToChar[answer]) answer = bengaliNumToChar[answer];
                    
                    currentQuestion.correctAnswer = answer;
                }
                inExplanation = false; // reset, in case explanation is on next line
                continue;
            }

            const explanationMarker = /^(explanation|explain|exp|bekkha|ব্যাখ্যা)\s*[:=ঃ：]/i;
            if (explanationMarker.test(line)) {
                currentQuestion.explanation = line.replace(explanationMarker, '').trim();
                inExplanation = true;
                if(!currentQuestion.explanation) { // text is on the next line
                  continue;
                }
                continue; // Processed explanation on this line
            }

            if (inExplanation) {
                currentQuestion.explanation += (currentQuestion.explanation ? '\n' : '') + line;
            } else if (currentQuestion.correctAnswer && !currentQuestion.explanation) {
                // If we have a correct answer, any subsequent text is likely explanation
                currentQuestion.explanation = (currentQuestion.explanation ? currentQuestion.explanation + '\n' : '') + line;
                inExplanation = true;
            } else if (currentQuestion.questionText && currentQuestion.options.length === 0) { // Continuation of question text (before options)
                 currentQuestion.questionText += '\n' + line;
            }
        }
        saveCurrentQuestion();
    }
    return questions;
};
  
  // parseCQQuestions has been moved to src/utils/cqParser.js
  
  const parseSQQuestions = (text, lang = 'en') => {
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = cleanedText.split(/\n---+|###/).filter(s => s.trim());
    const questions = [];

    for (const section of sections) {
        if (!section.trim()) continue;

        const allLines = section.split('\n');
        
        // 1. Extract metadata and clean up lines
        let sectionMetadata = { type: 'sq', language: lang };
        let cleanLines = [];
        
        // Robust metadata regex supporting both [Key: Value] and Key: Value formats
        const metadataRegex = /^(?:\[)?(Subject|Topic|Chapter|Lesson|Board|বিষয়|বিষয়|অধ্যায়|পাঠ|বোর্ড)[:ঃ]\s*([^\]\n]*?)(?:\])?$/i;
        
        for (const line of allLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            const metaMatch = trimmed.match(metadataRegex);
            if (metaMatch) {
                const key = metaMatch[1].toLowerCase();
                const value = metaMatch[2].trim();
                const keyMap = {
                    'subject': 'subject', 'topic': 'subject', 'বিষয়': 'subject', 'বিষয়': 'subject',
                    'chapter': 'chapter', 'অধ্যায়': 'chapter',
                    'lesson': 'lesson', 'পাঠ': 'lesson',
                    'board': 'board', 'বোর্ড': 'board'
                };
                if (keyMap[key]) sectionMetadata[keyMap[key]] = value;
            } else {
                cleanLines.push(trimmed);
            }
        }
        
        // 2. Look for Answer section separator
        let answerDividerIndex = -1;
        for (let i = 0; i < cleanLines.length; i++) {
            // Match "Answer:", "উত্তর:", "Ans:", etc.
            if (/^(answer|ans|উত্তর)\s*[:=ঃ]?\s*$/i.test(cleanLines[i])) {
                answerDividerIndex = i;
                break;
            }
        }
        
        if (answerDividerIndex !== -1) {
            const questionPool = cleanLines.slice(0, answerDividerIndex);
            const answerPool = cleanLines.slice(answerDividerIndex + 1);
            
            // 3. Check for grouped markers (a., b., ... or ক., খ., ...)
            const groupedMarkerRegex = /^([a-dক-ঘ])[.)]\s*/;
            const hasQuestionMarkers = questionPool.some(l => groupedMarkerRegex.test(l));
            const hasAnswerMarkers = answerPool.some(l => groupedMarkerRegex.test(l));
            
            if (hasQuestionMarkers && hasAnswerMarkers) {
                console.log("🔍 Grouped SQ format detected, splitting into individual questions...");
                
                // Parse Question Pool
                let subQuestions = [];
                let currentSub = null;
                for (const line of questionPool) {
                    const match = line.match(/^([a-dক-ঘ])[.)]\s*(.+)$/);
                    if (match) {
                        if (currentSub) subQuestions.push(currentSub);
                        currentSub = { label: match[1], question: match[2], answer: '' };
                    } else if (currentSub && !/^(Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)\s*[\d০-৯টে]*/i.test(line)) {
                        // Avoid adding "Question X" or metadata as part of question text
                        currentSub.question += '\n' + line;
                    }
                }
                if (currentSub) subQuestions.push(currentSub);
                
                // Parse Answer Pool
                let currentAnsLabel = null;
                let currentAnsText = [];
                for (const line of answerPool) {
                    const match = line.match(/^([a-dক-ঘ])[.)]\s*(.+)$/);
                    if (match) {
                        if (currentAnsLabel) {
                            const sub = subQuestions.find(s => s.label === currentAnsLabel);
                            if (sub) sub.answer = currentAnsText.join('\n').trim();
                        }
                        currentAnsLabel = match[1];
                        currentAnsText = [match[2]];
                    } else {
                        currentAnsText.push(line);
                    }
                }
                // Save last answer
                if (currentAnsLabel) {
                    const sub = subQuestions.find(s => s.label === currentAnsLabel);
                    if (sub) sub.answer = currentAnsText.join('\n').trim();
                }
                
                // Add to results
                for (const sub of subQuestions) {
                    if (sub.question && sub.answer) {
                        // Clean up marks from question text if present like (৩)
                        let qText = sub.question.trim();
                        qText = qText.replace(/\s*[(\[]\s*[\d০-৯]+\s*[)\]]\s*$/, '');
                        
                        questions.push({
                            ...sectionMetadata,
                            question: qText,
                            answer: sub.answer.trim()
                        });
                    }
                }
                continue; // Skip standard parser for this section
            }
        }

        // Standard format fallback (1. Question ... Answer: ...)
        let currentQuestion = null;
        const saveCurrentQuestion = () => {
            if (currentQuestion && currentQuestion.question) {
                questions.push(currentQuestion);
            }
            currentQuestion = null;
        };

        for (const line of cleanLines) {
            // Skip headers
            if (/^(Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)\s*[\d০-৯টে]*/i.test(line) && line.length < 20) continue;

            // Detect new question start (digit followed by separator)
            if (/^[\d০-৯]+[।.)\s]/.test(line)) {
                saveCurrentQuestion();
                currentQuestion = { ...sectionMetadata, question: '', answer: '' };

                let text = line.replace(/^[\[\d০-৯]+[।.)\s]*/, '').trim();
                const inlineAnswerMatch = text.match(/(answer|ans|উত্তর)\s*[:=]\s*(.*)/i);
                if (inlineAnswerMatch) {
                    currentQuestion.question = text.substring(0, inlineAnswerMatch.index).trim();
                    currentQuestion.answer = inlineAnswerMatch[2].trim();
                } else {
                    currentQuestion.question = text;
                }
                continue;
            }

            if (!currentQuestion) continue;

            // Detect answer marker
            const answerMatch = line.match(/^(?:answer|ans|উত্তর)\s*[:=ঃ]\s*(.+)$/i) || 
                                (line.match(/^(answer|ans|উত্তর)\s*[:=ঃ]?\s*$/i) ? [line, ""] : null);
            
            if (answerMatch) {
                if (answerMatch[1]) {
                    currentQuestion.answer = (currentQuestion.answer ? currentQuestion.answer + '\n' : '') + answerMatch[1].trim();
                }
                continue;
            }

            if (currentQuestion.answer) {
                currentQuestion.answer += '\n' + line;
            } else if (currentQuestion.question) {
                currentQuestion.question += '\n' + line;
            }
        }
        saveCurrentQuestion();
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
    
    let addedCount = 0;
    const addedIds = [];
    
    // Upload in batches of 20 for better performance
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < editedQuestions.length; i += BATCH_SIZE) {
      const batch = editedQuestions.slice(i, i + BATCH_SIZE);
      
      // Upload batch in parallel
      const results = await Promise.allSettled(
        batch.map((question, batchIndex) => 
          addQuestion(question)
            .then((newQ) => ({ success: true, index: i + batchIndex, question: newQ }))
            .catch(error => ({ success: false, error, index: i + batchIndex, question }))
        )
      );
      
      // Process results
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          addedCount++;
          if (result.value.question && result.value.question.id) {
              addedIds.push(result.value.question.id);
          }
        } else {
          const errorData = result.value || {};
          const error = errorData.error;
          console.error('Error adding question:', error);
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
    let message = `Successfully added ${addedCount} question(s)! Redirecting to review...`;
    alert(message);
    setShowPreview(false);
    
    // Clear the input after successful upload
    if (addedCount > 0) {
      setInputText('');
      setParsedQuestions([]);
      
      // Redirect to bank with the specific IDs
      navigate('/bank', { state: { highlightIds: addedIds } });
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