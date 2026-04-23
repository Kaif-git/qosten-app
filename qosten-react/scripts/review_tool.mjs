import fetch from 'node-fetch';
import readline from 'readline';
import fs from 'fs/promises';
import { exportQuestions } from './exportFormatter.mjs';

const API_BASE_URL = 'https://questions-api.edventure.workers.dev';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function getHierarchy() {
  const response = await fetch(`${API_BASE_URL}/hierarchy`);
  return await response.json();
}

async function getQuestions(params = {}) {
  let allQuestions = [];
  let page = 0;
  const limit = 500;
  
  while (true) {
    const searchParams = new URLSearchParams({ ...params, page, limit });
    const response = await fetch(`${API_BASE_URL}/questions?${searchParams.toString()}`);
    const data = await response.json();
    const batch = Array.isArray(data) ? data : (data.data || []);
    
    if (batch.length === 0) break;
    allQuestions.push(...batch);
    if (batch.length < limit) break;
    page++;
  }
  return allQuestions;
}

async function main() {
  console.log('📡 Fetching data...');
  const subjects = await getHierarchy();
  
  // Display Subjects
  console.log('\n📚 Subjects:');
  subjects.forEach((s, idx) => console.log(`${idx + 1}. ${s.name}`));
  
  rl.question('\nSelect a subject number: ', (subIdx) => {
    const subject = subjects[parseInt(subIdx) - 1];
    
    console.log(`\n📚 Chapters in ${subject.name}:`);
    subject.chapters.forEach((ch, idx) => console.log(`${idx + 1}. ${ch.name}`));
    
    rl.question('\nSelect a chapter number: ', async (chIdx) => {
        const chapter = subject.chapters[parseInt(chIdx) - 1];
        
        console.log(`\n🔍 Fetching details for ${chapter.name}...`);
        const questions = await getQuestions({ subject: subject.name, chapter: chapter.name });
        
        const types = ['MCQ', 'CQ', 'SQ'];
        console.log(`\n📊 Stats for ${chapter.name}:`);
        
        types.forEach(type => {
            const filtered = questions.filter(q => q.type && q.type.toLowerCase() === type.toLowerCase());
            const verified = filtered.filter(q => q.is_verified || q.verified).length;
            console.log(`- ${type}: Total=${filtered.length}, Verified=${verified}, Unverified=${filtered.length - verified}`);
        });

        rl.question('\nEnter type to export to txt (or press enter to exit): ', async (type) => {
            if (!type) process.exit();
            
            const filtered = questions.filter(q => q.type && q.type.toLowerCase() === type.toLowerCase());
            if (filtered.length === 0) {
                console.log(`No questions found for type ${type}`);
                process.exit();
            }
            const filename = `${chapter.name.replace(/\s+/g, '_')}_${type.toUpperCase()}.txt`;
            await exportQuestions(filename, filtered);
            console.log(`\n✅ Saved ${filtered.length} questions to ${filename}`);
            process.exit();
        });
    });
  });
}

main().catch(console.error);
