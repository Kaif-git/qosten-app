import fs from 'fs/promises';

const content = await fs.readFile('batch_1_output.txt', 'utf-8');

const questions = [];
const blocks = content.split(/(?=\[ID:)/).filter(Boolean);

for (const block of blocks) {
  const rawLines = block.split('\n');
  if (rawLines.length === 0) continue;
  
  const firstLine = rawLines[0].trim();
  const idMatch = firstLine.match(/^\[ID:\s*(\d+)\]/);
  if (!idMatch) continue;
  
  const id = idMatch[1];
  const q = { id: parseInt(id), metadata: {}, questionText: '', parts: [] };
  
  let questionLines = [];
  let currentPart = null;
  let inAnswerSection = false;
  
  for (const line of rawLines.slice(1)) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('[Subject:')) {
      q.metadata.subject = trimmed.replace('[Subject:', '').replace(']', '').trim();
    } else if (trimmed.startsWith('[Chapter:')) {
      q.metadata.chapter = trimmed.replace('[Chapter:', '').replace(']', '').trim();
    } else if (trimmed.startsWith('[Lesson:')) {
      q.metadata.lesson = trimmed.replace('[Lesson:', '').replace(']', '').trim();
    } else if (trimmed.startsWith('[Board:')) {
      q.metadata.board = trimmed.replace('[Board:', '').replace(']', '').trim();
    } else if (trimmed.toLowerCase() === 'question:') {
      // Skip
    } else if (trimmed.toLowerCase() === 'answer:') {
      inAnswerSection = true;
    } else if (trimmed.match(/^[a-d]\)\s*.+\(\d+\)$/i)) {
      if (currentPart) {
        q.parts.push(currentPart);
      }
      const match = trimmed.match(/^([a-d])\)\s*(.+?)\s*\((\d+)\)\s*$/i);
      currentPart = {
        label: match[1].toUpperCase(),
        letter: match[1].toUpperCase(),
        text: match[2].trim(),
        marks: parseInt(match[3]),
        answer: ''
      };
      inAnswerSection = false;
    } else if (currentPart && inAnswerSection) {
      currentPart.answer += (currentPart.answer ? '\n' : '') + trimmed;
    } else if (currentPart) {
      currentPart.answer += (currentPart.answer ? '\n' : '') + trimmed;
    } else {
      questionLines.push(trimmed);
    }
  }
  
  if (currentPart) {
    q.parts.push(currentPart);
  }
  if (questionLines.length > 0) {
    q.questionText = questionLines.join('\n').trim();
  }
  
  if (q.id && (q.questionText || q.parts.length > 0)) {
    questions.push(q);
  }
}

console.log('Parsed questions with parts:\n');

for (const q of questions) {
  console.log(`ID: ${q.id}`);
  console.log(`  Question: ${q.questionText.substring(0, 50)}... (${q.questionText.length} chars)`);
  console.log(`  Parts: ${q.parts.length}`);
  q.parts.forEach((p, i) => {
    console.log(`    [${i+1}] ${p.label} - "${p.text}" (${p.marks} marks) - ${p.answer.length} chars answer`);
  });
  console.log();
}