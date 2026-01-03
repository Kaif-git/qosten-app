const { parseMCQQuestions } = require('./src/utils/mcqQuestionParser');

const testText = `**[Subject: Chemistry]**
**[Chapter: Mineral Resources: Fossils]**
**[Lesson: Polymers and Organic Compounds]**
**[Board: D.B.-23]**
**1.** What is the name of the polymer used in making toothbrushes?
1. Nylon
2. Polyethylene
3. Deraline
4. Polyvinyl Chloride
**Correct: 1**
**Explanation:** Nylon is commonly used for making bristles of toothbrushes.

**[Subject: Chemistry]**
**[Chapter: Mineral Resources: Fossils]**
**[Lesson: Organic Compounds - Formalin]**
**[Board: Sloshed Br Ulam Lt. Anwar Girls’ College, Dhaka]**
**2.** How much water present in formalin in percentage?
1. 40
2. 60
3. 50
4. 96
**Correct: 2**
**Explanation:** Formalin is the aqueous solution of formaldehyde. It has 40% methanol, so, water content (100–40) or 60%.`;

const results = parseMCQQuestions(testText);
console.log(JSON.stringify(results, null, 2));
