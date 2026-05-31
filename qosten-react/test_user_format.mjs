import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const inputText = `Question 23:
[ID: 1766559166526]
[Subject: Chemistry]
[Chapter: Concept of Mole and Chemical Counting]
[Lesson: Stoichiometric Coefficients]
[Board: N/A]
23. How many mole of O_2 is needed for the combustion of 1 mole ethane gas?
a) 7 moles
b) 2 moles
c) 5 moles
d) 3.5 moles
Correct: d
Explanation: 💡 Balance and calculate: (1) Combustion reaction: 2C₂H₆ + 7O₂ → 4CO₂ + 6H₂O. (2) From coefficients: 2 moles ethane need 7 moles O₂. (3) For 1 mole ethane: (7 moles O₂ ÷ 2 moles C₂H₆) × 1 mole C₂H₆ = 3.5 moles O₂. 🎯 Tip: Stoichiometric coefficients give mole-to-mole ratios – use them like conversion factors!`;

const parsed = parseMCQQuestions(inputText);
console.log('Parsed Count:', parsed.length);
if (parsed.length > 0) {
  console.log('Question 1 ID:', parsed[0].id);
  console.log('Question 1 Text:', parsed[0].questionText);
  console.log('Question 1 Options:', parsed[0].options.length);
  console.log('Question 1 Correct:', parsed[0].correctAnswer);
  console.log('Question 1 Explanation:', parsed[0].explanation ? 'Present' : 'Missing');
}
