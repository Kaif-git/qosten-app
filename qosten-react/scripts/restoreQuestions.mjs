import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const IMPROVED_QUESTIONS_DIR = 'E:/Qosten/qosten-react/Improved Questios';
const PROGRESS_FILE = 'E:/Qosten/qosten-react/scripts/restoration_progress.txt';
const BATCH_SIZE = 50;

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      const error = await response.text();
      console.error(`Attempt ${i + 1} failed: ${response.status} - ${error}`);
    } catch (err) {
      console.error(`Attempt ${i + 1} error:`, err.message);
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Failed after ${retries} attempts`);
}

function parseQuestionsFile(content) {
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
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      questionText: '',
      type: 'cq',
      parts: [],
      fullAnswer: ''
    };
    
    let currentPart = null;
    let inAnswerSection = false;
    let inQuestionSection = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      if (line.startsWith('[Subject:')) {
        q.subject = line.replace('[Subject:', '').replace(']', '').trim();
      } else if (line.startsWith('[Chapter:')) {
        q.chapter = line.replace('[Chapter:', '').replace(']', '').trim();
      } else if (line.startsWith('[Lesson:')) {
        q.lesson = line.replace('[Lesson:', '').replace(']', '').trim();
      } else if (line.startsWith('[Board:')) {
        q.board = line.replace('[Board:', '').replace(']', '').trim();
      } else if (line.toLowerCase() === 'question:') {
        inQuestionSection = true;
        inAnswerSection = false;
      } else if (line.toLowerCase() === 'answer:') {
        inAnswerSection = true;
        inQuestionSection = false;
      } else if (line.match(/^[a-d]\)\s*.+\(\d+\)$/i)) {
        if (currentPart) q.parts.push(currentPart);
        const match = line.match(/^([a-d])\)\s*(.+?)\s*\((\d+)\)\s*$/i);
        currentPart = {
          label: match[1].toUpperCase(),
          letter: match[1].toUpperCase(),
          text: match[2].trim(),
          marks: parseInt(match[3]),
          answer: ''
        };
        inQuestionSection = false;
        inAnswerSection = false;
      } else {
        if (inQuestionSection && !currentPart) {
          q.questionText += (q.questionText ? '\n' : '') + line;
        } else if (currentPart && inAnswerSection) {
          currentPart.answer += (currentPart.answer ? '\n' : '') + line;
        } else if (inAnswerSection && !currentPart) {
          q.fullAnswer += (q.fullAnswer ? '\n' : '') + line;
        } else if (currentPart) {
          currentPart.text += (currentPart.text ? '\n' : '') + line;
        }
      }
    }
    
    if (currentPart) q.parts.push(currentPart);
    const allAnswers = [q.fullAnswer, ...q.parts.map(p => p.answer)].filter(Boolean).join('\n\n');
    q.fullAnswer = allAnswers;
    questions.push(q);
  }
  
  return questions;
}

async function restoreQuestion(id, data) {
  const payload = {
    subject: data.subject,
    chapter: data.chapter,
    lesson: data.lesson,
    board: data.board,
    question: data.questionText,
    question_text: data.questionText,
    type: 'cq',
    parts: JSON.stringify(data.parts),
    answer: null, // Root answer is for SQ, CQs use parts and second_answer
    second_answer: data.secondaryAnswer || null,
    is_verified: true
  };

  const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

function isMathScience(subject, folderName) {
  const pattern = /(math|physics|chemistry|algebra|binomial|geometry|vector|probability|set|trigonometry|inequality|series|exponential|logarithmic|acid|base|chemical)/i;
  return pattern.test(subject) || pattern.test(folderName);
}

async function main() {
  console.log(`Scanning directory: ${IMPROVED_QUESTIONS_DIR}`);
  
  // Reset progress to ensure all are fixed with new logic
  try {
    await fs.unlink(PROGRESS_FILE);
    console.log('Progress file reset to ensure all questions are corrected.');
  } catch (e) {}

  const folders = await fs.readdir(IMPROVED_QUESTIONS_DIR, { withFileTypes: true });
  
  const targetFolders = folders
    .filter(f => f.isDirectory() && f.name.endsWith('_CQ'))
    .map(f => f.name);
    
  console.log(`Found ${targetFolders.length} CQ folders.`);
  
  for (const folderName of targetFolders) {
    console.log(`Processing folder: ${folderName}`);
    const folderPath = path.join(IMPROVED_QUESTIONS_DIR, folderName);
    const files = await fs.readdir(folderPath);
    
    const batchMap = {};
    const batchFiles = files.filter(f => f.startsWith('batch_') && f.endsWith('.txt'));
    
    for (const file of batchFiles) {
      const match = file.match(/^batch_(\d+)/);
      if (match) {
        const num = match[1];
        if (!batchMap[num]) batchMap[num] = {};
        if (file.includes('_output')) {
          batchMap[num].output = file;
        } else {
          batchMap[num].original = file;
        }
      }
    }
    
    for (const [num, files] of Object.entries(batchMap)) {
      console.log(`  Restoring batch ${num}...`);
      
      let originalQuestions = {};
      let secondaryQuestions = {};
      
      if (files.original) {
        const content = await fs.readFile(path.join(folderPath, files.original), 'utf-8');
        const parsed = parseQuestionsFile(content);
        parsed.forEach(q => { originalQuestions[q.id] = q; });
      }
      
      if (files.output) {
        const content = await fs.readFile(path.join(folderPath, files.output), 'utf-8');
        const parsed = parseQuestionsFile(content);
        parsed.forEach(q => { secondaryQuestions[q.id] = q; });
      }
      
      const allIdsArray = Array.from(new Set([...Object.keys(originalQuestions), ...Object.keys(secondaryQuestions)]));
      
      for (let i = 0; i < allIdsArray.length; i += BATCH_SIZE) {
        const chunk = allIdsArray.slice(i, i + BATCH_SIZE);
        const promises = chunk.map(async (idStr) => {
          const id = parseInt(idStr);

          const qOrig = originalQuestions[id];
          const qOut = secondaryQuestions[id];
          
          const data = qOrig || qOut;
          if (!data) return null;

          const isSci = isMathScience(data.subject, folderName);
          let finalParts = [];
          let secondaryAnswer = null;

          if (isSci) {
            // Math/Science: Output is Primary, no Secondary
            finalParts = qOut ? qOut.parts : (qOrig ? qOrig.parts : []);
            secondaryAnswer = null;
          } else {
            // Non-Math/Science: Original is Primary, Output is Secondary
            finalParts = qOrig ? qOrig.parts : (qOut ? qOut.parts : []);
            secondaryAnswer = qOut ? qOut.fullAnswer : null;
          }

          try {
            await restoreQuestion(id, {
              ...data,
              parts: finalParts,
              secondaryAnswer
            });
            await fs.appendFile(PROGRESS_FILE, `${id}\n`);
            return id;
          } catch (err) {
            console.error(`    Failed to restore ID ${id}: ${err.message}`);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const successful = results.filter(Boolean).length;
        console.log(`    Processed chunk ${i/BATCH_SIZE + 1}: ${successful}/${chunk.length} successful`);
      }
    }
  }
  console.log('Restoration complete!');
}

main().catch(console.error);
