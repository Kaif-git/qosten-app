const path = require('path');
const fs = require('fs');
const { parseCQQuestions } = require('./src/utils/cqParser.js');

const file = 'D:\\OpenClawAutomations\\Gemma bangla Processing\\final\\Shuva\\Shuva_CQ_final.txt';
const txt = fs.readFileSync(file, 'utf-8');

const parsed = parseCQQuestions(txt, 'bn');
console.log('Total parsed:', parsed.length);

// Show which lack stems or answers
parsed.forEach((q, i) => {
  const hasStem = q.questionText && q.questionText.trim().length > 0;
  const hasAnswers = q.parts.every(p => p.answer && p.answer.trim().length > 0);
  const emptyParts = q.parts.filter(p => !p.answer || !p.answer.trim()).map(p => p.letter);
  const flag = !hasStem ? 'NO_STEM' : !hasAnswers ? `NO_ANS: ${emptyParts.join(',')}` : '';
  if (flag) {
    console.log(`Q${i+1} [${q.board}]: ${flag} stem="${(q.questionText||'').substring(0,40)}"`);
  }
});
