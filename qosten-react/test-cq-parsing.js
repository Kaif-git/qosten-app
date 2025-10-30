const testCQInput = `**[Subject: Bangladesh and Global Studies]**
**[Chapter: The Independence of Bangladesh]**
**[Lesson: The Liberation War and Mujibnagar Government]**
**[Board: D.B. 2024]**
**Question 1**
Arifa's father was an artist at the Shawdhin Bangla Betar Kendra. The general people joined the Liberation War being inspired by his songs. On the other hand, her mother supplied food to the freedom fighters in the Liberation War Camp. Sometimes, she took care of the injured freedom fighters.
a. How the Liberation War was termed? (1)
b. Why was the Mujibnagar government formed in achieving independence? (2)
c. What was the role in the Liberation War of the media where Arifa's father worked for? (3)
d. To accelerate the achievement of Independence, the role of woman like Arifa's mother was significant. Show logics in the light of the text you read. (4)

**Answer:**
a. The Liberation War of Bangladesh is known as people's war or 'Ganojudha'.
b. The formation of the Mujibnagar government was highly important in achieving independence. The Mujibnagar government was formed on April 10, 1971 to guide the Liberation War by giving necessary directives and to create opinion in favour of the war. The Mujibnagar government divided the country into 11 sectors to guide the war.
c. Arifa's father worked for the mass media; and the role of mass media during the Liberation War was immense. Newspapers and Shawdhin Bangla Betar Kendra played an important role during the Liberation War. The artists and cultural activists of Chittagong Radio Station formed Shawdhin Bangla Betar Kendra on 26 March 1971. Shawdhin Bangla Betar Kendra broadcast news, patriotic songs, heroic tales of the freedom fighters, event of warfield etc. during the Liberation War. It also encouraged the freedom fighters and contributed a lot to the war, inspired and motivated people all over the country. Cultural activists like Arifa's father and the mass media thus played an important role during the war.
d. To accelerate the Liberation War, womenfolk like Arifa's mother contributed a lot. The role of women during the Liberation War was immense, especially the female students, spontaneously participated in the Sangram Parishad (The Action Committee) constituted in the beginning of March 1971 at every part of the country. They received training in handling firearms and guerrilla warfare in the camps alongside their male counterparts and then directly participated in the war. Besides, they would take care of the wounded freedom fighters, provide shelter to them and relay information about the Pakistani camps. Pakistani army and their cohorts tortured 3 lakhs women. They were fellow fighters too. The mentioned Arifa's mother supplied food to the camps of the freedom fighters and tended to them. So it can be said that, the role of women like Arifa's mother during the Liberation War was very significant in accelerating the achievement of independence.

---

**[Subject: Bangladesh and Global Studies]**
**[Chapter: The Independence of Bangladesh]**
**[Lesson: International Support and Mujibnagar Government]**
**[Board: D.B. 2024]**
**Question 2**
Freedom fighter Mr. Malek's son Rafi lives in a country of Europe. This country exercised it's power as a permanent member of the security council in favour of the liberation war of our country. He said in the function of Golden Jubilee of liberation, he took part in the war to the response of the call of a great leader. That call is accepted worldwide today.
a. In which city Maulana Bhashani was kept imprisoned? (1)
b. How was the internal administration of the Mujibnagar government? (2)
c. Explain which topic in your textbook is similar to Mr. Malek's statement. (3)
d. Evaluate the role of Rafi's country in the great Liberation War of Bangladesh. (4)

**Answer:**
a. Maulana Bhashani was kept imprisoned in Kolkata.
b. The internal administration of the Mujibnagar government was well-planned. The internal administration of the Mujibnagar government carried out the main responsibility of establishing an independent sovereign Bangladesh by advancing the struggle for independence of Bangladesh towards success. The Provisional Government carried out successful diplomatic activities in the outside world for the purpose of organizing support, cooperation, and public opinion for independent Bangladesh. All administrators including military and civil were conducted through the Mujibnagar government. As a result, the liberation war of Bangladesh achieved a successful outcome in a short period of time.
c. The historic 7th March 1971 speech is reflected by the stem. Bangabandhu's 7th March speech is one of the most significant historical speeches in the history of the world. Bangabandhu Sheikh Mujibur Rahman gave his speech on 7th March during an extreme political crisis. In this speech, he called for the independence of Bangladesh and urged the people to prepare for an armed liberation war. In his speech at the Racecourse ground (present Suhrawardi Uddyan), Bangabandhu highlighted the misrule and exploitation of the West Pakistani rulers, history of deprivation, and the struggle to hand over power after winning the elections. In this speech, Bengalis were given motivation and instructions to unite to break the barriers of deprivation. UNESCO recognized this speech by Bangabandhu Sheikh Mujibur Rahman as a documentary heritage in the Memory of the World Register' in 2017. In the 'A' section of the stimulus, some facts of an event such as Racecourse Ground 1971, describing the history of exploitation and deprivation of Bengalis, recognition as a world document, etc. are highlighted. The information in chart 'A' is similar to Bangabandhu's historic March 7th speech, so it can be said that Bangabandhu's March 7th speech is highlighted by chart 'A'.
d. The Soviet Union, the country where Rafi lived, played an important role in the great liberation war of Bangladesh. The former Soviet Union (current Russia) is a powerful country in Europe. The country is a permanent member of the United Nations Security Council. This country helped Bangladesh in many ways during the liberation war of 1971 including exercising veto power in the United Nations. In stimulus is told that Rafi lives in a European country. The country exercised power as a permanent member of the Security Council on behalf of our liberation war. This means that Rafi's country of residence is the then Soviet Union (current Russia). The Soviet Union (now Russia) played an important role in Bangladeshi's independence war. The then Soviet Union supported Bangladesh in the Great Liberation War of 1971. The Soviet head of state called on the President of Pakistan Yahia Khan to stop the massacre and torture in Bangladesh by the Pakistani army. US and China proposed a cease-fire in the Security Council when Pakistan was likely to lose the war. The Soviet Union vetoed the proposal. The country exercised veto power in the United Nations and did not allow any bill against the interests of Bangladesh to be passed in the Security Council. Besides, the Soviet Union campaigned for Bangladesh in international forums with India's active cooperation. Thus, the country worked for the independence of Bangladesh. From the above discussion, in stimulus it can be said that the activities of the Soviet Union, the country where Rafi lived, played a very effective role in winning the liberation war of Bangladesh.`;

// Fixed parser based on ImportTabs.jsx parseCQQuestions
function parseCQQuestions(text, lang = 'en') {
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
      
      // Skip "Question X" headers
      if (/^(Question|প্রশ্ন|Q\.?)\s*\d*/i.test(line) && line.length < 20) {
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
          
          // Extract marks - look for (1), (2), (3), (4) at the end
          const marksMatch = partText.match(/[(\[]\s*(\d+)\s*[)\]]\s*$/);  
          let marks = 0;
          if (marksMatch) {
            marks = parseInt(marksMatch[1]);
            partText = partText.replace(marksMatch[0], '').trim();
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
          if (!line.match(/^\[.*\]$/) && !line.match(/^[a-z]+\s*:/i)) {
            questionTextLines.push(line);
          }
        }
      } else {
        // In answer section - parse answers (a., b., c., d. or ক., খ., গ., ঘ.)
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
        } else {
          // Multi-line answer continuation
          if (currentAnswerPart && currentAnswerPart.answer) {
            currentAnswerPart.answer += ' ' + line;
          } else if (question.parts.length > 0) {
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
    
    if (!question.questionText && questionTextLines.length > 0) {
      question.questionText = questionTextLines.join('\n').trim();
    }
    
    // Only add question if it has meaningful content
    if (question.subject && ((question.questionText && question.questionText.trim()) || question.parts.length > 0)) {
      // Clean up empty parts
      question.parts = question.parts.filter(part => part.text.trim());
      questions.push(question);
      console.log(`  💾 Question saved with ${question.parts.length} parts`);
    } else {
      console.log(`  ⚠️ Question incomplete - not saved`);
    }
  }
  
  console.log(`\n✅ Total CQ questions parsed: ${questions.length}`);
  return questions;
}

console.log('🚀 Testing CQ Parser with provided example...\n');
const parsedQuestions = parseCQQuestions(testCQInput, 'en');

console.log('\n📊 RESULTS:');
console.log(`Total questions parsed: ${parsedQuestions.length}`);

parsedQuestions.forEach((q, idx) => {
  console.log(`\n--- Question ${idx + 1} ---`);
  console.log(`Subject: ${q.subject || 'NOT PARSED'}`);
  console.log(`Chapter: ${q.chapter || 'NOT PARSED'}`);
  console.log(`Lesson: ${q.lesson || 'NOT PARSED'}`);
  console.log(`Board: ${q.board || 'NOT PARSED'}`);
  console.log(`Stem length: ${q.questionText?.length || 0} chars`);
  console.log(`Parts: ${q.parts.length}`);
  q.parts.forEach(part => {
    console.log(`  ${part.letter}) ${part.text.substring(0, 50)}... (${part.marks} marks)`);
    console.log(`     Answer length: ${part.answer?.length || 0} chars`);
  });
});
