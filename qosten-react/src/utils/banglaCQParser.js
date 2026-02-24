/**
 * Parser for Bangla Creative Questions (সৃজনশীল প্রশ্ন)
 * 
 * Supports the format:
 * সৃজনশীল প্রশ্ন ১
 * উদ্দীপক:
 * > [stimulus text lines starting with >]
 * 
 * প্রশ্ন:
 * a. [question text] (marks)
 * b. [question text] (marks)
 * ...
 * 
 * উত্তর:
 * a. [answer text]
 * b. [answer text]
 * ...
 */

export function parseBanglaCQQuestions(text) {
  if (!text || typeof text !== 'string') {
    console.log('❌ parseBanglaCQQuestions: Invalid input - text is', typeof text);
    return [];
  }

  console.log('🔍 parseBanglaCQQuestions: Starting parse...');
  console.log('📄 Input length:', text.length, 'characters');

  const questions = [];

  // Split by "সৃজনশীল প্রশ্ন" using lookahead to keep the number
  // Match "সৃজনশীল প্রশ্ন ১" pattern and split before it
  const questionBlocks = text.split(/(?=সৃজনশীল\s+প্রশ্ন\s+\d+)/i).filter(block => block.trim());
  console.log('📦 Creative question blocks found:', questionBlocks.length);

  for (let blockIdx = 0; blockIdx < questionBlocks.length; blockIdx++) {
    const block = questionBlocks[blockIdx];
    console.log(`\n📋 Processing creative question block ${blockIdx + 1}/${questionBlocks.length}`);

    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    console.log(`  📝 Lines in this block: ${lines.length}`);

    let currentQuestion = {
      type: 'cq', // Creative Question type
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      stimulus: '', // উদ্দীপক
      parts: [],
      language: 'bn'
    };

    let inStimulus = false;
    let stimulusBuffer = [];
    let inQuestions = false;
    let inAnswers = false;
    let questionBuffer = [];
    let answerBuffer = [];
    let currentPartLetter = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Parse metadata fields (Subject/বিষয়, Chapter/অধ্যায়, Lesson/পাঠ, Board/বোর্ড)
      if (line.match(/^(Subject|বিষয়):\s*(.+)$/i)) {
        const match = line.match(/^(Subject|বিষয়):\s*(.+)$/i);
        currentQuestion.subject = match[2].trim();
        console.log('  ✅ Found Subject:', currentQuestion.subject);
      } else if (line.match(/^(Chapter|অধ্যায়):\s*(.+)$/i)) {
        const match = line.match(/^(Chapter|অধ্যায়):\s*(.+)$/i);
        currentQuestion.chapter = match[2].trim();
        console.log('  ✅ Found Chapter:', currentQuestion.chapter);
      } else if (line.match(/^(Lesson|পাঠ):\s*(.+)$/i)) {
        const match = line.match(/^(Lesson|পাঠ):\s*(.+)$/i);
        currentQuestion.lesson = match[2].trim();
      } else if (line.match(/^(Board|বোর্ড):\s*(.+)$/i)) {
        const match = line.match(/^(Board|বোর্ড):\s*(.+)$/i);
        currentQuestion.board = match[2].trim();
      }
      // Parse stimulus section header (উদ্দীপক:)
      else if (line.match(/^উদ্দীপক\s*:\s*$/i)) {
        console.log('  ✅ Found stimulus section header');
        inStimulus = true;
        inQuestions = false;
        inAnswers = false;
        stimulusBuffer = [];
      }
      // Parse questions section header (প্রশ্ন:)
      else if (line.match(/^প্রশ্ন\s*:\s*$/i)) {
        console.log('  ✅ Found questions section header');
        if (stimulusBuffer.length > 0) {
          currentQuestion.stimulus = stimulusBuffer.join('\n').trim();
          console.log('  📝 Stimulus saved, length:', currentQuestion.stimulus.length);
        }
        inStimulus = false;
        inQuestions = true;
        inAnswers = false;
        stimulusBuffer = [];
      }
      // Parse answers section header (উত্তর:)
      else if (line.match(/^উত্তর\s*:\s*$/i)) {
        console.log('  ✅ Found answers section header');
        inStimulus = false;
        inQuestions = false;
        inAnswers = true;
      }
      // Parse stimulus lines (should start with >)
      else if (inStimulus) {
        if (line.startsWith('>')) {
          // Remove leading > and optional spaces
          stimulusBuffer.push(line.replace(/^>\s*/, '').trim());
        } else if (line) {
          // Continue stimulus even if no >
          stimulusBuffer.push(line);
        }
      }
      // Parse question lines (format: "a. question text (marks)")
      else if (inQuestions && line.match(/^[a-z]\.\s+.+/i)) {
        // Save previous question if exists
        const letter = currentPartLetter;
        if (letter && questionBuffer.length > 0) {
          const existingPart = currentQuestion.parts.find(p => p.letter === letter);
          if (existingPart) {
            existingPart.text = questionBuffer.join(' ').trim();
          }
        }

        const questionMatch = line.match(/^([a-z])\.\s+(.+?)\s*\((\d+)\)\s*$/i);
        if (questionMatch) {
          currentPartLetter = questionMatch[1].toLowerCase();
          const questionText = questionMatch[2].trim();
          const marks = parseInt(questionMatch[3]);

          console.log(`  ✅ Found question ${currentPartLetter}: marks=${marks}`);

          // Check if part already exists (from answers section)
          const targetLetter = currentPartLetter;
          let part = currentQuestion.parts.find(p => p.letter === targetLetter);
          if (!part) {
            part = {
              letter: currentPartLetter,
              text: questionText,
              marks: marks,
              answer: ''
            };
            currentQuestion.parts.push(part);
          } else {
            part.text = questionText;
            part.marks = marks;
          }

          questionBuffer = [];
        }
      }
      // Continue collecting question text if line doesn't start with letter.
      else if (inQuestions && questionBuffer.length > 0 && !line.match(/^[a-z]\./i)) {
        questionBuffer.push(line);
      }
      // Parse answer lines (format: "a. answer text")
      else if (inAnswers && line.match(/^[a-z]\.\s+/i)) {
        // Save previous answer if exists
        const letter = currentPartLetter;
        if (letter && answerBuffer.length > 0) {
          let part = currentQuestion.parts.find(p => p.letter === letter);
          if (!part) {
            part = {
              letter: letter,
              text: '',
              marks: 0,
              answer: ''
            };
            currentQuestion.parts.push(part);
          }
          part.answer = answerBuffer.join('\n').trim();
        }

        const answerMatch = line.match(/^([a-z])\.\s+(.+)/i);
        if (answerMatch) {
          currentPartLetter = answerMatch[1].toLowerCase();
          const targetLetter = currentPartLetter;
          let part = currentQuestion.parts.find(p => p.letter === targetLetter);
          if (!part) {
            part = {
              letter: currentPartLetter,
              text: '',
              marks: 0,
              answer: ''
            };
            currentQuestion.parts.push(part);
          }

          answerBuffer = [answerMatch[2].trim()];
          console.log(`  ✅ Found answer for ${currentPartLetter}`);
        }
      }
      // Continue collecting answer text
      else if (inAnswers && answerBuffer.length > 0 && !line.match(/^[a-z]\.\s/i)) {
        answerBuffer.push(line);
      }
    }

    // Save last answer
    if (currentPartLetter && answerBuffer.length > 0) {
      let part = currentQuestion.parts.find(p => p.letter === currentPartLetter);
      if (!part) {
        part = {
          letter: currentPartLetter,
          text: '',
          marks: 0,
          answer: ''
        };
        currentQuestion.parts.push(part);
      }
      part.answer = answerBuffer.join('\n').trim();
    }

    // Only add if we have valid data
    if (currentQuestion.stimulus && currentQuestion.parts.length > 0) {
      console.log(`  💾 Saving creative question with ${currentQuestion.parts.length} parts`);
      questions.push(currentQuestion);
    } else {
      console.log(`  ⚠️ Incomplete creative question - stimulus: ${!!currentQuestion.stimulus}, parts: ${currentQuestion.parts.length}`);
    }
  }

  console.log(`\n✅ Total creative questions parsed: ${questions.length}`);
  return questions;
}

/**
 * Validate a creative question object
 */
export function validateBanglaCQQuestion(question) {
  const errors = [];

  if (!question.stimulus) {
    errors.push('Stimulus (উদ্দীপক) is required');
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
    if (!part.marks || part.marks === 0) {
      errors.push(`Part ${part.letter}: Marks must be specified`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format example text for the Bangla CQ import interface
 */
export function getBanglaCQQuestionExample() {
  return `সৃজনশীল প্রশ্ন ১
উদ্দীপক:
> বাংলার মুখ আমি দেখিয়াছি, তাই আমি পৃথিবীর রূপ
> খুঁজিতে যাই না আর, অন্ধকারে জেগে উঠে ডুমুরের গাছে
> চেয়ে দেখি ছাতার মতন বড়ো পাতাটির নিচে বসে আছে
> ভোরের দোয়েল পাখি- চারদিকে চেয়ে দেখি পল্লবের ভূপ
> জাম-বট-কাঁঠালের-হিজলের-অশ্বত্থের করে আছে চুপ।

প্রশ্ন:
a. কবি কাদের মাঝে বাঁচতে চান? (1)
b. এ পৃথিবীতে কবি অমর আলয় রচনা করতে চান কেন? (2)
c. উদ্দীপকে প্রত্যাশিত বিষয়টি 'প্রাণ' কবিতার ভাবের সাথে কীভাবে মিশে আছে তা ব্যাখ্যা করো। (3)
d. 'উদ্দীপকটি 'প্রাণ' কবিতার আংশিকভাব মাত্র, পূর্ণরূপ নয়"- যুক্তিসহকারে বুঝিয়ে লেখো। (4)

উত্তর:
a. কবি মানবের মাঝে বেঁচে থাকতে চান।
b. স্বীয় কীর্তিতে মানবের মাঝে নিজেকে বাঁচিয়ে রাখার জন্য কবি এ পৃথিবীতে কাব্য-সংগীতের মাধ্যমে অমর আলয় রচনা করতে চান। তিনি জানেন নশ্বর পৃথিবীতে কেউই চিরস্থায়ী নয়; তবে গৌরবোজ্জ্বল কীর্তি রচনার মাধ্যমে মানুষের মনে দীর্ঘস্থায়ী অবস্থান তৈরি সম্ভব।
c. উদ্দীপকে প্রত্যাশিত বিষয়টি 'প্রাণ' কবিতার ভাবের সাথে সৌন্দর্য-চেতনার মাধ্যমে মিশে আছে।
* 'প্রাণ' কবিতায় কবির মর্ত্যপ্রীতি অত্যন্ত প্রাঞ্জল ভাষায় বর্ণিত হয়েছে।
d. উদ্দীপকটি 'প্রাণ' কবিতার আংশিকভাব মাত্র, পূর্ণরূপ নয়—এই মন্তব্যটি যথার্থ।
* উদ্দীপকে বাংলার প্রকৃতির প্রতি কবির পরিপূর্ণ মুগ্ধতা ও সৌন্দর্যচেতনা প্রকাশিত হয়েছে।`;
}
