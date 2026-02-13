import { parseLessonText } from './src/utils/lessonParser.js';

const text = "Subject: Biotechnology\nChapter: Biotechnology and Tissue Culture\n\n**Topic: Biotechnology**\nThe sources define biotechnology as the interrelation between biology and technology.\n\n**Topic: Tissue Culture**\nThe sources describe tissue culture as the process of separating a tissue from a plant.\n\n*   **Subtopic 1: The Principle of Totipotency**\n    *   **Definition:** The inherent capacity of a plant cell to grow into exactly the same type of plant from any part.\n    *   **Explanation:** Because plants possess \"totipotent stem\" cells in different parts.\n    *   **Memorizing/Understanding shortcut:** Totipotency = \"Total Potential\".\n    *   **Common Misconceptions/Mistake:** Assuming only seeds can grow.\n    *   **Difficulty:** Medium.\n*   **Subtopic 2: Explants**\n    *   **Definition:** The specific part of a plant that is separated.\n    *   **Explanation:** Explants are placed in a nourishing medium.\n    *   **Memorizing/Understanding shortcut:** Explant = \"Ex-plant\".\n    *   **Common Misconceptions/Mistake:** Thinking any plant piece is an explant.\n    *   **Difficulty:** Easy.\n\n---\n\n### **Review Questions & Answers: Biotechnology & Tissue Culture**\n\n**Q1: What is the fundamental principle?**\na) Photosynthesis\nb) Totipotency\n**Correct: b**\n**Explanation:** Totipotency is the inherent potential.\n";

const result = parseLessonText(text);

result.forEach(chapter => {
    console.log("Chapter: " + chapter.chapter);
    chapter.topics.forEach(topic => {
        console.log("  Topic: " + topic.title);
        console.log("    Subtopics: " + topic.subtopics.length);
        topic.subtopics.forEach(s => console.log("      - " + s.title));
    });
});
