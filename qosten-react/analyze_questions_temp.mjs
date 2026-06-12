import fs from 'fs';
const all = JSON.parse(fs.readFileSync('backup_questions_dwighata.json', 'utf8'));

console.log('Total questions:', all.length);

console.log('\n=== Language values ===');
const langs = {};
all.forEach(q => { langs[q.language] = (langs[q.language] || 0) + 1; });
console.log(langs);

console.log('\n=== Subject values ===');
const subjects = {};
all.forEach(q => { subjects[q.subject] = (subjects[q.subject] || 0) + 1; });
console.log(subjects);

console.log('\n=== Chapter values ===');
const chapters = {};
all.forEach(q => { chapters[q.chapter] = (chapters[q.chapter] || 0) + 1; });
console.log(chapters);

console.log('\n=== Lesson values ===');
const lessons = {};
all.forEach(q => { 
  const lesson = q.lesson || '(empty)';
  lessons[lesson] = (lessons[lesson] || 0) + 1; 
});
Object.entries(lessons).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log(k + ': ' + v));

console.log('\n=== Board values (sample 20) ===');
const boards = {};
all.forEach(q => { 
  const b = q.board || '(empty)';
  boards[b] = (boards[b] || 0) + 1; 
});
Object.entries(boards).sort((a,b) => b[1]-a[1]).slice(0,20).forEach(([k,v]) => console.log(k + ': ' + v));

console.log('\n=== Type values ===');
const types = {};
all.forEach(q => { types[q.type] = (types[q.type] || 0) + 1; });
console.log(types);

console.log('\n=== is_verified counts ===');
const verified = {};
all.forEach(q => { verified[q.is_verified] = (verified[q.is_verified] || 0) + 1; });
console.log(verified);

console.log('\n=== is_premium counts ===');
const premium = {};
all.forEach(q => { premium[q.is_premium] = (premium[q.is_premium] || 0) + 1; });
console.log(premium);

console.log('\n=== tags ===');
const withTags = all.filter(q => q.tags && q.tags.length > 0);
console.log('Questions with tags:', withTags.length);
if (withTags.length > 0) console.log('Sample tags:', JSON.stringify(withTags[0].tags));

console.log('\n=== Parts ===');
const withParts = all.filter(q => q.parts && q.parts.length > 0);
console.log('Questions with parts:', withParts.length);

// Show all full questions with their metadata
console.log('\n=== ALL QUESTIONS WITH METADATA ===');
all.forEach((q, i) => {
  console.log(`\n--- Question ${i+1} (id: ${q.id}) ---`);
  console.log('  type:', q.type);
  console.log('  subject:', q.subject);
  console.log('  chapter:', q.chapter);
  console.log('  lesson:', q.lesson);
  console.log('  board:', q.board);
  console.log('  language:', q.language);
  console.log('  question_text:', q.question_text);
  console.log('  options:', q.options);
  console.log('  correct_answer:', q.correct_answer);
  console.log('  explanation:', q.explanation ? q.explanation.substring(0, 200) : '(empty)');
  console.log('  is_premium:', q.is_premium);
  console.log('  is_verified:', q.is_verified);
  console.log('  answer:', q.answer);
  console.log('  image:', q.image);
});
