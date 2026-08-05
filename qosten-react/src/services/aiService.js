import { aiUsageService } from './aiUsageService';
import { supabase } from './supabaseClient';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function extractJson(text) {
  if (!text) return null;

  const tryParse = (jsonStr) => {
    try {
      const cleaned = jsonStr
        .trim()
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/,\s*([\]}])/g, '$1');
      
      return JSON.parse(cleaned);
    } catch (e) {
      try {
        const fixed = jsonStr
          .replace(/\\(?!(?:["\\\/bfnrt]|u[0-9a-fA-F]{4}))/g, '\\\\')
          .replace(/\n/g, '\\n');
        return JSON.parse(fixed);
      } catch (e2) {}
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

async function callModel(prompt, retryCount = 5, onRawResponse = null, onStatusUpdate = null, onObjectFound = null, requestType = 'unknown', metadata = {}, preferredKey = null) {
  const startTime = Date.now();
  let currentKey = null;
  let apiKeyId = null;

  try {
    if (preferredKey) {
      currentKey = preferredKey;
    } else {
      currentKey = await aiUsageService.getBestKey();
    }
    
    if (!currentKey) {
      throw new Error('No available API keys');
    }

    apiKeyId = currentKey.id;
    const apiKey = currentKey.api_key;
    const modelName = currentKey.model || 'gemma-4-31b-it';
    const url = `${BASE_URL}/${modelName}:streamGenerateContent?key=${apiKey}`;

    if (onStatusUpdate) {
      onStatusUpdate(`Requesting ${modelName} (${currentKey.key_name})...`);
    }

    const extractedIds = new Set();

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
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `API Error ${response.status}`;
      const errorCode = errorData.error?.code || errorData.error?.status;

      await aiUsageService.logUsage({
        apiKeyId,
        requestType,
        model: currentKey.model,
        responseTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: errorMsg,
        metadata
      });

      await aiUsageService.logKeyError({
        apiKeyId,
        errorType: response.status === 429 ? 'rate_limit' : response.status === 401 ? 'auth_error' : response.status === 403 ? 'forbidden' : 'api_error',
        errorCode,
        errorMessage: errorMsg,
        httpStatus: response.status,
        requestType,
        model: currentKey.model,
        retryCount: 5 - retryCount,
        metadata
      });

      if (retryCount > 0) {
        console.warn(`Key ${currentKey.key_name} failed. Retrying with next key...`);
        if (onStatusUpdate) onStatusUpdate(`Key failed, rotating... (${retryCount} retries left)`);
        return await callModel(prompt, retryCount - 1, onRawResponse, onStatusUpdate, onObjectFound, requestType, metadata);
      }
      throw new Error(errorMsg);
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

            if (onObjectFound && fullContent.includes('}', lastDiscoveryIndex)) {
              try {
                const found = extractJson(fullContent.substring(lastDiscoveryIndex));
                if (found) {
                  for (const obj of found) {
                    if (obj.id && !extractedIds.has(obj.id.toString())) {
                      extractedIds.add(obj.id.toString());
                      onObjectFound(obj);
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

    const responseTime = Date.now() - startTime;
    
    await aiUsageService.logUsage({
      apiKeyId,
      requestType,
      model: currentKey.model,
      inputTokens: prompt.length / 4,
      outputTokens: fullContent.length / 4,
      responseTimeMs: responseTime,
      success: true,
      metadata
    });

    try {
      const sessionId = crypto.randomUUID();
      await supabase.from('ai_chat_history').insert([
        {
          session_id: sessionId,
          role: 'user',
          content: prompt,
          model: currentKey.model,
          tokens_used: Math.round(prompt.length / 4),
        },
        {
          session_id: sessionId,
          role: 'assistant',
          content: fullContent,
          model: currentKey.model,
          tokens_used: Math.round(fullContent.length / 4),
        }
      ]);
    } catch (storeErr) {
      console.error('Failed to store conversation:', storeErr);
    }

    if (!fullContent) throw new Error("Empty AI response stream.");
    return extractJson(fullContent);

  } catch (err) {
    if (apiKeyId) {
      await aiUsageService.logUsage({
        apiKeyId,
        requestType,
        model: currentKey?.model,
        responseTimeMs: Date.now() - startTime,
        success: false,
        errorMessage: err.message,
        metadata
      });

      await aiUsageService.logKeyError({
        apiKeyId,
        errorType: 'exception',
        errorMessage: err.message,
        requestType,
        model: currentKey?.model,
        retryCount: 5 - retryCount,
        metadata
      });
    }

    if (retryCount > 0) {
      console.warn(`Request failed. Retrying... (${retryCount} retries left)`);
      return await callModel(prompt, retryCount - 1, onRawResponse, onStatusUpdate, onObjectFound, requestType, metadata);
    }
    throw err;
  }
}

export const aiService = {
  validateLatex(text) {
    if (!text || typeof text !== 'string') return false;
    
    const hasFailedEscaping = /[\x00-\x08\x09\x0B\x0C\x0E-\x1F]/.test(text);
    const openCount = (text.match(/\\\(/g) || []).length;
    const closeCount = (text.match(/\\\)/g) || []).length;
    const hasDisplayMath = text.includes('\\[') || text.includes('$$');
    const hasDoubleSlashLeak = /\\\\\(/.test(text);
    const complexMathCommands = /\\(frac|sqrt|alpha|beta|gamma|delta|theta|pi|phi|sigma|omega|sum|int|limit|dots|div|pm|mp|approx|neq|le|ge|rightarrow|leftarrow)/i;
    const hasComplexMath = complexMathCommands.test(text);
    const hasBareMathPatterns = /([a-zA-Z])\^|([0-9])\^([a-zA-Z])|\^\{/.test(text) || /([a-zA-Z])_([0-9])/.test(text);
    const hasDelimiters = text.includes('\\(') || text.includes('\\[') || text.includes('$$');

    return hasFailedEscaping || (openCount !== closeCount) || hasDisplayMath || hasDoubleSlashLeak || ((hasComplexMath || hasBareMathPatterns) && !hasDelimiters);
  },

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

  async improveQuestions(questions, task, customInstructions = '', onRawResponse = null, onStatusUpdate = null, onResult = null, preferredKey = null) {
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

    console.log(`Launching AI task: ${task} with ${questions.length} questions`);

    return await callModel(prompt, 5, 
      (delta) => {
        if (onRawResponse) onRawResponse(delta);
      }, 
      onStatusUpdate, 
      (obj) => {
        console.log(`Received incremental object:`, obj);
        if (onResult) onResult(obj);
      },
      task,
      { questionCount: questions.length, customInstructions },
      preferredKey
    );
  },

  async checkUsage() {
    const stats = await aiUsageService.getDashboardStats();
    return stats;
  },

  async getKeys() {
    return await aiUsageService.loadKeys();
  }
};
