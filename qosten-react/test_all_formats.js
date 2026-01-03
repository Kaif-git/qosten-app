const { parseMCQQuestions } = require('./src/utils/mcqQuestionParser');

const testText = `**[Subject: Chemistry]**
**[Chapter: Mineral Resources: Fossils]**
**1.** What is the polymer for toothbrushes?
1. Nylon
2. Polyethylene
3. Deraline
4. Polyvinyl Chloride
**Correct: 1**
**Explanation:** Nylon bristles.

---

**[Subject: Math]**
**[Chapter: Algebra]**
**2.** Solve for x: x+1=2
a) 1
b) 2
c) 3
d) 4
**Correct: a**
**Explanation:** 2-1=1

---

*[বিষয়: রসায়ন]*
*[অধ্যায়: খনিজ সম্পদ]*
*৩.* নিচের কোনটি পলিমার?
ক) নাইলন
খ) ইথিলিন
গ) মিথেন
ঘ) বেনজিন
**সঠিক: ক**
**ব্যাখ্যা:** নাইলন একটি কৃত্রিম পলিমার।`;

const results = parseMCQQuestions(testText);
console.log('Total parsed:', results.length);
console.log(JSON.stringify(results, null, 2));
