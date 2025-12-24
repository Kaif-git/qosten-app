
const { parseMCQQuestions } = require('./src/utils/mcqQuestionParser');

const input = `[Subject: Chemistry]
[Chapter: Concept of Mole and Chemical Counting]
[Lesson: Mole and Avogadro's Number]
[Board: SCHOLAISHOME, Sylhet]
15.What is the number of molecule found in 1 g CaCO_3?
a) 6.02 \times 10^{21}
b) 6.02 \times 10^{22}
c) 6.02 \times 10^{23}
d) 6.02 \times 10^{24}
Correct: a
Explanation: Molar mass of calcium carbonate is 100 g/mol which means 100 g calcium carbonate has 6.02 \times 10^{23} molecules (Avogadro number). Therefore, 1 g of calcium carbonate has 6.02 \times 10^{23} / 100 = 6.02 \times 10^{21} molecules.

[Subject: Chemistry]
[Chapter: Concept of Mole and Chemical Counting]
[Lesson: Atoms and Molecules in a Mole]
[Board: B.B.-24]
16.How many hydrogen atoms are present in 1 mole water?
a) 2
b) 18
c) 6.023 \times 10^{23}
d) 1.2046 \times 10^{24}
Correct: d
Explanation: 1 mole water has 6.023 \times 10^{23} molecules. 1 H_2O molecule has 2 H atoms. Therefore, 6.023 \times 10^{23} H_2O molecules have 2 \times 6.023 \times 10^{23} = 1.2046 \times 10^{24} H atoms.`;

console.log('--- Testing MCQ Parser ---');
const results = parseMCQQuestions(input);
console.log('Parsed Questions:', JSON.stringify(results, null, 2));

if (results.length === 2) {
    console.log('SUCCESS: Parsed 2 questions.');
} else {
    console.log(`FAILURE: Expected 2 questions, got ${results.length}`);
}
