
const corruptedExamples = [
  "Question: (L.B.-24) MCQ:If x=1, then what is the value...?|a:1/3|b:1/2|c:3/2|d:2|Ans:b",
  "(L.B.-24) MCQ:If x=1...?|a:1/3|b:1/2|Ans:b",
  "Some random text that shouldn't match"
];

function fixCorruptedMCQ(text) {
  // Regex to match the pattern:
  // 1. Text part (optional "Question: " prefix, then content)
  // 2. Options part (starting with |a:)
  // 3. Answer part (starting with |Ans:)
  
  // Clean up prefix if present
  let cleanText = text.replace(/^Question:\s*/i, '');
  
  // Find where options start
  // We assume options start with |a: or |A:
  const optionsStartIndex = cleanText.search(/\|[a-d]:/i);
  
  if (optionsStartIndex === -1) return null; // Not a corrupted format we recognize
  
  const questionText = cleanText.substring(0, optionsStartIndex).trim();
  const remainder = cleanText.substring(optionsStartIndex);
  
  // Split remainder by |
  // expected structure: |a:val|b:val|c:val|d:val|Ans:val
  const parts = remainder.split('|').filter(p => p.trim());
  
  const options = [];
  let correctAnswer = null;
  
  parts.forEach(part => {
    const match = part.match(/^([a-d]):\s*(.*)/i);
    const ansMatch = part.match(/^Ans:\s*([a-d])/i);
    
    if (match) {
      options.push({
        label: match[1].toLowerCase(),
        text: match[2].trim()
      });
    } else if (ansMatch) {
      correctAnswer = ansMatch[1].toLowerCase();
    }
  });
  
  return {
    question: questionText,
    options,
    correctAnswer
  };
}

corruptedExamples.forEach(ex => {
  console.log("Original:", ex);
  console.log("Fixed:", JSON.stringify(fixCorruptedMCQ(ex), null, 2));
  console.log("-------------------");
});
