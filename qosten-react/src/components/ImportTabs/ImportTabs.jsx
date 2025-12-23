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
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    const sections = cleanedText.split(/\n---+\n/);
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
            if (/^[\d০-৯]+[।.]\s/.test(line)) {
                // Robust heuristic to distinguish "1. Question" from "1. Option"
                const isSmallNum = /^[1-4১-৪][।.]\s/.test(line);
                let isOption = false;

                if (currentQuestion) {
                    // 1. If Question is already "closed" (has answer/explanation), any number is a New Question
                    if (currentQuestion.correctAnswer || currentQuestion.explanation) {
                        isOption = false;
                        console.log(`    🚫 Line "${line.substring(0,15)}..." -> New Question (Previous closed)`);
                    }
                    // 2. Roman Context - "Which is correct?" always expects options
                    else if (currentQuestion.questionText && (
                             currentQuestion.questionText.includes('কোনটি সঠিক') || 
                             currentQuestion.questionText.includes('Which is correct') ||
                             currentQuestion.questionText.includes('নিচের কোনটি'))) {
                        if (isSmallNum) {
                            isOption = true;
                            console.log(`    ✅ Line "${line.substring(0,15)}..." -> Option (Roman Context)`);
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
                                console.log(`    ✅ Line "${line.substring(0,15)}..." -> Option ${numVal} (Sequential match)`);
                            } else {
                                console.log(`    🚫 Line "${line.substring(0,15)}..." -> New Question (Sequence mismatch: ${numVal} vs next ${currentQuestion.options.length + 1})`);
                            }
                        }
                    }
                }
                
                if (!isOption) {
                    saveCurrentQuestion();
                    currentQuestion = {
                        ...currentMetadata,
                        type: 'mcq',
                        questionText: line.replace(/^[\d০-৯]+[।.]\s*/, '').trim(),
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
                    let answer = answerMatch[1].trim().split(/\s+/)[0].toLowerCase();
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
  
  const parseCQQuestions = (text, lang = 'en') => {
    console.log('🔍 parseCQQuestions: Starting...');
    console.log('📄 Input length:', text.length);
    
    // Clean up the text: remove markdown bold ** but keep separator lines for splitting
    const cleanedText = text.replace(/\u200b/g, '').replace(/\*+/g, '');
    
    // Split by "সৃজনশীল প্রশ্ন", horizontal rule (---), or metadata blocks
    // Use lookahead to keep the header in each section
    let sections;
    
    // Robust splitting strategy:
    // Split at ANY valid start of a question block.
    // 1. [Subject: ...] or [Topic: ...] or [বিষয়: ...] or [বিষয়: ...] (Main Metadata start)
    // 2. সৃজনশীল প্রশ্ন X (Creative Question Header)
    // 3. প্রশ্ন X (Question X) at start of line
    // 4. --- (Horizontal Rule)
    
    const splitRegex = /(?=(?:\[(?:Subject|Topic|বিষয়|বিষয়)[^\]]*\]|সৃজনশীল\s+প্রশ্ন|^প্রশ্ন\s*[\d০-৯]+|^Question\s*\d+|\n---+\n))/im;
    
    // Check if we have multiple potential sections
    const matches = cleanedText.split(splitRegex);
    
    if (matches.length > 1) {
      sections = matches.filter(section => section.trim());
      console.log('📦 Sections found using combined splitter:', sections.length);
    } else {
      // Fallback to simple splitters if combined one fails or returns 1 block
      if (cleanedText.includes('---')) {
        sections = cleanedText.split(/\n---+\n/).filter(section => section.trim());
        console.log('📦 Sections found (split by ---):', sections.length);
      } else {
        // Just treat as one section
        sections = [cleanedText];
        console.log('📦 Treated as single section');
      }
    }
    
    const questions = [];
    let pendingMetadata = {}; // Persist metadata across sections to handle split headers
    
    for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
      const section = sections[sectionIdx];
      console.log(`\n📋 Processing section ${sectionIdx + 1}/${sections.length}`);
      
      // ... (existing parsing logic remains the same until the check at the end) ...
      
      // Split lines but preserve empty lines for proper formatting
      const allLines = section.split('\n');
      console.log(`📝 Raw lines in section: ${allLines.length}`);
      allLines.forEach((line, idx) => {
        if (idx < 10 || line === '') {
          console.log(`   Line ${idx}: "${line}" (empty: ${line.trim() === ''})`);
        }
      });
      
      // Keep empty lines but still trim whitespace from non-empty lines
      const lines = allLines.map((line) => {
        const trimmed = line.trim();
        return trimmed === '' ? '___EMPTY_LINE___' : trimmed;
      });
      
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
      let inStimulusSection = false; // For Bangla CQ format
      let inQuestionSection = false; // For Bangla CQ format
      let hasStartedParts = false; // Track if we've started parsing parts to lock stem
      let questionTextLines = [];
      let stimulusLines = []; // For Bangla stimulus
      let currentAnswerPart = null;
      let useBulletPointFormat = false; // Flag for bullet-point answer format
      
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle empty line markers - skip them but use them as markers for line break preservation
        if (line === '___EMPTY_LINE___') {
          console.log(`  🔲 Empty line detected. inAnswerSection: ${inAnswerSection}, hasCurrentAnswerPart: ${!!currentAnswerPart}`);
          // Only add newlines in answer section, not in question text
          if (inAnswerSection && currentAnswerPart) {
            // Preserve gaps in answers by marking with newline
            if (!currentAnswerPart.answer) {
              currentAnswerPart._hadGap = true;
            } else {
              console.log(`    → Adding newline to answer part ${currentAnswerPart.letter}`);
              currentAnswerPart.answer += '\n';
            }
          }
          // Don't add empty lines to question text - just skip them
          continue;
        }
        
        // Skip informational lines
        if (line.toLowerCase().includes('alternate') || line.toLowerCase().includes('also supported')) {
          continue;
        }
        
        // Parse metadata - handle both [Field: Value] format and unbracketed Field: Value format
        // Support both English and Bengali field names
        // Regex: Optional [, Key (English/Bangla), Colon, Value, Optional ]
        const metadataRegex = /^(?:\[)?(Subject|Topic|Chapter|Lesson|Board|বিষয়|বিষয়|অধ্যায়|পাঠ|বোর্ড)[:ঃ]\s*([^\]\n]*?)(?:\])?$/i;
        
        if (metadataRegex.test(line)) {
          const match = line.match(metadataRegex);
          if (match) {
            const key = match[1].trim().toLowerCase();
            const value = match[2].trim();
            // Map Bengali keys to English
            const keyMap = {
              'subject': 'subject', 'topic': 'subject', 'বিষয়': 'subject', 'বিষয়': 'subject',
              'chapter': 'chapter', 'অধ্যায়': 'chapter',
              'lesson': 'lesson', 'পাঠ': 'lesson',
              'board': 'board', 'বোর্ড': 'board'
            };
            const mappedKey = keyMap[key];
            if (mappedKey) {
              question[mappedKey] = value;
              console.log(`  ✅ Metadata ${mappedKey}:`, value);
            }
          }
          continue;
        }
        
        // Handle "বোর্ড: X" format (board metadata without brackets)
        if (/^(board|বোর্ড)\s*[:ঃ]/i.test(line)) {
          const boardMatch = line.match(/^(?:board|বোর্ড)\s*[:ঃ]\s*(.*)$/i);
          if (boardMatch) {
            question.board = boardMatch[1].trim();
            console.log(`  ✅ Metadata board:`, question.board);
          }
          continue;
        }
        
        // Handle Bangla stimulus section header (উদ্দীপক:)
        if (/^উদ্দীপক\s*:/i.test(line)) {
          inStimulusSection = true;
          inQuestionSection = false;
          inAnswerSection = false;
          stimulusLines = [];
          console.log(`  📖 Found stimulus section`);
          continue;
        }
        
        // Handle Bangla question section header (প্রশ্ন:)
        if (/^প্রশ্ন\s*:/i.test(line)) {
          if (stimulusLines.length > 0) {
            question.questionText = stimulusLines.join('\n').replace(/^>\s*/gm, '').trim();
            console.log(`  📝 Stimulus saved, length: ${question.questionText.length}`);
          }
          inStimulusSection = false;
          inQuestionSection = true;
          inAnswerSection = false;
          stimulusLines = [];
          questionTextLines = [];
          console.log(`  ❓ Found questions section`);
          continue;
        }
        
        // Handle Bangla answer section header (উত্তর:)
        if (/^উত্তর\s*:/i.test(line)) {
          inStimulusSection = false;
          inQuestionSection = false;
          inAnswerSection = true;
          console.log(`  ✅ Found answers section`);
          continue;
        }
        
        // Skip "Question X", "প্রশ্ন X", or "সৃজনশীল প্রশ্ন X" headers
        if (/^(Question|প্রশ্ন|Q\.?|সৃজনশীল\s+প্রশ্ন)\s*[\d०-९ে]*/i.test(line) && line.length < 50) {
          console.log(`  ⏭️  Skipping header: ${line}`);
          continue;
        }
        
        // Handle image indicators - only match if it looks like a placeholder, not part of a sentence
        const isImagePlaceholder = 
          (line.startsWith('[') && line.endsWith(']') && (line.toLowerCase().includes('picture') || line.toLowerCase().includes('image') || line.includes('ছবি') || line.includes('চিত্র'))) ||
          (line.toLowerCase() === 'picture' || line.toLowerCase() === 'image' || line === 'ছবি' || line === 'চিত্র');
        
        if (isImagePlaceholder) {
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
        
        // Handle stimulus section lines
        if (inStimulusSection) {
          if (line.startsWith('>')) {
            // Remove leading > and optional spaces
            stimulusLines.push(line.replace(/^>\s*/, '').trim());
          } else if (line) {
            stimulusLines.push(line);
          }
          continue;
        }
        
        if (!inAnswerSection) {
          // Parse question parts (a., b., c., d. or ক., খ., গ., ঘ.) - lowercase only
          // Allow optional spaces after dot/paren to handle both "a. text" and "a.text" formats
          const partMatch = line.match(/^([a-dক-ঘ])[.)]\s*(.+)$/);
          if (partMatch) {
            let partLetter = partMatch[1].toLowerCase();
            let partText = partMatch[2].trim();
            
            // Convert Bengali letters to English
            const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
            console.log(`    🔤 Part letter: '${partLetter}' (code: ${partLetter.charCodeAt(0)})`);
            if (bengaliToEnglish[partLetter]) {
              console.log(`    → Converting to English: ${bengaliToEnglish[partLetter]}`);
              partLetter = bengaliToEnglish[partLetter];
            }
            
            hasStartedParts = true; // Lock stem parsing
            
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
              if (!hasStartedParts) {
                  console.log(`    📋 Adding to question text: "${line.substring(0, 40)}..."`);
                  questionTextLines.push(line);
              } else {
                  console.log(`    ⏭️ Skipping line after parts started (protecting stem): "${line.substring(0, 40)}..."`);
              }
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
            // Must be lowercase letter followed by . or ) to avoid matching LaTeX like A = ...
            // Allow optional spaces after dot/paren to handle both "a. text" and "a.text" formats
            const answerMatch = line.match(/^([a-dক-ঘ])[.)]\s*(.+)$/);
            if (answerMatch) {
              let partLetter = answerMatch[1].toLowerCase();
              const answerText = answerMatch[2].trim();
              
              // Convert Bengali letters to English
              const bengaliToEnglish = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
              console.log(`    🔤 Answer letter: '${partLetter}' (code: ${partLetter.charCodeAt(0)})`);
              if (bengaliToEnglish[partLetter]) {
                console.log(`    → Converting to English: ${bengaliToEnglish[partLetter]}`);
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
              console.log(`  📝 Continuation line: "${line.substring(0, 50)}..."`);
              
              // First try to append to currentAnswerPart if it exists
              if (currentAnswerPart) {
                console.log(`    → Appending to current part (${currentAnswerPart.letter})`);
                const endsWithNewline = currentAnswerPart.answer && currentAnswerPart.answer.endsWith('\n');
                console.log(`       Current answer exists: ${!!currentAnswerPart.answer}, ends with newline: ${endsWithNewline}`);
                
                if (!currentAnswerPart.answer) {
                  // First content for this part
                  currentAnswerPart.answer = line;
                  console.log(`       Setting initial answer`);
                } else if (endsWithNewline) {
                  // Previous line was empty/gap, append directly on new line
                  currentAnswerPart.answer += line;
                  console.log(`       Appending after gap (no space)`);
                } else {
                  // Preserve line breaks - each line should be on its own line, not merged with space
                  currentAnswerPart.answer += '\n' + line;
                  console.log(`       Appending with newline`);
                }
              } else if (question.parts.length > 0 && !useBulletPointFormat) {
                // If no current answer part, append to the last part
                const lastPart = question.parts[question.parts.length - 1];
                if (lastPart) {
                  console.log(`    → Appending to last part (${lastPart.letter})`);
                  const endsWithNewline = lastPart.answer && lastPart.answer.endsWith('\n');
                  console.log(`       Current answer exists: ${!!lastPart.answer}, ends with newline: ${endsWithNewline}`);
                  
                  if (!lastPart.answer) {
                    lastPart.answer = line;
                    console.log(`       Setting initial answer`);
                  } else if (endsWithNewline) {
                    lastPart.answer += line;
                    console.log(`       Appending after gap (no space)`);
                  } else {
                    lastPart.answer += '\n' + line;
                    console.log(`       Appending with newline`);
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
      
      // Logic to handle metadata splitting and inheritance
      const hasContent = (question.questionText && question.questionText.trim()) || question.parts.length > 0;
      
      if (!hasContent) {
        // This section is likely just a header/metadata block
        // Update pendingMetadata to be used by the next question section
        if (question.subject) pendingMetadata.subject = question.subject;
        if (question.chapter) pendingMetadata.chapter = question.chapter;
        if (question.lesson) pendingMetadata.lesson = question.lesson;
        if (question.board) pendingMetadata.board = question.board;
        
        console.log('  📌 Metadata block stored for next section:', JSON.stringify(pendingMetadata));
      } else {
        // This section has content. Apply pending metadata if current is missing.
        if (!question.subject && pendingMetadata.subject) question.subject = pendingMetadata.subject;
        if (!question.chapter && pendingMetadata.chapter) question.chapter = pendingMetadata.chapter;
        if (!question.lesson && pendingMetadata.lesson) question.lesson = pendingMetadata.lesson;
        if (!question.board && pendingMetadata.board) question.board = pendingMetadata.board;
        
        // Update pending metadata with current question's metadata (inheritance for subsequent questions)
        if (question.subject) pendingMetadata.subject = question.subject;
        if (question.chapter) pendingMetadata.chapter = question.chapter;
        if (question.lesson) pendingMetadata.lesson = question.lesson;
        if (question.board) pendingMetadata.board = question.board;
        
        // Clean up empty parts
        question.parts = question.parts.filter(part => part.text.trim());
        
        // Save valid question
        if (question.parts.length > 0) {
          questions.push(question);
          console.log(`  💾 Question saved with ${question.parts.length} parts. Subject: ${question.subject}, Board: ${question.board}`);
          
          // Log final answers to verify line breaks
          question.parts.forEach(part => {
            console.log(`    Part ${part.letter} answer preview: "${part.answer.substring(0, 80).replace(/\n/g, '\\n')}..."`);
          });
        } else {
           console.log(`  ⚠️ Question has text but no parts - skipping.`);
        }
      }
    }
    
    console.log(`\n✅ Total CQ questions parsed: ${questions.length}`);
    return questions;
  };
  
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

                let text = line.replace(/^[\d০-৯]+[।.)\s]*/, '').trim();
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
    let message = `Successfully added ${addedCount} question(s)!`;
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
