const mapDatabaseToApp = (q) => {
  if (!q) return null;
  
  const type = (q.type || 'mcq').toLowerCase();
  const questionText = q.question_text || q.questionText || q.text || q.question || '';

  const question = {
    id: q.id,
    type: type,
    questionText: questionText,
    parts: []
  };

  if (type === 'cq') {
    question.stem = q.stem || questionText;
    
    let rawParts = q.parts;
    if (typeof rawParts === 'string') {
        try { 
            rawParts = JSON.parse(rawParts); 
        } catch (e) { 
            rawParts = []; 
        }
    }
    
    question.parts = Array.isArray(rawParts)
      ? rawParts.map(part => ({
          letter: part.letter || part.label || '',
          text: part.text || '',
          answer: part.answer || ''
        }))
      : [];
  }

  return question;
};

const mockDbQ = {
  "id": 1768297236078,
  "type": "CQ",
  "question": "Mr. 'A' is an experienced member...",
  "parts": "[{\"label\":\"A\",\"letter\":\"A\",\"text\":\"What is the secretariat?\",\"marks\":1,\"answer\":\"Generally...\"}]"
};

const result = mapDatabaseToApp(mockDbQ);
console.log(JSON.stringify(result, null, 2));
