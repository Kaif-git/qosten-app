import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const q1 = `[ID: 1001]
[Subject: Higher Mathematics]
[Chapter: Algebraic Expression]
[Lesson: Polynomials]
[Board: DB-24; BIAM Laboratory School & College, Bogura; Test Exam-2024]
1. What is the leading co-efficient of the polynomial \\(p(x) = 12x^2 - 15x^3 - 3x^4 + 5 + 3x\\)?
a) \\(-3\\)
b) \\(3\\)
c) \\(12\\)
d) \\(15\\)
Correct: a
Explanation: To find the leading coefficient, we first need to identify the term with the highest power of \\(x\\). In the given polynomial \\(p(x) = 12x^2 - 15x^3 - 3x^4 + 5 + 3x\\), the highest power of \\(x\\) is \\(4\\). The term containing \\(x^4\\) is \\(-3x^4\\). The coefficient of this term is \\(-3\\), which is the leading coefficient.
---
`;

const q2 = `Question 2:
[ID: 1002]
[Subject: Higher Mathematics]
[Chapter: Algebraic Expression]
[Lesson: Partial Fractions]
[Board: DB-24; SQUARE High School & College, Pabna; Test Exam-2024]
2. If \\(\\frac{2y+1}{y(y-1)} = \\frac{A}{y} + \\frac{B}{y-1}\\), then what is the value of A?
a) \\(-1\\)
b) \\(1\\)
c) \\(2\\)
d) \\(3\\)
Correct: a
Explanation: We can find the value of A using the "cover-up" method or by equating the numerators. 
Multiplying the entire equation by the denominator \\(y(y-1)\\), we get:
\\(2y + 1 = A(y-1) + By\\)
To find A, we can substitute \\(y = 0\\) (the value that makes the denominator under A zero):
\\(2(0) + 1 = A(0-1) + B(0)\\)
\\(1 = -A\\)
Therefore, \\(A = -1\\). 
---
`;

let inputText = '';
for (let i = 0; i < 50; i++) {
    inputText += q1 + q2;
}

const parsed = parseMCQQuestions(inputText);
console.log('Input questions count (expected): 100');
console.log('Parsed questions count:', parsed.length);

if (parsed.length !== 100) {
    console.log('❌ Bug reproduced! Parsed count does not match expected count.');
    // Log some of the parsed questions to see what happened
    console.log('First 5 parsed questions:');
    console.log(JSON.stringify(parsed.slice(0, 5), null, 2));
} else {
    console.log('✅ Bug not reproduced with this input.');
}
