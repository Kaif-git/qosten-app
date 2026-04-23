import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

function parseQuestionsFile(content) {
  const questions = [];
  const blocks = content.split(/\[ID:/).filter(Boolean);
  
  for (const block of blocks) {
    const rawLines = block.split('\n');
    if (rawLines.length === 0) continue;
    
    const idMatch = rawLines[0].trim().match(/^(\d+)\]/);
    if (!idMatch) continue;
    
    const id = idMatch[1];
    const q = { id: parseInt(id), metadata: {}, questionText: '', answer: '' };
    
    let inQuestion = false;
    let inAnswer = false;
    let questionLines = [];
    let answerLines = [];
    
    for (const line of rawLines) {
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
        inQuestion = true;
        inAnswer = false;
      } else if (trimmed.toLowerCase() === 'answer:') {
        if (questionLines.length > 0) {
          q.questionText = questionLines.join('\n').trim();
        }
        inQuestion = false;
        inAnswer = true;
      } else if (inQuestion) {
        questionLines.push(trimmed);
      } else if (inAnswer) {
        answerLines.push(trimmed);
      }
    }
    
    if (questionLines.length > 0) {
      q.questionText = questionLines.join('\n').trim();
    }
    if (answerLines.length > 0) {
      q.answer = answerLines.join('\n').trim();
    }
    
    if (q.id && q.questionText) {
      questions.push(q);
    }
  }
  
  return questions;
}

async function main() {
  const content = await fs.readFile('batch_1_output.txt', 'utf-8');
  const questions = parseQuestionsFile(content);
  
  console.log('Parsed questions:\n');
  
  for (const q of questions) {
    console.log(`ID: ${q.id}`);
    console.log(`  Question: ${q.questionText.substring(0, 80)}... (${q.questionText.length} chars)`);
    console.log(`  Answer: ${q.answer.substring(0, 50)}... (${q.answer.length} chars)`);
    console.log();
  }
}

main().catch(console.error);