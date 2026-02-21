const fs = require('fs');

// Mocking some parts of the parser for the reproduction script if needed, 
// but we'll try to use the actual file.
const parserFile = fs.readFileSync('./src/utils/lessonParser.js', 'utf8');

// We need to export the function if it's not already
const evalText = parserFile.replace('export function parseLessonText', 'function parseLessonText');
eval(evalText + '\nmodule.exports = { parseLessonText };');

const { parseLessonText } = module.exports;

const text = `### **Topic: Role of Hormones in Human Reproduction**
Hormones act as essential chemical messengers that regulate the development, maintenance, and functional processes of the human reproductive system [1, 2].

---

#### **Subtopic 1: Role of Hormones in Human Reproduction**
*   **Definition:** Hormones are organic substances secreted from **ductless (endocrine) glands** that are transported through the blood to control metabolic and physiological processes [1, 2].
*   **Explanation:** These substances are secreted in very small amounts, yet they are crucial; if the secretion is too much or too little, it hampers bodily activities and causes abnormalities [2]. Specifically, the **thyroid gland** secretes thyroxine to ensure sexual development, while **adrenal gland** hormones help develop reproductive organs and the exposition of sexual characteristics [2].
*   **Memorizing/Understanding shortcut:** Hormones = **"Biological Wi-Fi"** (Invisible signals that tell organs how to grow and act).
*   **Common Misconceptions/Mistake:** Thinking hormones only affect reproductive organs; they also regulate vital physical and mental development [2].
*   **Difficulty:** Moderate.

---

#### **Subtopic 2: Pituitary Gland Hormones**
*   **Definition:** Hormones produced by the **pituitary gland** that serve as the master regulators for reproductive growth and function [2].
*   **Explanation:** The pituitary gland produces growth-stimulating and producer hormones that regulate the growth and secretions of other reproductive glands [2]. It controls **mammary gland and milk secretion**, regulates the contraction of the uterus, and produces **gonadotropic hormones** that stimulate the maturation of the ovum [2].
*   **Memorizing/Understanding shortcut:** Pituitary = **"The Master Switch"** (It turns on other reproductive glands).
*   **Common Misconceptions/Mistake:** Assuming the pituitary only affects height; it is actually the central control for starting puberty and managing childbirth [2, 3].
*   **Difficulty:** Moderate.

---

#### **Subtopic 3: Male Reproductive Hormones (Testis)**
*   **Definition:** Hormones such as **testosterone** and **androgen** that are secreted by the testes in males [2].
*   **Explanation:** These hormones are primarily responsible for the **production of sperm** [2]. They also trigger the development of secondary sexual characteristics during puberty, such as the growth of a beard, the deepening of the voice, and the widening of the shoulders [2].
*   **Memorizing/Understanding shortcut:** Testosterone = **"The Builder"** (Builds sperm and male physical traits).
*   **Common Misconceptions/Mistake:** Thinking testosterone is only present after birth; it is vital for the development of reproductive organs even before puberty [2].
*   **Difficulty:** Easy.

---

#### **Subtopic 4: Female Reproductive Hormones (Ovary)**
*   **Definition:** Hormones including **estrogen, progesterone, and relaxin** that are secreted by the ovaries [2].
*   **Explanation:** These hormones regulate the **menstrual cycle** (monthly discharge of blood) and cause the development of female characteristics like softness of skin [2, 4]. They also prepare the body for pregnancy by **enlarging the uterine wall** for the implantation of the embryo [2]. Progesterone specifically aids in the formation of the ovum [2].
*   **Memorizing/Understanding shortcut:** Estrogen/Progesterone = **"The Cycles & Cradle"** (Manage the monthly cycle and prepare the womb).
*   **Common Misconceptions/Mistake:** Believing these hormones only work during pregnancy; they are active every month during the menstrual cycle from puberty until menopause [2, 4].
*   **Difficulty:** Moderate.

---

#### **Subtopic 5: Hormonal Role in Pregnancy and Childbirth**
*   **Definition:** The collaborative hormonal activity between the **placenta** and the **pituitary gland** to sustain the foetus and facilitate birth [3, 5].
*   **Explanation:** The placenta produces hormones that **protect the embryo** and assist in its normal development [5]. At the end of pregnancy (approximately 40 weeks), the placenta and anterior pituitary gland secrete hormones that promote regular uterine contractions known as **labour pain**, which facilitates the birth of the child [3]. Post-birth, these hormones also help produce milk [3].
*   **Memorizing/Understanding shortcut:** Labour Hormones = **"The Exit Signal"**.
*   **Common Misconceptions/Mistake:** Thinking the baby initiates birth on its own; it is actually a precise **hormonal surge** from the mother's pituitary and placenta that triggers the process [3].
*   **Difficulty:** High.

---

### **Review Questions & Answers: Role of Hormones in Human Reproduction**

**Q1: According to the source, from which type of glands are hormones secreted?**
a) Duct glands
b) Digestive glands
c) Ductless (endocrine) glands
d) Salivary glands
**Correct:** c
**Explanation:** The text defines hormones as organic substances secreted specifically from **ductless (endocrine) glands** [1, 2].

**Q2: Which gland is specifically mentioned as secreting thyroxine to ensure sexual development?**
a) Adrenal gland
b) Pituitary gland
c) Thyroid gland
d) Thymus gland
**Correct:** c
**Explanation:** The explanation states that the **thyroid gland** secretes thyroxine to ensure sexual development [2].

**Q3: What is the primary function of the pituitary gland's gonadotropic hormones?**
a) To regulate blood pressure
b) To stimulate the maturation of the ovum
c) To deepen the voice
d) To produce adrenaline
**Correct:** b
**Explanation:** The text specifies that the pituitary produces **gonadotropic hormones** that stimulate the maturation of the ovum [2].

**Q4: Which of the following is NOT a function controlled by the pituitary gland as mentioned in the text?**
a) Mammary gland and milk secretion
b) Regulation of uterus contraction
c) Production of testosterone
d) Regulating the growth of other reproductive glands
**Correct:** c
**Explanation:** The pituitary controls mammary glands, uterus contraction, and regulates other glands [2]. However, the production of **testosterone** is specifically a function of the testes, not the pituitary gland itself [2].

**Q5: Which hormone is primarily responsible for the production of sperm in males?**
a) Estrogen
b) Progesterone
c) Thyroxine
d) Testosterone
**Correct:** d
**Explanation:** The text states that hormones like **testosterone** are primarily responsible for the production of sperm [2].

**Q6: The deepening of the voice and growth of a beard in males are examples of:**
a) Primary sexual characteristics
b) Secondary sexual characteristics
c) Hormonal imbalances
d) Reproductive organ functions
**Correct:** b
**Explanation:** The text explains that testosterone triggers the development of **secondary sexual characteristics** during puberty, such as the growth of a beard and deepening of the voice [2].

**Q7: Which hormone specifically aids in the formation of the ovum?**
a) Relaxin
b) Estrogen
c) Progesterone
d) Testosterone
**Correct:** c
**Explanation:** The explanation mentions that **Progesterone** specifically aids in the formation of the ovum [2].

**Q8: The enlargement of the uterine wall to prepare for the implantation of the embryo is a function of hormones secreted by the:**
a) Testes
b) Pituitary gland
c) Ovaries
d) Adrenal gland
**Correct:** c
**Explanation:** The text states that hormones from the **ovaries** (like estrogen and progesterone) prepare the body for pregnancy by enlarging the uterine wall for implantation [2].

**Q9: What is the approximate duration of a full-term pregnancy mentioned in the text?**
a) 20 weeks
b) 30 weeks
c) 40 weeks
d) 50 weeks
**Correct:** c
**Explanation:** The text states that the end of pregnancy occurs at approximately **40 weeks** [3].

**Q10: What is the primary trigger for "labour pain" (uterine contractions) at the end of pregnancy?**
a) The baby running out of space
b) A hormonal surge from the placenta and pituitary gland
c) The mother's physical exhaustion
d) A decrease in nutrient supply
**Correct:** b
**Explanation:** The text explains that the placenta and anterior pituitary gland secrete hormones that promote regular uterine contractions, meaning the process is triggered by a precise **hormonal surge** [3, 5].`;

try {
    const chapters = parseLessonText(text);
    console.log('Parsed Chapters:', chapters.length);
    if (chapters.length > 0) {
        const chapter = chapters[0];
        console.log('Topics:', chapter.topics.length);
        chapter.topics.forEach((topic, tIdx) => {
            console.log(`Topic ${tIdx + 1}: ${topic.title}`);
            console.log(`  Subtopics: ${topic.subtopics.length}`);
            topic.subtopics.forEach((st, sIdx) => {
                console.log(`    ${sIdx + 1}: ${st.title}`);
            });
            console.log(`  Questions: ${topic.questions.length}`);
            topic.questions.forEach((q, qIdx) => {
                console.log(`    ${qIdx + 1}: ${q.question.substring(0, 50)}...`);
            });
        });
    }
} catch (e) {
    console.error('Error:', e);
}
