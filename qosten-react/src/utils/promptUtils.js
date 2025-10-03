// Prompt type constants
export const PROMPT_TYPES = {
  QUESTION_GENERATION: 'question_generation',
  EXPLANATION: 'explanation',
  SUMMARY: 'summary',
  EVALUATION: 'evaluation',
  TRANSLATION: 'translation',
  PRACTICE: 'practice',
  HINT: 'hint',
  SOLUTION: 'solution'
};

// Subject constants
export const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Social Studies',
  'History',
  'Geography',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'General'
];

// Grade level constants
export const GRADE_LEVELS = [
  'All Levels',
  'Grade 1-5',
  'Grade 6-8',
  'Grade 9-10',
  'Grade 11-12',
  'High School',
  'College',
  'University'
];

// AI model constants
export const AI_MODELS = {
  GPT4: 'gpt-4',
  GPT35: 'gpt-3.5-turbo',
  CLAUDE3: 'claude-3',
  CLAUDE2: 'claude-2',
  GEMINI_PRO: 'gemini-pro',
  PALM2: 'palm-2'
};

/**
 * Validates a prompt object
 * @param {Object} prompt - The prompt object to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validatePrompt(prompt) {
  const errors = [];

  if (!prompt.title || prompt.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!prompt.prompt_text || prompt.prompt_text.trim() === '') {
    errors.push('Prompt text is required');
  }

  if (!prompt.prompt_type || prompt.prompt_type.trim() === '') {
    errors.push('Prompt type is required');
  }

  if (prompt.temperature !== undefined && (prompt.temperature < 0 || prompt.temperature > 1)) {
    errors.push('Temperature must be between 0 and 1');
  }

  if (prompt.max_tokens !== undefined && prompt.max_tokens < 1) {
    errors.push('Max tokens must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extracts placeholders from a prompt text
 * @param {string} promptText - The prompt text with placeholders
 * @returns {string[]} - Array of placeholder names
 */
export function extractPlaceholders(promptText) {
  const regex = /{([^}]+)}/g;
  const placeholders = [];
  let match;

  while ((match = regex.exec(promptText)) !== null) {
    if (!placeholders.includes(match[1])) {
      placeholders.push(match[1]);
    }
  }

  return placeholders;
}

/**
 * Formats a prompt by replacing placeholders with values
 * @param {string} promptText - The prompt text with placeholders
 * @param {Object} values - Object with placeholder values
 * @returns {string} - Formatted prompt text
 */
export function formatPromptText(promptText, values) {
  let formatted = promptText;
  
  Object.keys(values).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    formatted = formatted.replace(regex, values[key] || `{${key}}`);
  });

  return formatted;
}

/**
 * Creates a prompt template for a specific use case
 * @param {string} type - The type of prompt
 * @param {Object} options - Additional options
 * @returns {Object} - Prompt template object
 */
export function createPromptTemplate(type, options = {}) {
  const templates = {
    [PROMPT_TYPES.QUESTION_GENERATION]: {
      title: `Generate ${options.questionType || 'MCQ'} Questions`,
      prompt_text: `Generate {count} ${options.questionType || 'multiple-choice'} questions on the topic of {topic} for {grade_level} students studying {subject}. ${options.additionalInstructions || ''}`,
      prompt_type: PROMPT_TYPES.QUESTION_GENERATION,
      tags: ['question', 'generation', options.questionType || 'mcq']
    },
    [PROMPT_TYPES.EXPLANATION]: {
      title: 'Explain Concept',
      prompt_text: 'Explain the concept of {concept} in {subject} to {grade_level} students. Use simple language, provide examples, and ensure understanding.',
      prompt_type: PROMPT_TYPES.EXPLANATION,
      tags: ['explanation', 'teaching', 'concept']
    },
    [PROMPT_TYPES.SUMMARY]: {
      title: 'Summarize Topic',
      prompt_text: 'Provide a comprehensive summary of {topic} in {subject} for {grade_level} students. Include key points, important facts, and main takeaways.',
      prompt_type: PROMPT_TYPES.SUMMARY,
      tags: ['summary', 'overview', 'revision']
    },
    [PROMPT_TYPES.SOLUTION]: {
      title: 'Generate Solution',
      prompt_text: 'Provide a detailed step-by-step solution to the following problem in {subject}: {problem}. Explain each step clearly for {grade_level} students.',
      prompt_type: PROMPT_TYPES.SOLUTION,
      tags: ['solution', 'step-by-step', 'problem-solving']
    }
  };

  return templates[type] || null;
}

/**
 * Filters prompts based on criteria
 * @param {Array} prompts - Array of prompt objects
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered prompts
 */
export function filterPrompts(prompts, filters) {
  return prompts.filter(prompt => {
    // Search text filter
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      const titleMatch = prompt.title.toLowerCase().includes(searchLower);
      const textMatch = prompt.prompt_text.toLowerCase().includes(searchLower);
      if (!titleMatch && !textMatch) return false;
    }

    // Type filter
    if (filters.promptType && prompt.prompt_type !== filters.promptType) {
      return false;
    }

    // Subject filter
    if (filters.subject && prompt.subject !== filters.subject) {
      return false;
    }

    // Grade level filter
    if (filters.gradeLevel && prompt.grade_level !== filters.gradeLevel) {
      return false;
    }

    // Active status filter
    if (filters.isActive !== undefined && prompt.is_active !== filters.isActive) {
      return false;
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      if (!prompt.tags || !filters.tags.some(tag => prompt.tags.includes(tag))) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts prompts by various criteria
 * @param {Array} prompts - Array of prompt objects
 * @param {string} sortBy - Sort criteria
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted prompts
 */
export function sortPrompts(prompts, sortBy = 'created_at', order = 'desc') {
  const sorted = [...prompts].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle dates
    if (sortBy.includes('_at')) {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    }

    // Handle strings
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (order === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  return sorted;
}

/**
 * Exports prompts to JSON format
 * @param {Array} prompts - Array of prompt objects
 * @returns {string} - JSON string
 */
export function exportPromptsToJSON(prompts) {
  return JSON.stringify(prompts, null, 2);
}

/**
 * Imports prompts from JSON format
 * @param {string} jsonString - JSON string
 * @returns {Array} - Array of prompt objects
 */
export function importPromptsFromJSON(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return [];
  }
}

/**
 * Gets popular prompts based on usage count
 * @param {Array} prompts - Array of prompt objects
 * @param {number} limit - Number of prompts to return
 * @returns {Array} - Most used prompts
 */
export function getPopularPrompts(prompts, limit = 10) {
  return [...prompts]
    .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
    .slice(0, limit);
}

/**
 * Gets recently added prompts
 * @param {Array} prompts - Array of prompt objects
 * @param {number} limit - Number of prompts to return
 * @returns {Array} - Recently added prompts
 */
export function getRecentPrompts(prompts, limit = 10) {
  return [...prompts]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}
