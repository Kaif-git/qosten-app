# MCQ Parser Metadata Format Update

## Overview
Updated the MCQ question parser to handle metadata formats with flexible whitespace and without asterisks, specifically catering to copy-pasted content that may have variations in spacing.

## Supported New Formats

### 1. Bracketed Metadata without Asterisks
```
[Subject: Chemistry]
[Chapter: Concept of Mole and Chemical Counting]
[Lesson: Mole and Avogadro's Number]
[Board: SCHOLAISHOME, Sylhet]
15.What is the number of molecule found in 1 g CaCO_3?
a) 6.02 \times 10^{21}
...
Correct: a
Explanation: ...
```

### 2. Bracketed Metadata with Extra Spaces
```
[ Subject : Physics ]
[ Chapter : Forces ]
...
```

### 3. Flexible Correct Answer Format
Now supports correct answers with or without closing parenthesis:
- `Correct: a`
- `Correct: a)`

## Changes Implementation

### `src/utils/mcqQuestionParser.js`
- **Metadata Regexes:** Updated to allow optional whitespace around keys and values.
  - Old: `^\*{0,2}\[(Subject|\u00E4\u00B8\u008B):\s*(.+?)\]\*{0,2}$/i`
  - New: `^\*{0,2}\[\s*(Subject|\u00E4\u00B8\u008B)\s*:\s*(.+?)\s*\]\*{0,2}$/i`
- **Correct Answer Regex:** Updated to allow optional closing parenthesis.
- **Example Text:** Added the bracketed metadata format to the UI helper text via `getMCQQuestionExample()`.

## Verification
- Verified with `reproduce_mcq_parsing.js` covering both clean and spaced inputs.
- Verified build success.
