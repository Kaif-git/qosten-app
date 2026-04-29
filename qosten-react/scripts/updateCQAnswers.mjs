import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const IMPROVED_QUESTIONS_DIR = 'E:/Qosten/qosten-react/Improved Questios';

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
    const rawLines = block.split('\n');
    if (rawLines.length === 0) continue;
    
    const firstLine = rawLines[0].trim();
    const idMatch = firstLine.match(/^\[ID:\s*(\d+)\]/);
    if (!idMatch) continue;
    
    const id = idMatch[1];
    const q = { 
      id: parseInt(id), 
      parts: [], 
      answer: '' 
    };
    
    let currentPart = null;
    let inAnswerSection = false;
    
    for (const line of rawLines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.toLowerCase() === 'answer:') {
        inAnswerSection = true;
      } else if (trimmed.match(/^[a-d]\)\s*.+\(\d+\)$/i)) {
        if (currentPart) q.parts.push(currentPart);
        const match = trimmed.match(/^([a-d])\)\s*(.+?)\s*\((\d+)\)\s*$/i);
        currentPart = {
          label: match[1].toUpperCase(),
          answer: ''
        };
        inAnswerSection = false;
      } else if (currentPart && inAnswerSection) {
        currentPart.answer += (currentPart.answer ? '\n' : '') + trimmed;
      } else if (currentPart) {
        // If we are not in answer section, but we have a currentPart, we might be in the question text of that part.
        // But the user wants the answers.
      } else if (inAnswerSection) {
        q.answer += (q.answer ? '\n' : '') + trimmed;
      }
    }
    
    if (currentPart) q.parts.push(currentPart);
    
    // Combine all answers for this question into one string
    const allAnswers = [q.answer, ...q.parts.map(p => p.answer)].filter(Boolean).join('\n\n');
    questions.push({ id: q.id, fullAnswer: allAnswers });
  }
  
  return questions;
}

async function updateQuestionAnswers(id, originalAnswer, secondaryAnswer) {
  const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originalAnswer,
      secondaryAnswer
    })
  });
  return await response.json();
}

async function main() {
  console.log(`Scanning directory: ${IMPROVED_QUESTIONS_DIR}`);
  const folders = await fs.readdir(IMPROVED_QUESTIONS_DIR, { withFileTypes: true });
  
  const targetFolders = folders
    .filter(f => f.isDirectory() && f.name.endsWith('_CQ'))
    .filter(f => !/(higher\s*math|math|physics|chemistry)/i.test(f.name))
    .map(f => f.name);
    
  console.log(`Found ${targetFolders.length} relevant CQ folders.`);
  
  for (const folderName of targetFolders) {
    console.log(`Processing folder: ${folderName}`);
    const folderPath = path.join(IMPROVED_QUESTIONS_DIR, folderName);
    const files = await fs.readdir(folderPath);
    
    // Find batches
    const batches = [];
    const batchFiles = files.filter(f => f.startsWith('batch_') && f.endsWith('.txt'));
    
    // Group by batch number
    const batchMap = {};
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
      console.log(`  Processing batch ${num}...`);
      
      let originalAnswers = {};
      let secondaryAnswers = {};
      
      if (files.original) {
        const content = await fs.readFile(path.join(folderPath, files.original), 'utf-8');
        const parsed = parseQuestionsFile(content);
        parsed.forEach(q => { originalAnswers[q.id] = q.fullAnswer; });
      }
      
      if (files.output) {
        const content = await fs.readFile(path.join(folderPath, files.output), 'utf-8');
        const parsed = parseQuestionsFile(content);
        parsed.forEach(q => { secondaryAnswers[q.id] = q.fullAnswer; });
      }
      
      const allIds = new Set([...Object.keys(originalAnswers), ...Object.keys(secondaryAnswers)]);
      
      for (const id of allIds) {
        try {
          await updateQuestionAnswers(id, originalAnswers[id] || null, secondaryAnswers[id] || null);
          console.log(`    Updated ID ${id}`);
        } catch (err) {
          console.error(`    Failed to update ID ${id}: ${err.message}`);
        }
      }
    }
  }
  
  console.log('Done!');
}

main().catch(console.error);
