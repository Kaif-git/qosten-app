import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

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
        inAnswerSection = false; // Stop appending to answer for MCQs once Correct: is found
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
        // MCQ option
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
        currentPart.answer += (currentPart.answer ? '\n' : '') + trimmed;
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

async function updateQuestion(id, question) {
  const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(question)
  });
  return await response.json();
}

async function verifyQuestion(id) {
  const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}/verify`, {
    method: 'POST'
  });
  return await response.json();
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
    is_verified: true
  };
}

function mapFromDatabase(dbQ) {
  let parts = [];
  if (dbQ.parts) {
    try {
      parts = typeof dbQ.parts === 'string' ? JSON.parse(dbQ.parts) : dbQ.parts;
    } catch (e) {
      parts = [];
    }
  }
  
  return {
    id: dbQ.id,
    isVerified: !!(dbQ.is_verified || dbQ.verified),
    metadata: {
      subject: dbQ.subject || '',
      chapter: dbQ.chapter || '',
      lesson: dbQ.lesson || '',
      board: dbQ.board || '',
      type: dbQ.type || dbQ.question_type || ''
    },
    questionText: dbQ.question || dbQ.question_text || dbQ.stem || '',
    answer: dbQ.answer || '',
    parts: parts
  };
}

function formatForLog(q, label) {
  if (!q) return `${label}: (not found in database)\n`;
  
  let output = `${label}:\n`;
  output += `  ID: ${q.id}\n`;
  output += `  Verified: ${q.isVerified}\n`;
  output += `  Type: ${q.metadata?.type || 'CQ'}\n`;
  output += `  Subject: ${q.metadata?.subject || ''}\n`;
  output += `  Chapter: ${q.metadata?.chapter || ''}\n`;
  output += `  Lesson: ${q.metadata?.lesson || ''}\n`;
  output += `  Board: ${q.metadata?.board || ''}\n`;
  output += `  Question: ${q.questionText}\n`;
  output += `  Answer: ${q.answer}\n`;
  
  if (q.parts && q.parts.length > 0) {
    output += `\n  Parts:\n`;
    q.parts.forEach((p, idx) => {
      output += `    [${idx + 1}] Label: ${p.label}, Marks: ${p.marks}\n`;
      output += `        Text: ${p.text || '(none)'}\n`;
      output += `        Answer: ${p.answer || '(none)'}\n`;
    });
  }
  
  return output;
}

async function main() {
  const inputFile = process.argv[2] || 'batch_1_output.txt';
  
  // Log directory and filename logic
  const logDir = 'logs';
  await fs.mkdir(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = `${logDir}/replace_log_${timestamp}.txt`;
  
  console.log(`Reading questions from: ${inputFile}`);
  
  const content = await fs.readFile(inputFile, 'utf-8');
  const fileQuestions = parseQuestionsFile(content);
  
  console.log(`Found ${fileQuestions.length} questions in file`);
  console.log(`IDs: ${fileQuestions.map(q => q.id).join(', ')}`);
  
  const ids = fileQuestions.map(q => q.id);
  
  console.log(`Fetching ${ids.length} questions from database...`);
  const dbQuestions = [];
  
  const CONCURRENCY = 5;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (id) => {
      try {
        const response = await fetchWithRetry(`${API_BASE_URL}/questions/${id}`);
        if (response.ok) {
          const data = await response.json();
          return data;
        }
        console.log(`  Warning ID ${id}: response ${response.status}`);
        return null;
      } catch (err) {
        console.log(`  Warning ID ${id}: ${err.message}`);
        return null;
      }
    });
    const results = await Promise.all(promises);
    dbQuestions.push(...results.filter(Boolean));
  }
  
  console.log(`Retrieved ${dbQuestions.length} questions from database`);
  
  const dbQuestionsMapped = dbQuestions.map(mapFromDatabase);
  const dbMap = new Map(dbQuestionsMapped.map(q => [q.id, q]));
  
  console.log(`Processing updates...`);
  
  const resultsSummary = {
    total: fileQuestions.length,
    found: dbMap.size,
    success: 0,
    failed: 0
  };
  
  let logContent = `# REPLACEMENT LOG\n`;
  logContent += `# Date: ${new Date().toISOString()}\n`;
  logContent += `# Input File: ${inputFile}\n`;
  logContent += `# Output File: ${outputFile}\n`;
  logContent += `# Total Questions: ${fileQuestions.length}\n`;
  logContent += `# Found in DB: ${dbMap.size}\n`;
  logContent += '\n' + '='.repeat(80) + '\n\n';
  
  for (const fileQ of fileQuestions) {
    const dbQ = dbMap.get(fileQ.id);
    
    logContent += `QUESTION ID: ${fileQ.id}\n`;
    logContent += '-'.repeat(60) + '\n';
    
    logContent += formatForLog(dbQ, 'BEFORE (Database - Full)');
    logContent += '\n';
    
    logContent += formatForLog(fileQ, 'AFTER (File - Full)');
    logContent += '\n';
    
    try {
      const dbUpdate = mapToDatabase(fileQ);
      await updateQuestion(fileQ.id, dbUpdate);
      
      console.log(`  Updated question ${fileQ.id}`);
      
      // Only call verify if it wasn't already verified
      if (!dbQ || !dbQ.isVerified) {
        try {
          await verifyQuestion(fileQ.id);
          console.log(`  Verified question ${fileQ.id}`);
        } catch (verifyErr) {
          console.error(`  Verify failed for ${fileQ.id}:`, verifyErr.message);
        }
      } else {
        console.log(`  Question ${fileQ.id} already verified, skipping toggle.`);
      }
      
      resultsSummary.success++;
    } catch (err) {
      console.error(`  Failed to update ${fileQ.id}:`, err.message);
      logContent += `ERROR: ${err.message}\n`;
      resultsSummary.failed++;
    }
    
    logContent += '\n' + '='.repeat(60) + '\n\n';
  }
  
  logContent += `\n# SUMMARY\n`;
  logContent += `# Total Processed: ${resultsSummary.total}\n`;
  logContent += `# Found in DB: ${resultsSummary.found}\n`;
  logContent += `# Success: ${resultsSummary.success}\n`;
  logContent += `# Failed: ${resultsSummary.failed}\n`;
  
  await fs.writeFile(outputFile, logContent, 'utf-8');
  
  console.log(`\nComplete!`);
  console.log(`Found: ${resultsSummary.found}, Success: ${resultsSummary.success}, Failed: ${resultsSummary.failed}`);
  console.log(`Log saved to: ${outputFile}`);
}

main().catch(console.error);