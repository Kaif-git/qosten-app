import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';
const RESTORE_LIST_FILE = 'restore_list.txt';
const CONCURRENCY = 20; // Parallel requests per chunk

async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
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
      metadata: {}, 
      questionText: '', 
      parts: [], 
      type: 'sq', 
      answer: '', 
      explanation: '' 
    };
    
    let questionLines = [];
    let currentPart = null;
    let inAnswerSection = false;
    let inExplanationSection = false;
    
    for (const line of rawLines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
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
        inExplanationSection = false;
      } else if (trimmed.match(/^Correct:\s*([a-d])$/i)) {
        q.answer = trimmed.match(/^Correct:\s*([a-d])$/i)[1].toUpperCase();
        q.type = 'mcq';
        inAnswerSection = false;
      } else if (trimmed.toLowerCase().startsWith('explanation:')) {
        inAnswerSection = false;
        inExplanationSection = true;
        const expText = trimmed.replace(/^explanation:\s*/i, '');
        if (expText) q.explanation += (q.explanation ? '\n' : '') + expText;
      } else if (trimmed.match(/^[a-d]\)\s*.+\(\d+\)$/i)) {
        q.type = 'cq';
        if (currentPart) q.parts.push(currentPart);
        const match = trimmed.match(/^([a-d])\)\s*(.+?)\s*\((\d+)\)\s*$/i);
        currentPart = {
          label: match[1].toUpperCase(),
          letter: match[1].toUpperCase(),
          text: match[2].trim(),
          marks: parseInt(match[3]),
          answer: ''
        };
        inAnswerSection = false;
        inExplanationSection = false;
      } else if (trimmed.match(/^([a-d])\)\s*(.+)$/i)) {
        q.type = 'mcq';
        const match = trimmed.match(/^([a-d])\)\s*(.+)$/i);
        q.parts.push({
          label: match[1].toUpperCase(),
          letter: match[1].toUpperCase(),
          text: match[2].trim(),
          marks: 0,
          answer: ''
        });
      } else if (currentPart && inAnswerSection) {
        currentPart.answer += (currentPart.answer ? '\n' : '') + trimmed;
      } else if (currentPart) {
        // Append to part text if not in answer section
        currentPart.text += (currentPart.text ? '\n' : '') + trimmed;
      } else {
        if (inExplanationSection) {
          q.explanation += (q.explanation ? '\n' : '') + trimmed;
        } else if (!inAnswerSection) {
          questionLines.push(trimmed);
        } else {
          q.answer += (q.answer ? '\n' : '') + trimmed;
        }
      }
    }
    
    if (currentPart) q.parts.push(currentPart);
    if (questionLines.length > 0) {
      q.questionText = questionLines.join('\n').trim();
    }
    
    if (q.id && (q.questionText || q.parts.length > 0)) {
      questions.push(q);
    }
  }
  return questions;
}

function mapToDatabase(q) {
  const isMcq = q.type === 'mcq';
  const correctLetter = isMcq ? q.answer?.toLowerCase() : null;

  return {
    id: q.id,
    stem: q.questionText,
    question: q.questionText,
    answer: q.answer,
    correct_answer: correctLetter,
    explanation: q.explanation || null,
    subject: q.metadata.subject,
    chapter: q.metadata.chapter,
    lesson: q.metadata.lesson,
    board: q.metadata.board || '',
    type: (q.type || 'cq').toLowerCase(),
    options: isMcq ? JSON.stringify(q.parts.map(p => ({ 
      label: p.label.toLowerCase(), 
      text: p.text,
      is_correct: p.label.toLowerCase() === correctLetter
    }))) : '[]',
    parts: isMcq ? '[]' : JSON.stringify(q.parts || []),
    second_answer: q.answer || null, // Using answer as second_answer for CQs/SQs
    is_verified: true
  };
}

async function updateQuestion(id, question) {
  const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question)
  });
  return await response.json();
}

async function main() {
  console.log('🚀 Starting Fast Original Restoration...');
  
  try {
    const listContent = await fs.readFile(RESTORE_LIST_FILE, 'utf-8');
    const filesToProcess = listContent.split(/\r?\n/).filter(Boolean).map(p => p.trim());
    
    if (filesToProcess.length === 0) {
      console.log('No files left to process in restore_list.txt');
      return;
    }
    
    console.log(`Found ${filesToProcess.length} files to process.`);
    
    for (const filePath of filesToProcess) {
      console.log(`\n📄 Processing: ${filePath}`);
      
      const content = await fs.readFile(filePath, 'utf-8');
      const fileQuestions = parseQuestionsFile(content);
      
      console.log(`Found ${fileQuestions.length} questions in file.`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (let i = 0; i < fileQuestions.length; i += CONCURRENCY) {
        const chunk = fileQuestions.slice(i, i + CONCURRENCY);
        const promises = chunk.map(async (q) => {
          try {
            const dbUpdate = mapToDatabase(q);
            await updateQuestion(q.id, dbUpdate);
            return true;
          } catch (err) {
            console.error(`  ❌ Failed ID ${q.id}: ${err.message}`);
            return false;
          }
        });
        
        const results = await Promise.all(promises);
        successCount += results.filter(Boolean).length;
        failCount += results.filter(r => !r).length;
        
        process.stdout.write(`\r  Progress: ${Math.min(i + CONCURRENCY, fileQuestions.length)}/${fileQuestions.length} (${successCount} OK, ${failCount} Fail)`);
      }
      
      console.log(`\n✅ Completed ${filePath}: ${successCount} Success, ${failCount} Failed.`);
    }
    
    console.log('\n✨ All listed files have been processed!');
  } catch (err) {
    console.error('Fatal error:', err.message);
  }
}

main().catch(console.error);
