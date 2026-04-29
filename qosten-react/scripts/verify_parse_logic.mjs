import fs from 'fs/promises';

async function verifyParse() {
  const filePath = 'E:/Qosten/qosten-react/Improved Questios/The_Democracy_of_Bangladesh_and_the_Election_System_CQ/batch_1_output.txt';
  const content = await fs.readFile(filePath, 'utf-8');
  
  const questions = [];
  const blocks = content.split(/(?=\[ID:)/).filter(Boolean);
  
  for (const block of blocks) {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();
    const idMatch = firstLine.match(/^\[ID:\s*(\d+)\]/);
    if (!idMatch) continue;
    
    const id = idMatch[1];
    const q = {
      id: parseInt(id),
      parts: [],
      fullAnswer: ''
    };
    
    let currentPart = null;
    let inAnswerSection = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      if (line.toLowerCase() === 'answer:') {
        inAnswerSection = true;
      } else if (line.match(/^[a-d]\)\s*.+\(\d+\)$/i)) {
        if (currentPart) q.parts.push(currentPart);
        const match = line.match(/^([a-d])\)\s*(.+?)\s*\((\d+)\)\s*$/i);
        currentPart = {
          answer: ''
        };
        inAnswerSection = false;
      } else if (currentPart && inAnswerSection) {
        currentPart.answer += (currentPart.answer ? '\n' : '') + line;
      } else if (inAnswerSection && !currentPart) {
        q.fullAnswer += (q.fullAnswer ? '\n' : '') + line;
      }
    }
    if (currentPart) q.parts.push(currentPart);
    const allAnswers = [q.fullAnswer, ...q.parts.map(p => p.answer)].filter(Boolean).join('\n\n');
    q.fullAnswer = allAnswers;
    questions.push(q);
  }
  
  const target = questions.find(q => q.id === 1776939557226);
  console.log('Full Answer for 1776939557226:', target?.fullAnswer);
}

verifyParse();
