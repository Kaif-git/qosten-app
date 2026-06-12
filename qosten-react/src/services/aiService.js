const API_KEYS = (process.env.REACT_APP_GEMINI_API_KEYS || '').split(',').filter(Boolean);
if (API_KEYS.length === 0) {
  console.warn('⚠️ [aiService] No API keys found in REACT_APP_GEMINI_API_KEYS environment variable.');
}

const MODEL_NAME = 'gemma-4-31b-it';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function getApiKey(index) {
  return API_KEYS[index % API_KEYS.length];
}

/**
 * The most robust JSON extractor possible.
 */
function extractJson(text) {
  if (!text) return null;

  const tryParse = (jsonStr) => {
    try {
      // Basic cleaning for common AI mistakes
      const cleaned = jsonStr
        .trim()
        .replace(/\n/g, '\\n') // Escape raw newlines
        .replace(/\r/g, '\\r')
        .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas
      
      return JSON.parse(cleaned);
    } catch (e) {
      try {
        // More aggressive: fix unescaped backslashes (common in LaTeX)
        // Only escape if not followed by a valid escape char
        const fixed = jsonStr
          .replace(/\\(?!(?:["\\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\')
          .replace(/\n/g, '\\n');
        return JSON.parse(fixed);
      } catch (e2) {
        // Last ditch: try to extract just the fields we need via regex if parsing totally fails
        // But for now, just log the failure
        // console.error("❌ [extractJson] Parse failed after sanitization", e2.message);
      }
    }
    return null;
  };

  const foundObjects = [];
  const stack = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' && (i === 0 || text[i-1] !== '\\')) {
      stack.push(i);
    } else if (text[i] === '}' && stack.length > 0 && (i === 0 || text[i-1] !== '\\')) {
      const startIdx = stack.pop();
      if (stack.length === 0) {
        const block = text.substring(startIdx, i + 1);
        const parsed = tryParse(block);
        if (parsed) foundObjects.push(parsed);
      }
    }
  }

  return foundObjects.length > 0 ? foundObjects : null;
}

async function callModel(prompt, retryCount = 5, keyIndex = 0, onRawResponse = null, onStatusUpdate = null, onObjectFound = null) {
  const key = getApiKey(keyIndex);
  const url = `${BASE_URL}/${MODEL_NAME}:streamGenerateContent?key=${key}`;
  const internalIndex = keyIndex % API_KEYS.length;
  
  if (onStatusUpdate) onStatusUpdate(`📡 Requesting ${MODEL_NAME} (Key #${internalIndex})...`);

  const extractedIds = new Set();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          topP: 1,
          topK: 1
        }
      })
    });

    if (!response.ok) {
      if (retryCount > 0) {
        console.warn(`⚠️ [aiService] Key #${internalIndex} failed (${response.status}). Rotating...`);
        return await callModel(prompt, retryCount - 1, keyIndex + 1, onRawResponse, onStatusUpdate, onObjectFound);
      }
      throw new Error(`AI API Error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let accumulatedRaw = "";
    let lastProcessedIndex = 0;
    let lastDiscoveryIndex = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedRaw += chunk;
      
      const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
      let match;
      regex.lastIndex = Math.max(0, lastProcessedIndex - 100); 

      while ((match = regex.exec(accumulatedRaw)) !== null) {
        if (match.index >= lastProcessedIndex) {
          const context = accumulatedRaw.substring(match.index, match.index + match[0].length + 100);
          const isThought = /"thought":\s*true/.test(context);
          
          let textPart = "";
          try {
            textPart = JSON.parse('"' + match[1] + '"');
          } catch (e) {
            textPart = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          }
          
          if (!isThought) {
            fullContent += textPart;
            if (onRawResponse) onRawResponse(textPart);

            // INCREMENTAL DISCOVERY:
            if (onObjectFound && fullContent.includes('}', lastDiscoveryIndex)) {
              try {
                const found = extractJson(fullContent.substring(lastDiscoveryIndex));
                if (found) {
                  for (const obj of found) {
                    if (obj.id && !extractedIds.has(obj.id.toString())) {
                      extractedIds.add(obj.id.toString());
                      onObjectFound(obj);
                      // Update lastDiscoveryIndex to the end of the last found object to be safe
                      lastDiscoveryIndex = fullContent.lastIndexOf('}', fullContent.length - 1) + 1;
                    }
                  }
                }
              } catch (e) {}
            }
          }
          lastProcessedIndex = match.index + match[0].length;
        }
      }
    }

    // FINAL FALLBACK: Ensure all objects were found
    if (onObjectFound) {
      const finalFound = extractJson(fullContent);
      if (finalFound) {
        for (const obj of finalFound) {
          if (obj.id && !extractedIds.has(obj.id.toString())) {
            extractedIds.add(obj.id.toString());
            onObjectFound(obj);
          }
        }
      }
    }

    if (!fullContent) throw new Error("Empty AI response stream.");
    return extractJson(fullContent);

  } catch (err) {
    if (retryCount > 0) {
      return await callModel(prompt, retryCount - 1, keyIndex + 1, onRawResponse, onStatusUpdate, onObjectFound);
    }
    throw err;
  }
}

export const aiService = {
  /**
   * Scans a parsed JS string for common LaTeX syntax errors.
   */
  validateLatex(text) {
    if (!text || typeof text !== 'string') return false;
    
    // 1. Check for raw control characters that indicate failed JSON escaping 
    // \x09 is TAB (\t), \x0C is Form Feed (\f)
    // If AI sent \frac instead of \\frac, JSON.parse creates a tab or other control char.
    const hasFailedEscaping = /[\x00-\x08\x09\x0B\x0C\x0E-\x1F]/.test(text);
    
    // 2. Check for unbalanced delimiters in the parsed string
    const openCount = (text.match(/\\\(/g) || []).length;
    const closeCount = (text.match(/\\\)/g) || []).length;
    
    // 3. Check for raw display math
    const hasDisplayMath = text.includes('\\[') || text.includes('$$');

    // 4. Check for "double slash leak" (AI outputting \\( when it should be \( in the parsed string)
    const hasDoubleSlashLeak = /\\\\\(/.test(text);

    // 5. Check for missing delimiters around COMPLEX math commands
    // We are more selective now to avoid flagging simple scientific notation if desired
    // but standard commands like \frac, \sqrt, \theta really should have delimiters.
    const complexMathCommands = /\\(frac|sqrt|alpha|beta|gamma|delta|theta|pi|phi|sigma|omega|sum|int|limit|dots|div|pm|mp|approx|neq|le|ge|rightarrow|leftarrow)/i;
    const hasComplexMath = complexMathCommands.test(text);
    
    // 6. Check for exponents/subscripts without delimiters (e.g. x^2, H_2O)
    // Only flag if it's mixed with letters/complex patterns
    const hasBareMathPatterns = /([a-zA-Z])\^|([0-9])\^([a-zA-Z])|\^\{/.test(text) || /([a-zA-Z])_([0-9])/.test(text);

    const hasDelimiters = text.includes('\\(') || text.includes('\\[') || text.includes('$$');

    return hasFailedEscaping || (openCount !== closeCount) || hasDisplayMath || hasDoubleSlashLeak || ((hasComplexMath || hasBareMathPatterns) && !hasDelimiters);
  },

  /**
   * Scans a full question object for any LaTeX issues in its fields.
   */
  hasLatexIssues(q) {
    if (!q || typeof q !== 'object') return false;
    
    const checkFields = [
      q.questionText,
      q.question,
      q.explanation,
      q.answer,
      ...(q.options || []).map(o => o.text),
      ...(q.parts || []).map(p => (p.text || '') + (p.answer || ''))
    ].filter(Boolean);

    return checkFields.some(f => this.validateLatex(f));
  },

  async improveQuestions(questions, task, customInstructions = '', onRawResponse = null, onStatusUpdate = null, onResult = null, keyIndex = 0) {
    const isFactCheck = task === 'fact_check';
    const prompt = `
YOU ARE AN ELITE DATA PROCESSING SYSTEM. 
STRICT REQUIREMENT: OUTPUT EACH IMPROVED QUESTION AS AN INDIVIDUAL JSON OBJECT.
DO NOT WRAP IN A TOP-LEVEL ARRAY. DO NOT USE MARKDOWN CODE BLOCKS.

TASK: ${task.replace(/_/g, ' ')}
GOAL: Fix Bengali LaTeX, improve clarity, verify facts, ensure perfect formatting.

LATEX RULES (MANDATORY):
1. USE INLINE DELIMITERS ONLY: Always use \\\\( ... \\\\). 
2. FORBID DISPLAY MATH: Never use \\\\[ ... \\\\] or $$ ... $$.
3. DOUBLE BACKSLASHES: You MUST use double backslashes (\\\\) for ALL LaTeX commands.
   Correct: \\\\( \\\\frac{1}{2} \\\\), \\\\( \\\\sqrt{x} \\\\), \\\\( \\\\dots \\\\)
   Incorrect: \\( \\frac{1}{2} \\) (JSON will break)
4. NO RAW NEWLINES: Do not use actual newlines inside math delimiters.
5. NO SYMBOL CONVERSIONS: Keep standard math symbols inside delimiters.

JSON RULES:
- Exactly ${questions.length} separate JSON objects.
- NO PREAMBLE. NO CONVERSATION.
${isFactCheck ? 'IMPORTANT: This is a FACT CHECK task. Provide "factCheckSummary" and "isFactuallyCorrect".' : ''}
${customInstructions ? 'USER_WISH: ' + customInstructions : ''}

INPUT_DATA_JSON:
${JSON.stringify(questions.map(q => ({
  id: q.id,
  type: q.type,
  questionText: q.questionText || q.question || q.stem || '',
  options: q.options,
  explanation: q.explanation,
  parts: q.parts,
  answer: q.answer
})))}

STRICT_JSON_OBJECTS_ONLY_START_NOW:
`;

    console.log(`🤖 [aiService] Launching task: ${task}`);
    console.log(`📝 [aiService] Prompt (truncated):`, prompt.substring(0, 500) + "...");
    console.log(`📦 [aiService] Surgical payload:`, questions);

    return await callModel(prompt, 5, keyIndex, 
      (delta) => {
        if (onRawResponse) onRawResponse(delta);
      }, 
      onStatusUpdate, 
      (obj) => {
        console.log(`📥 [aiService] Received incremental object from AI:`, obj);
        if (onResult) onResult(obj);
      }
    );
  }
};

