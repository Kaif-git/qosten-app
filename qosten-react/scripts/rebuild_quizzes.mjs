import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://idgogbisqacywbfnhdzy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ29nYmlzcWFjeXdiZm5oZHp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzMjAxODMsImV4cCI6MjA2Nzg5NjE4M30.vPUQowhkQVLcQQziELxvLt3cz0QO8cBonxQwIYcjJHs';
const API = 'https://questions-api.edventure.workers.dev';
const SUBJECT = 'বাংলা প্রথম পত্র';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchAllByChapter(subject, chapter, type) {
  const all = [];
  let page = 0;
  while (true) {
    const params = new URLSearchParams({ subject, chapter, type, page: String(page), limit: '500', brief: 'true' });
    const res = await fetch(`${API}/questions?${params}`);
    const data = await res.json();
    const batch = Array.isArray(data) ? data : [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 500) break;
    page++;
  }
  return all;
}

async function getChapters() {
  const res = await fetch(`${API}/hierarchy`);
  const data = await res.json();
  const subjectData = data.find(s => s.name === SUBJECT);
  return subjectData ? subjectData.chapters : [];
}

async function main() {
  console.log(`Fetching chapters for ${SUBJECT}...`);
  const chapters = await getChapters();
  const chapterNames = chapters.map(c => c.name);
  console.log(`Found ${chapterNames.length} chapters`);

  // Step 1: Delete all existing quizzes + quiz_questions for this subject
  console.log('\nDeleting existing quizzes & lesson data for', SUBJECT, '...');
  
  // Get all quiz IDs
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id')
    .eq('subject', SUBJECT);
  
  if (quizzes && quizzes.length > 0) {
    const qIds = quizzes.map(q => q.id);
    console.log(`  Found ${qIds.length} quizzes, deleting quiz_questions...`);
    await supabase.from('quiz_questions').delete().in('quiz_id', qIds);
    console.log(`  Deleting quizzes...`);
    await supabase.from('quizzes').delete().in('id', qIds);
  }

  // Get all lesson IDs
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id')
    .eq('subject', SUBJECT);
  
  if (lessons && lessons.length > 0) {
    const lIds = lessons.map(l => l.id);
    console.log(`  Found ${lIds.length} lessons, deleting lesson_questions...`);
    await supabase.from('lesson_questions').delete().in('lesson_id', lIds);
    console.log(`  Deleting lessons...`);
    await supabase.from('lessons').delete().in('id', lIds);
  }

  console.log('\nCreating new quizzes & lessons...');

  const QUESTIONS_PER_QUIZ = 10;
  let totalQuizzes = 0;
  let totalLessons = 0;

  for (let ci = 0; ci < chapterNames.length; ci++) {
    const chapter = chapterNames[ci];
    console.log(`\n[${ci+1}/${chapterNames.length}] ${chapter}`);

    for (const type of ['mcq', 'cq', 'sq']) {
      const questions = await fetchAllByChapter(SUBJECT, chapter, type);
      if (questions.length === 0) { console.log(`  ${type}: 0 questions, skip`); continue; }

      // Shuffle to randomize quiz assignment
      const shuffled = questions.sort(() => Math.random() - 0.5);
      const numQuizzes = Math.ceil(shuffled.length / QUESTIONS_PER_QUIZ);

      if (type === 'mcq') {
        // Create lessons (MCQ uses lessons table)
        for (let qi = 0; qi < numQuizzes; qi++) {
          const chunk = shuffled.slice(qi * QUESTIONS_PER_QUIZ, (qi + 1) * QUESTIONS_PER_QUIZ);
          if (chunk.length === 0) continue;

          const { data: lesson, error } = await supabase
            .from('lessons')
            .insert({
              subject: SUBJECT,
              chapter,
              lesson_name: `${chapter} ${qi + 1}`,
              lesson_number: qi + 1,
              is_active: true,
            })
            .select()
            .single();

          if (!error && lesson) {
            const entries = chunk.map((q, i) => ({
              lesson_id: lesson.id,
              question_id: q.id.toString(),
              display_order: i + 1,
            }));
            await supabase.from('lesson_questions').insert(entries);
            totalLessons++;
          }
        }
        console.log(`  MCQ: ${shuffled.length} questions → ${numQuizzes} lessons (${QUESTIONS_PER_QUIZ}/lesson)`);
      } else {
        // Create quizzes (CQ/SQ uses quizzes table)
        for (let qi = 0; qi < numQuizzes; qi++) {
          const chunk = shuffled.slice(qi * QUESTIONS_PER_QUIZ, (qi + 1) * QUESTIONS_PER_QUIZ);
          if (chunk.length === 0) continue;

          const { data: quiz, error } = await supabase
            .from('quizzes')
            .insert({
              subject: SUBJECT,
              chapter,
              quiz_name: `${chapter} ${qi + 1}`,
              quiz_number: qi + 1,
              quiz_type: type,
              question_count: chunk.length,
              is_active: true,
            })
            .select()
            .single();

          if (!error && quiz) {
            const entries = chunk.map((q, i) => ({
              quiz_id: quiz.id,
              question_id: q.id.toString(),
              display_order: i + 1,
            }));
            await supabase.from('quiz_questions').insert(entries);
            totalQuizzes++;
          }
        }
        console.log(`  ${type.toUpperCase()}: ${shuffled.length} questions → ${numQuizzes} quizzes (${QUESTIONS_PER_QUIZ}/quiz)`);
      }
    }
  }

  console.log(`\n✅ Done! Created ${totalLessons} MCQ lessons + ${totalQuizzes} CQ/SQ quizzes`);
}

main().catch(err => console.error('❌ Fatal:', err));
