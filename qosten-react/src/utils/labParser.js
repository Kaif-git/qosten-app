
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

Final Answer: AC = 2 cm`;

export const parseLabBulletPoints = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  const results = [];
  let currentResult = null;
  let currentPart = null;
  let currentStep = null;
  let isCapturingStem = false;

  // Track global metadata to carry over if multiple questions share them
  let globalMeta = {
    subject: '',
    chapter: '',
    lesson: null,
    board: ''
  };

  const startNewProblem = () => {
    currentResult = {
      lab_problem_id: Date.now().toString() + results.length,
      subject: globalMeta.subject,
      chapter: globalMeta.chapter,
      lesson: globalMeta.lesson,
      board: globalMeta.board,
      stem: '',
      parts: []
    };
    results.push(currentResult);
    currentPart = null;
    currentStep = null;
    isCapturingStem = false;
  };

  const getValue = (line, label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let regex;
    if (label.toLowerCase() === 'step') {
      regex = new RegExp(`^[-*#\\s]*\\[?\\s*(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?\\s*[:=-]?\\s*(\\d+)\\b`, 'i');
    } else {
      regex = new RegExp(`^[-*#\\s]*\\[?\\s*(?:\\*\\*)?${escapedLabel}\\b(?:\\*\\*)?\\s*[:=-]\\s*(.*)`, 'i');
    }
    const match = line.match(regex);
    if (match) {
      let val = (match[1] || '').trim();
      // Thoroughly clean up markers
      const clean = (s) => s.replace(/^(\*\*|__|[*_[\]])\s*/, '').replace(/\s*(\*\*|__|[*_[\]])$/, '').trim();
      val = clean(val);
      // Second pass for nested markers like [**Value**]
      val = clean(val);
      return val;
    }
    return null;
  };

  const startsWith = (line, label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^[-*#\\s]*\\[?\\s*(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?\\b`, 'i');
    return regex.test(line);
  };

  let isCapturingPartQuestion = false;
  let isCapturingOptions = false;

  const metadataLabels = [
    'Subject', 'Chapter', 'Lesson', 'Board', 'ID', 'Problem ID', 
    'Stem', 'Part', 'Question', 'Step', 'State', 'Current State', 
    'MCQ', 'Option', 'Correct', 'Explanation', 'Concept', 'Next', 'Final Answer'
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip separator lines
    if (line === '---' || line === '***' || line === '___') continue;

    // Detect new question start
    if (startsWith(line, 'Question') && !currentPart) {
      startNewProblem();
    }

    const idVal = getValue(line, 'ID') || getValue(line, 'Problem ID');
    if (idVal) {
      if (!currentResult || (currentResult.parts.length > 0)) {
        startNewProblem();
      }
      currentResult.lab_problem_id = idVal;
      continue;
    }

    // Delay start until we see a known label if not already started
    if (!currentResult) {
      const isStartLabel = metadataLabels.some(label => startsWith(line, label));
      if (isStartLabel) {
        startNewProblem();
      } else {
        continue;
      }
    }

    // Parts
    if (startsWith(line, 'Part')) {
      isCapturingStem = false;
      isCapturingOptions = false;
      const partRegex = /^[-*#\s]*\[?\s*(?:\*\*)?Part\s*(?::\s*)?([a-z0-9]+)(?:\*\*)?\s*[:=-]?\s*(.*?)\s*(?:\*\*)?\s*\]?$/i;
      const match = line.match(partRegex);
      
      if (match) {
        const partId = match[1].toLowerCase();
        let potentialText = match[2].trim();
        potentialText = potentialText.replace(/^[:=-]\s*/, '').replace(/^\*\*\s*/, '').trim();
        // Clean potentialText
        potentialText = potentialText.replace(/^(\*\*|__)/, '').replace(/(\*\*|__)$/, '').trim();
        
        currentPart = {
          part_id: partId,
          question_text: potentialText,
          guided_steps: [],
          final_answer: ''
        };
        currentResult.parts.push(currentPart);
        currentStep = null;
        isCapturingPartQuestion = !potentialText;
        continue;
      }
    }

    // Top Level Fields
    const subjVal = getValue(line, 'Subject');
    if (subjVal) { globalMeta.subject = subjVal; currentResult.subject = subjVal; continue; }

    const chapVal = getValue(line, 'Chapter');
    if (chapVal) { globalMeta.chapter = chapVal; currentResult.chapter = chapVal; continue; }

    const lessonVal = getValue(line, 'Lesson');
    if (lessonVal) { globalMeta.lesson = lessonVal; currentResult.lesson = lessonVal; continue; }

    const boardVal = getValue(line, 'Board');
    if (boardVal) { globalMeta.board = boardVal; currentResult.board = boardVal; continue; }
    
    const stemVal = getValue(line, 'Stem');
    if (stemVal !== null) { 
      currentResult.stem = stemVal; 
      isCapturingStem = true; 
      continue; 
    }

    // Part question capturing
    if (isCapturingPartQuestion && currentPart) {
      const isMetadata = metadataLabels.some(label => startsWith(line, label));
      if (line.startsWith('---') || isMetadata) {
        isCapturingPartQuestion = false;
      } else {
        currentPart.question_text = (currentPart.question_text + '\n' + line).trim();
        continue;
      }
    }

    if (isCapturingStem) {
      const isMetadata = metadataLabels.some(label => startsWith(line, label));
      if (line.startsWith('---') || isMetadata || (line.startsWith('[') && line.includes(':') && line.endsWith(']'))) {
        isCapturingStem = false;
      } else {
        currentResult.stem = (currentResult.stem + '\n' + line).trim();
        continue;
      }
    }

    if (startsWith(line, 'Question') && currentPart) {
      const qText = getValue(line, 'Question');
      if (qText) currentPart.question_text = qText;
      continue;
    }

    if (startsWith(line, 'Final Answer') && currentPart) {
      currentPart.final_answer = getValue(line, 'Final Answer');
      continue;
    }

    // Steps
    const stepVal = getValue(line, 'Step');
    if (stepVal && currentPart) {
      isCapturingOptions = false;
      const order = parseInt(stepVal) || (currentPart.guided_steps.length + 1);
      
      // If we have an implicit step that matches this order and has no MCQ yet, reuse it
      const lastStep = currentPart.guided_steps[currentPart.guided_steps.length - 1];
      if (lastStep && lastStep.step_order === order && !lastStep.mcq.question && !lastStep.mcq.options.length) {
        currentStep = lastStep;
        continue;
      }

      currentStep = {
        step_order: order,
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
      continue;
    }

    // Detect implied first step if we see step-level markers but no step started
    const stateVal = getValue(line, 'State') || getValue(line, 'Current State');

    // Handle State as Stem or Part Question if missing
    if (stateVal !== null) {
      if (!currentPart && currentResult && !currentResult.stem) {
        currentResult.stem = stateVal;
        isCapturingStem = true;
        continue;
      }
      if (currentPart && !currentStep && !currentPart.question_text) {
        currentPart.question_text = stateVal;
        isCapturingPartQuestion = true;
        continue;
      }
    }

    const mcqQ = getValue(line, 'MCQ') || getValue(line, 'MCQ Question');
    
    if ((stateVal !== null || mcqQ !== null || startsWith(line, 'Option') || startsWith(line, 'Correct')) && currentPart && !currentStep) {
      currentStep = {
        step_order: 1,
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
    }

    if (!currentStep) continue;

    if (stateVal) { 
      if (currentStep.current_state) {
        currentStep.current_state = (currentStep.current_state + '\n' + stateVal).trim();
      } else {
        currentStep.current_state = stateVal; 
      }
      continue; 
    }

    const nextVal = getValue(line, 'Next') || getValue(line, 'Next State');
    if (nextVal) { currentStep.next_state = nextVal; continue; }

    // MCQ
    if (mcqQ) { 
      isCapturingOptions = true;
      // Reset or overwrite if we already have a full MCQ in this step
      if (currentStep.mcq.options.length > 0) {
        currentStep.mcq.question = mcqQ;
        currentStep.mcq.options = [];
        currentStep.mcq.correct_option_index = 0;
      } else if (currentStep.mcq.question) {
        // Support multi-line MCQ questions if no options yet
        currentStep.mcq.question = (currentStep.mcq.question + '\n' + mcqQ).trim();
      } else {
        let nextLine = lines[i + 1];
        const nextIsMCQ = nextLine && (startsWith(nextLine, 'MCQ') || startsWith(nextLine, 'MCQ Question'));
        
        if (nextIsMCQ) {
          currentStep.mcq.question = currentStep.current_state || "";
          currentStep.mcq.options.push(mcqQ);
        } else {
          currentStep.mcq.question = mcqQ;
        }
      }
      continue; 
    }

    if (startsWith(line, 'Option')) {
      isCapturingOptions = true;
      let optVal = getValue(line, 'Option');
      if (!optVal) {
        optVal = line.replace(/^[-*#\s]*\[?\s*(?:\*\*)?Option(?:\*\*)?\s*[:=-]?\s*/i, '').replace(/\s*(?:\*\*)?\s*\]?$/, '').trim();
      }
      // Strip common prefixes but preserve decimals
      optVal = optVal.replace(/^(?:[a-dA-D]|[0-3])\s*[:.)-]\s+/, '').trim();
      currentStep.mcq.options.push(optVal);
      continue;
    }

    const correctVal = getValue(line, 'Correct') || getValue(line, 'Correct Option');
    if (correctVal) {
      isCapturingOptions = false;
      const firstPart = correctVal.split(/[(\s:]/)[0].trim();
      const lower = firstPart.toLowerCase();
      let index = 0;
      
      if (lower === 'a') index = 0;
      else if (lower === 'b') index = 1;
      else if (lower === 'c') index = 2;
      else if (lower === 'd') index = 3;
      else {
        const parsed = parseInt(firstPart);
        if (!isNaN(parsed)) {
          index = parsed;
          // Most users use 1, 2, 3, 4. If they use 0, 1, 2, 3, we keep it as is if it's 0.
          if (index >= 1 && index <= 4) index -= 1;
        }
      }
      currentStep.mcq.correct_option_index = index;
      continue;
    }

    const expVal = getValue(line, 'Explanation');
    if (expVal) { isCapturingOptions = false; currentStep.explanation = expVal; continue; }

    // Concept Card
    const conceptTitle = getValue(line, 'Concept Title') || getValue(line, 'Concept');
    if (conceptTitle) {
      isCapturingOptions = false;
      if (!currentStep.concept_card) currentStep.concept_card = {};
      currentStep.concept_card.title = conceptTitle;
      continue;
    }

    const conceptText = getValue(line, 'Concept Explanation') || getValue(line, 'Concept Text');
    if (conceptText) {
      isCapturingOptions = false;
      if (!currentStep.concept_card) currentStep.concept_card = {};
      currentStep.concept_card.concept_explanation = conceptText;
      continue;
    }
    
    const formulaVal = getValue(line, 'Formula');
    if (formulaVal) {
      isCapturingOptions = false;
      if (!currentStep.concept_card) currentStep.concept_card = {};
      currentStep.concept_card.formula = formulaVal;
      continue;
    }

    // Bulleted options - require space after bullet to distinguish from bold markers
    if (isCapturingOptions && (line.startsWith('- ') || line.startsWith('* '))) {
      // Check if it's a known keyword that should break option capturing
      const isBreakLabel = ['Step', 'Part', 'State', 'Correct', 'MCQ', 'Explanation', 'Concept'].some(label => startsWith(line, label));
      
      if (!isBreakLabel) {
        const optVal = line.replace(/^[-*]\s+/, '').trim();
        if (optVal) {
          const cleaned = optVal.replace(/^(?:[a-dA-D]|[0-3])\s*[:.)-]\s+/, '').trim();
          currentStep.mcq.options.push(cleaned);
          continue;
        }
      } else {
          isCapturingOptions = false;
      }
    }
  }

  return results.length === 1 ? results[0] : results;
};
