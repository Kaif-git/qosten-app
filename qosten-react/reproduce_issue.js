
import { parseMCQQuestions } from './src/utils/mcqQuestionParser.js';

const testInput = `**[Subject: Mathematics]**
**[Chapter: Solid Geometry]**
**[Lesson: Volume of Cylinder Containing Sphere]**
**[Board: Rajshahi Cantonment Public School & College, Rajshahi; Test Exam-2023]**
**55.** What is the volume of the cylinder?
  1) 16π
  2) 128π
  3) 32π
  4) 64π
**Correct:** 2
**Explanation:** Sphere radius = 4 cm, so cylinder radius = 4 cm and height = 8 cm (equals sphere diameter). Volume = πr²h = π × 16 × 8 = 128π cubic units.`;

const results = parseMCQQuestions(testInput);
console.log('Parsed Results:', JSON.stringify(results, null, 2));

if (results.length > 0) {
  console.log('Options Count:', results[0].options.length);
  results[0].options.forEach(opt => {
    console.log(`Label: ${opt.label}, Text: ${opt.text}`);
  });
} else {
  console.log('No questions parsed.');
}
