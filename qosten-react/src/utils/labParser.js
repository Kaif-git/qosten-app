
export const parseLabBulletPoints = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  const result = {
    lab_problem_id: Date.now().toString(), // Default if not provided
    subject: '',
    chapter: '',
    lesson: null,
    board: '',
    stem: '',
    parts: []
  };

  let currentPart = null;
  let currentStep = null;
  let currentOptions = [];

  // Helper to extract value after label
  // Supports: "- Label: Value", "Label: Value", "* Label: Value"
  const getValue = (line, label) => {
    const regex = new RegExp(`^[-*]?\\s*${label}\\s*[:=]\\s*(.*)`, 'i');
    const match = line.match(regex);
    return match ? match[1].trim() : null;
  };

  // Helper to check if line starts with label
  const startsWith = (line, label) => {
    const regex = new RegExp(`^[-*]?\\s*${label}\\b`, 'i');
    return regex.test(line);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Top Level Fields
    const idVal = getValue(line, 'ID') || getValue(line, 'Problem ID');
    if (idVal) { result.lab_problem_id = idVal; continue; }

    const subjVal = getValue(line, 'Subject');
    if (subjVal) { result.subject = subjVal; continue; }

    const chapVal = getValue(line, 'Chapter');
    if (chapVal) { result.chapter = chapVal; continue; }

    const boardVal = getValue(line, 'Board');
    if (boardVal) { result.board = boardVal; continue; }
    
    const stemVal = getValue(line, 'Stem');
    if (stemVal) { result.stem = stemVal; continue; }

    // Parts
    const partVal = getValue(line, 'Part');
    if (partVal) {
      currentPart = {
        part_id: partVal.toLowerCase().replace(/part\s*/i, ''),
        question_text: '',
        guided_steps: [],
        final_answer: ''
      };
      result.parts.push(currentPart);
      currentStep = null; // Reset step when new part starts
      continue;
    }

    if (startsWith(line, 'Question') && currentPart) {
      currentPart.question_text = getValue(line, 'Question');
      continue;
    }

    if (startsWith(line, 'Final Answer') && currentPart) {
      currentPart.final_answer = getValue(line, 'Final Answer');
      continue;
    }

    // Steps
    const stepVal = getValue(line, 'Step');
    if (stepVal && currentPart) {
      currentStep = {
        step_order: parseInt(stepVal) || (currentPart.guided_steps.length + 1),
        current_state: '',
        mcq: {
          question: '',
          options: [],
          correct_option_index: 0
        },
        explanation: '',
        concept_card: null,
        next_state: ''
      };
      currentPart.guided_steps.push(currentStep);
      currentOptions = []; // Reset options
      continue;
    }

    if (!currentStep) continue;

    const stateVal = getValue(line, 'State') || getValue(line, 'Current State');
    if (stateVal) { currentStep.current_state = stateVal; continue; }

    const nextVal = getValue(line, 'Next') || getValue(line, 'Next State');
    if (nextVal) { currentStep.next_state = nextVal; continue; }

    // MCQ
    const mcqQ = getValue(line, 'MCQ') || getValue(line, 'MCQ Question');
    if (mcqQ) { currentStep.mcq.question = mcqQ; continue; }

    if (startsWith(line, 'Option')) {
      // Handle "Option: Value" or just "- Option Value"
      // Or sometimes just bullets if we are in an option block context?
      // Let's stick to explicit labels for now for robustness
      let optVal = getValue(line, 'Option');
      if (!optVal) {
        // Try to handle simple bullets if they look like options
        // But for now, let's assume they are labeled or we detect them
        optVal = line.replace(/^[-*]\s*Option\s*[:]?\s*/i, '').trim();
      }
      currentOptions.push(optVal);
      currentStep.mcq.options = currentOptions;
      continue;
    }
    
    // Also handle just " - Value" if we know we are looking for options?
    // That might be too risky. Let's stick to "Option: ..."
    // Or allow a block of options under "Options:"
    
    const correctVal = getValue(line, 'Correct') || getValue(line, 'Correct Option');
    if (correctVal) {
      // Handle index (0,1,2,3) or alphabetical (a,b,c,d) or text match
      const lower = correctVal.toLowerCase();
      let index = 0;
      if (['a', '0'].includes(lower)) index = 0;
      else if (['b', '1'].includes(lower)) index = 1;
      else if (['c', '2'].includes(lower)) index = 2;
      else if (['d', '3'].includes(lower)) index = 3;
      else {
        // Try to parse number
        const parsed = parseInt(correctVal);
        if (!isNaN(parsed)) index = parsed;
        // If 1-based, decrement? Let's assume 0-based if < 4, else 1-based
        // Actually, let's just assume 0-based or 1-based based on value?
        // Standard is usually 0-based in code, but humans write 1-based.
        // Let's assume 1-based if it's 1-4.
        if (index >= 1 && index <= 4) index -= 1; 
      }
      currentStep.mcq.correct_option_index = index;
      continue;
    }

    const expVal = getValue(line, 'Explanation');
    if (expVal) { currentStep.explanation = expVal; continue; }

    // Concept Card
    const conceptTitle = getValue(line, 'Concept Title') || getValue(line, 'Concept');
    if (conceptTitle) {
      if (!currentStep.concept_card) currentStep.concept_card = {};
      currentStep.concept_card.title = conceptTitle;
      continue;
    }

    const conceptText = getValue(line, 'Concept Text') || getValue(line, 'Concept Explanation');
    if (conceptText) {
      if (!currentStep.concept_card) currentStep.concept_card = {};
      currentStep.concept_card.concept_explanation = conceptText;
      continue;
    }
    
    const formulaVal = getValue(line, 'Formula');
    if (formulaVal) {
      if (!currentStep.concept_card) currentStep.concept_card = {};
      currentStep.concept_card.formula = formulaVal;
      continue;
    }
  }

  return result;
};

export const LAB_BULLET_TEMPLATE = `ID: 1766915237842
Subject: Mathematics
Chapter: Trigonometric Ratio
Board: Jashore Board-2022
Stem: There is a triangle ABC with right angle at B, BC = √3 cm, angle ACB = 30°.

Part: a
Question: Determine the length of AC.

Step: 1
State: Right triangle ABC, ∠ACB = 30°, BC = √3, AC = ?
MCQ: Which trigonometric ratio connects BC and AC with angle 30°?
Option: sin 30°
Option: cos 30°
Option: tan 30°
Option: cot 30°
Correct: 1
Explanation: Since BC is adjacent to angle 30° and AC is the hypotenuse, we use cos θ = adjacent / hypotenuse.
Concept Title: Cosine in a Right Triangle
Concept Explanation: In a right triangle, cos θ = adjacent side / hypotenuse.
Next: cos 30° = BC / AC

Step: 2
State: cos 30° = √3 / AC
MCQ: What is the value of cos 30°?
Option: 1/2
Option: √3/2
Option: √2/2
Option: √3
Correct: 1
Explanation: The standard trigonometric value of cos 30° is √3/2.
Next: √3/2 = √3 / AC

Final Answer: AC = 2 cm

Part: b
Question: Prove that (2 - 1/csc²A)^(-1) + (2 + 1/cot²A)^(-1) = 1.
...`;
