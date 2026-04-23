import fs from 'fs/promises';

/**
 * Formats question objects back into the bracketed text format 
 * supported by the parsers.
 */

function formatMCQ(q) {
  const metadata = [
    `[ID: ${q.id}]`,
    `[Subject: ${q.subject}]`,
    `[Chapter: ${q.chapter}]`,
    q.lesson ? `[Lesson: ${q.lesson}]` : '',
    q.board ? `[Board: ${q.board}]` : ''
  ].filter(Boolean).join('\n');

  const options = (q.options || []).map(opt => `${opt.label}) ${opt.text}`).join('\n');
  
  return `${metadata}
${q.questionText || q.text || ''}
${options}
Correct: ${q.correctAnswer || q.correct_answer || ''}
Explanation:
${q.explanation || ''}
`;
}

function formatCQ(q) {
  const metadata = [
    `[ID: ${q.id}]`,
    `[Subject: ${q.subject}]`,
    `[Chapter: ${q.chapter}]`,
    q.lesson ? `[Lesson: ${q.lesson}]` : '',
    q.board ? `[Board: ${q.board}]` : ''
  ].filter(Boolean).join('\n');

  const parts = (q.parts || []).map(p => 
    `${p.letter}) ${p.text} (${p.marks})
Answer:
${p.answer || ''}`
  ).join('\n\n');

  return `${metadata}
Question:
${q.questionText || ''}

${parts}
`;
}

async function exportQuestions(filename, questions) {
  const content = questions.map(q => {
    const type = q.type ? q.type.toLowerCase() : '';
    if (type === 'mcq') return formatMCQ(q);
    return formatCQ(q);
  }).join('\n---\n\n');
  
  await fs.writeFile(filename, content);
}

export { exportQuestions };
