// Import parseMCQQuestions from ImportTabs logic
const parseMCQQuestions = (text, lang = 'en') => {
  console.log('🔍 parseMCQQuestions: Starting...');
  console.log('📄 Input length:', text.length);
  console.log('📄 First 100 chars:', text.substring(0, 100));
  
  // Clean up the text: remove markdown bold * and ** (both single and double asterisks)
  const cleanedText = text.replace(/\*+/g, '').replace(/---+/g, '');
  console.log('🧽 Cleaned text length:', cleanedText.length);
  
  const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line);
  console.log('📝 Total lines:', lines.length);
  lines.forEach((line, idx) => {
    console.log(`  Line ${idx}: ${line}`);
  });
  
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
    if (/^[\d०-९]+[.)\s]/.test(line) || /^Q[\d०-९]*[.)\s]/.test(line)) {
      if (currentQuestion) {
        // Clean up internal flags before saving
        delete currentQuestion._collectingExplanation;
        questions.push(currentQuestion);
      }
      
      let questionText = line;
      // Remove various question prefixes flexibly (handle Bengali numerals)
      questionText = questionText.replace(/^[\d०-९]+[.)\s]*/, '');
      questionText = questionText.replace(/^Q[\d०-९]*[.)\s]*/, '');
      questionText = questionText.replace(/^Question\s*[\d०-९]*[.)\s]*/, '');
      
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
    // Handle both "ব্যাখ্যা: text", "Bekkha:", and standalone "ব্যাখ্যা:" patterns
    if (/^(explanation|explain|exp|ব্যাখ্যা|bekkha)\s*[:=]\s*/i.test(line) && currentQuestion) {
      const explanationMatch = line.match(/^(?:explanation|explain|exp|ব্যাখ্যা|bekkha)\s*[:=]\s*(.*)$/i);
      if (explanationMatch) {
        const explanationText = explanationMatch[1].trim();
        if (explanationText) {
          console.log('  ✅ Found Explanation:', explanationText.substring(0, 50) + '...');
          currentQuestion.explanation = explanationText;
          currentQuestion._collectingExplanation = false;
        } else {
          // Explanation is on next lines, mark that we're collecting it
          console.log('  ✅ Found Explanation (multi-line)');
          currentQuestion._collectingExplanation = true;
        }
      }
      continue;
    }
    
    // Collect multi-line explanation text
    if (currentQuestion && currentQuestion._collectingExplanation && line && !line.includes('[')) {
      if (currentQuestion.explanation) {
        currentQuestion.explanation += ' ' + line;
      } else {
        currentQuestion.explanation = line;
      }
      console.log('  📝 Collecting explanation:', line.substring(0, 60));
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
    // Clean up internal flags before saving
    delete currentQuestion._collectingExplanation;
    questions.push(currentQuestion);
  }
  
  console.log(`\n✅ Total questions parsed: ${questions.length}`);
  return questions;
};

const testInput = `[বিষয়: পদার্থবিজ্ঞান]
[অধ্যায়:ভৌত রাশি ও তাদের পরিমাপ]
[পাঠ:পদার্থবিজ্ঞানের পরিচয়]
[বোর্ড:ঢাবি-२४; বরিশাল-२१]
१.কোয়ান্টাম তত্ত্ব ও আপেক্ষিকতার তত্ত্বের সমন্বয় করে কে প্রতিকণার অস্তিত্ব অনুমান করেন?
ক)ডিরাক
খ)রন্টজেন
গ)বেকেরেল
ঘ)মেরি কুরি
সঠিক:ক
ব্যাখ্যা:
ডিরাক কোয়ান্টাম তত্ত্ব ও আপেক্ষিকতার সমন্বয় করেপ্রতিদ্রব্য (antimatter), বিশেষ করে পজিট্রনের অস্তিত্ব অনুমান করেছিলেন।`;

console.log('Testing Bengali MCQ format...\n');
const questions = parseMCQQuestions(testInput);

console.log('\n\n=== PARSED QUESTIONS ===');
questions.forEach((q, idx) => {
  console.log(`\nQuestion ${idx + 1}:`);
  console.log('Subject:', q.subject);
  console.log('Chapter:', q.chapter);
  console.log('Lesson:', q.lesson);
  console.log('Board:', q.board);
  console.log('Question:', q.questionText);
  console.log('Options:');
  q.options.forEach(opt => {
    console.log(`  ${opt.label}) ${opt.text}`);
  });
  console.log('Correct Answer:', q.correctAnswer);
  console.log('Explanation:', q.explanation);
});
