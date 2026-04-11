/**
 * Utility to format MCQ question objects back into the bracketed text format
 * supported by the MCQ parser.
 */

export function formatMCQToBracketedText(question) {
  if (!question) return '';

  const metadata = [];
  if (question.id) metadata.push(`[ID: ${question.id}]`);
  if (question.subject) metadata.push(`[Subject: ${question.subject}]`);
  if (question.chapter) metadata.push(`[Chapter: ${question.chapter}]`);
  if (question.lesson) metadata.push(`[Lesson: ${question.lesson}]`);
  if (question.board) metadata.push(`[Board: ${question.board}]`);

  const options = (question.options || []).map(opt => {
    const label = opt.label || '';
    const text = opt.text || '';
    // Handle Bengali labels if necessary, but standard parser handles a,b,c,d
    return `${label}) ${text}`;
  }).join('\n');

  let correctAnswer = question.correctAnswer || '';
  // Find the option text for the correct answer if possible, 
  // though the parser also supports labels.
  const correctOpt = (question.options || []).find(opt => opt.label === correctAnswer);
  if (correctOpt) {
    // If it's a very short label, keep it. If it's the text, use text.
    // The parser is robust.
  }

  const explanation = question.explanation || '';

  return `${metadata.join('\n')}
${question.questionText || question.text || ''}
${options}
Correct: ${correctAnswer}
Explanation:
${explanation}
`;
}

export function formatMultipleMCQs(questions) {
  return questions.map(formatMCQToBracketedText).join('\n---\n\n');
}
