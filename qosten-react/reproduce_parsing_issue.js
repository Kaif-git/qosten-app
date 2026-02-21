const { parseLessonText } = require('./src/utils/lessonParser');

const text = `Subject: Islamic and Moral Studies\\
Chapter: Akhlaq 

**Topic: Akhlaq (Character)**
**Akhlaq** is the sum total of a person's natures, encompassing their **thoughts, ideas, mentality, and ways of work** which together define their character.

**Subtopic 1: Definition and Etymology of Akhlaq**
• **Definition:** **'Akhlaq'** is an Arabic word and the plural form of **'Khuluqun'**, literally meaning nature, conduct, or character.
• **Explanation:** In an etymological sense, it implies both **good and bad conduct**, though in common usage, it typically denotes only **good and excellent character**. It includes all the activities and principles of a human being.
• **Memorizing/Understanding shortcut:** Akhlaq = **"All Actions"** (The total of human activities and principles).
• **Common Misconceptions/Mistake:** Thinking it only refers to good behavior; technically, a 'characterless person' is also described using a form of this word because it etymologically covers both good and bad natures.
• **Difficulty:** Easy.

### Review Questions & Answers: Akhlaq (Character)

**Q1: What is the literal meaning of the Arabic word 'Khuluqun'?**
a) Religion
b) Law
c) Nature, conduct, or character
d) Knowledge
**Correct: c**
**Explanation:** 'Akhlaq' is the plural of 'Khuluqun', which literally means nature, conduct, or character.
`;

try {
    const chapters = parseLessonText(text);
    console.log(JSON.stringify(chapters, null, 2));
} catch (e) {
    console.error(e);
}
