const { parseLessonText } = require('./src/utils/lessonParser');

const sampleInput = `Subject: Biology Chapter: Reproduction
Subject: Biology
Chapter: Transport in Organisms
### **Topic: Plant and Water Relationship**
Water is described as the "fluid of life," with protoplasm being 90% water [1]. It is essential for maintaining cell structure, transpiration, photosynthesis, and metabolic reactions [1].

**Subtopic 1: Imbibition**
*   **Definition:** The process by which dry or half-dry colloidal substances absorb liquid [1].
*   **Explanation:** Hydrophilic substances like cellulose, starch, and gelatin absorb water and swell up when they come into contact with it [1].
*   **Memorizing/Understanding shortcut:** Imbibition = "Imbibe" (to drink or soak up).
*   **Common Misconceptions/Mistake:** Thinking it only happens in living cells; dry wood can also undergo imbibition [1].
*   **Difficulty:** Easy.

**Subtopic 2: Diffusion**
*   **Definition:** A physical process through which molecules of a substance spread from a region of higher concentration to a region of lower concentration [2].
*   **Explanation:** It occurs under diffusion pressure, and the difference in pressure between a solution and a solvent is the "diffusion pressure deficit," which helps cells absorb water [2].
*   **Memorizing/Understanding shortcut:** Diffusion = "Distance" (smell or sugar spreading across a distance).
*   **Common Misconceptions/Mistake:** Assuming it requires energy; it is a passive physical process [1].
*   **Difficulty:** Easy.

---

### **Review Questions & Answers: Plant and Water Relationship**

**Q1: What makes water the "fluid of life" for plants?**
a) It provides colour to leaves
b) Protoplasm is about 90% water and it maintains cell structure, transpiration, photosynthesis, and metabolic reactions
c) It helps in seed dispersal
d) It makes the plant heavy
**Correct: b**
**Explanation:** As per the text, water is essential because protoplasm is 90% water and it is required for key processes like transpiration, photosynthesis, and metabolic reactions.

**Q2: Which of the following is an example of imbibition?**
a) Movement of water from soil into root hair
b) Swelling of dry seeds when placed in water
c) Spreading of ink in water
d) Evaporation of water from leaves
**Correct: b**
**Explanation:** Imbibition is the absorption of liquid by dry/half-dry colloidal substances. Swelling of dry seeds (containing starch/cellulose) upon contact with water is a classic example.
`;

try {
    const result = parseLessonText(sampleInput);
    console.log(JSON.stringify(result, null, 2));
} catch (e) {
    console.error(e);
}
