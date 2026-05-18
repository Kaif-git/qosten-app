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
  const blocks = content.split(/\[ID:/).filter(Boolean);
  
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    
    const idMatch = lines[0].match(/^(\d+)\]/);
    if (!idMatch) continue;
    
    const id = idMatch[1];
    const q = { id: parseInt(id), metadata: {}, questionText: '', answer: '' };
    
    for (const line of lines.slice(1)) {
      if (line.startsWith('[Subject:')) {
        q.metadata.subject = line.replace('[Subject:', '').replace(']', '').trim();
      } else if (line.startsWith('[Chapter:')) {
        q.metadata.chapter = line.replace('[Chapter:', '').replace(']', '').trim();
      } else if (line.startsWith('[Lesson:')) {
        q.metadata.lesson = line.replace('[Lesson:', '').replace(']', '').trim();
      } else if (line.startsWith('[Board:')) {
        q.metadata.board = line.replace('[Board:', '').replace(']', '').trim();
      } else if (line.toLowerCase() === 'question:') {
        // next lines are question text
      } else if (line.toLowerCase() === 'answer:') {
        // next lines are answer text
      } else if (q.questionText && !q.answer) {
        q.answer += (q.answer ? '\n' : '') + line;
      } else if (q.questionText) {
        q.answer += '\n' + line;
      } else {
        q.questionText = line;
      }
    }
    
    if (q.id && q.questionText) {
      questions.push(q);
    }
  }
  
  return questions;
}

async function fetchQuestionsByIds(ids) {
  if (ids.length === 0) return [];
  
  const response = await fetchWithRetry(`${API_BASE_URL}/questions?ids=${ids.join(',')}&limit=${ids.length}`);
  const data = await response.json();
  return Array.isArray(data) ? data : (data.data || []);
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
  return {
    id: q.id,
    question: q.questionText,
    answer: q.answer,
    subject: q.metadata.subject,
    chapter: q.metadata.chapter,
    lesson: q.metadata.lesson,
    board: q.metadata.board,
    type: 'CQ',
    is_verified: true
  };
}

function mapFromDatabase(dbQ) {
  return {
    id: dbQ.id,
    metadata: {
      subject: dbQ.subject,
      chapter: dbQ.chapter,
      lesson: dbQ.lesson,
      board: dbQ.board
    },
    questionText: dbQ.question || dbQ.question_text || '',
    answer: dbQ.answer || ''
  };
}

async function main() {
  const inputFile = process.argv[2] || 'batch_1_output.txt';
  const outputFile = process.argv[3] || 'replace_log.txt';
  
  console.log(`📖 Reading questions from: ${inputFile}`);
  
  const content = await fs.readFile(inputFile, 'utf-8');
  const fileQuestions = parseQuestionsFile(content);
  
  console.log(`📊 Found ${fileQuestions.length} questions in file`);
  
  const ids = fileQuestions.map(q => q.id);
  
  console.log(`📡 Fetching ${ids.length} questions from database...`);
  const dbQuestionsRaw = await fetchQuestionsByIds(ids);
  
  const dbQuestions = dbQuestionsRaw.map(mapFromDatabase);
  const dbMap = new Map(dbQuestions.map(q => [q.id, q]));
  
  console.log(`🔄 Processing updates...`);
  
  const results = {
    total: fileQuestions.length,
    success: 0,
    failed: 0,
    details: []
  };
  
  let logContent = `# Replacement Log - ${new Date().toISOString()}\n`;
  logContent += `# Input: ${inputFile}\n`;
  logContent += `# Total Questions: ${fileQuestions.length}\n\n`;
  logContent += '='.repeat(80) + '\n\n';
  
  for (const fileQ of fileQuestions) {
    const dbQ = dbMap.get(fileQ.id);
    
    logContent += `QUESTION ID: ${fileQ.id}\n`;
    logContent += '-'.repeat(40) + '\n';
    
    if (dbQ) {
      logContent += `BEFORE (Database):\n`;
      logContent += `  Subject: ${dbQ.metadata.subject}\n`;
      logContent += `  Chapter: ${dbQ.metadata.chapter}\n`;
      logContent += `  Question: ${dbQ.questionText.substring(0, 100)}${dbQ.questionText.length > 100 ? '...' : ''}\n`;
      logContent += `  Answer: ${dbQ.answer.substring(0, 100)}${dbQ.answer.length > 100 ? '...' : ''}\n\n`;
    } else {
      logContent += `BEFORE: Not found in database\n\n`;
    }
    
    logContent += `AFTER (File):\n`;
    logContent += `  Subject: ${fileQ.metadata.subject}\n`;
    logContent += `  Chapter: ${fileQ.metadata.chapter}\n`;
    logContent += `  Question: ${fileQ.questionText.substring(0, 100)}${fileQ.questionText.length > 100 ? '...' : ''}\n`;
    logContent += `  Answer: ${fileQ.answer.substring(0, 100)}${fileQ.answer.length > 100 ? '...' : ''}\n\n`;
    
    try {
      const dbUpdate = mapToDatabase(fileQ);
      await updateQuestion(fileQ.id, dbUpdate);
      
      console.log(`  ✓ Updated question ${fileQ.id}`);
      
      try {
        await verifyQuestion(fileQ.id);
        console.log(`  ✓ Verified question ${fileQ.id}`);
      } catch (verifyErr) {
        console.error(`  ⚠ Verify failed for ${fileQ.id}:`, verifyErr.message);
      }
      
      results.success++;
    } catch (err) {
      console.error(`  ✗ Failed to update ${fileQ.id}:`, err.message);
      logContent += `ERROR: ${err.message}\n`;
      results.failed++;
    }
    
    logContent += '\n' + '='.repeat(80) + '\n\n';
  }
  
  logContent += `\n# SUMMARY\n`;
  logContent += `# Total: ${results.total}\n`;
  logContent += `# Success: ${results.success}\n`;
  logContent += `# Failed: ${results.failed}\n`;
  
  await fs.writeFile(outputFile, logContent, 'utf-8');
  
  console.log(`\n✅ Complete!`);
  console.log(`📊 Success: ${results.success}, Failed: ${results.failed}`);
  console.log(`📝 Log saved to: ${outputFile}`);
}

main().catch(console.error);