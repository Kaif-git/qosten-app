# Prompts Management System

A comprehensive system for managing AI prompts in your Supabase database for the Qosten application.

## 📋 Table of Contents

- [Overview](#overview)
- [Database Setup](#database-setup)
- [Features](#features)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Examples](#examples)

## 🔍 Overview

This system allows you to:
- Store and organize AI prompts by type and subject
- Use dynamic placeholders in prompts (e.g., `{topic}`, `{grade_level}`)
- Track prompt usage statistics
- Filter and search prompts efficiently
- Manage prompts for different AI models and configurations

## 🗄️ Database Setup

### Step 1: Run the Migration

Navigate to your Supabase dashboard or use the Supabase CLI:

```bash
# Using Supabase CLI
supabase migration up

# Or run the SQL directly in Supabase Dashboard:
# SQL Editor > New Query > Copy contents from supabase/migrations/001_create_prompts_table.sql
```

### Step 2: Verify the Table

Check that the `prompts` table was created with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(255) | Prompt title |
| prompt_text | TEXT | The actual prompt with placeholders |
| prompt_type | VARCHAR(100) | Type of prompt (e.g., 'question_generation') |
| subject | VARCHAR(100) | Subject area |
| grade_level | VARCHAR(50) | Target grade level |
| language | VARCHAR(50) | Language of the prompt |
| tags | TEXT[] | Array of tags |
| ai_model | VARCHAR(100) | Preferred AI model |
| temperature | DECIMAL(3,2) | AI temperature setting |
| max_tokens | INTEGER | Maximum tokens for AI response |
| is_active | BOOLEAN | Whether prompt is active |
| usage_count | INTEGER | Times the prompt has been used |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |
| created_by | VARCHAR(255) | Creator identifier |
| notes | TEXT | Additional notes |

## ✨ Features

### 1. Dynamic Placeholders
Use placeholders in your prompts that get replaced with actual values:
```
Generate {count} questions on {topic} for {grade_level} students.
```

### 2. Categorization
- **By Type**: question_generation, explanation, summary, evaluation, etc.
- **By Subject**: Mathematics, Science, English, etc.
- **By Grade Level**: Elementary, High School, College, etc.
- **By Tags**: Custom tags for flexible organization

### 3. Usage Tracking
Automatically track how often each prompt is used to identify popular prompts.

### 4. AI Configuration
Store AI-specific settings like model type, temperature, and max tokens with each prompt.

## 💻 Usage

### Setting Up the Context

In your `App.js` or main component:

```javascript
import { PromptProvider } from './context/PromptContext';

function App() {
  return (
    <PromptProvider>
      {/* Your app components */}
    </PromptProvider>
  );
}
```

### Using the Prompts Hook

```javascript
import { usePrompts } from './context/PromptContext';

function MyComponent() {
  const {
    prompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    getPromptsByType,
    formatPrompt,
    incrementUsage
  } = usePrompts();

  // Your component logic
}
```

## 📚 API Reference

### Context Methods

#### `fetchPrompts()`
Fetches all prompts from the database.
```javascript
await fetchPrompts();
```

#### `addPrompt(prompt)`
Adds a new prompt to the database.
```javascript
const newPrompt = await addPrompt({
  title: 'Generate MCQ Questions',
  prompt_text: 'Generate {count} MCQ questions on {topic}',
  prompt_type: 'question_generation',
  subject: 'Mathematics',
  grade_level: 'Grade 10',
  tags: ['mcq', 'assessment']
});
```

#### `updatePrompt(id, updates)`
Updates an existing prompt.
```javascript
await updatePrompt(promptId, {
  title: 'Updated Title',
  is_active: false
});
```

#### `deletePrompt(id)`
Deletes a prompt.
```javascript
await deletePrompt(promptId);
```

#### `getPromptsByType(type)`
Fetches all prompts of a specific type.
```javascript
const questionPrompts = await getPromptsByType('question_generation');
```

#### `getPromptsBySubject(subject)`
Fetches all prompts for a specific subject.
```javascript
const mathPrompts = await getPromptsBySubject('Mathematics');
```

#### `searchPrompts(searchText)`
Searches prompts by title or content.
```javascript
const results = await searchPrompts('MCQ');
```

#### `formatPrompt(promptText, variables)`
Replaces placeholders with actual values.
```javascript
const formatted = formatPrompt(
  'Generate {count} questions on {topic}',
  { count: 5, topic: 'Algebra' }
);
// Result: "Generate 5 questions on Algebra"
```

#### `incrementUsage(id)`
Increments the usage count for a prompt.
```javascript
await incrementUsage(promptId);
```

### Utility Functions

Import from `utils/promptUtils.js`:

```javascript
import {
  PROMPT_TYPES,
  SUBJECTS,
  GRADE_LEVELS,
  validatePrompt,
  extractPlaceholders,
  formatPromptText,
  createPromptTemplate,
  filterPrompts,
  sortPrompts,
  getPopularPrompts
} from './utils/promptUtils';
```

#### `validatePrompt(prompt)`
Validates a prompt object.
```javascript
const { isValid, errors } = validatePrompt(prompt);
```

#### `extractPlaceholders(promptText)`
Extracts all placeholders from a prompt.
```javascript
const placeholders = extractPlaceholders('Generate {count} questions on {topic}');
// Returns: ['count', 'topic']
```

#### `createPromptTemplate(type, options)`
Creates a prompt template for common use cases.
```javascript
const template = createPromptTemplate(PROMPT_TYPES.QUESTION_GENERATION, {
  questionType: 'True/False',
  additionalInstructions: 'Include explanations.'
});
```

## 📝 Examples

### Example 1: Creating a Custom Prompt

```javascript
import { usePrompts } from './context/PromptContext';
import { PROMPT_TYPES } from './utils/promptUtils';

function CreatePromptForm() {
  const { addPrompt } = usePrompts();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const newPrompt = await addPrompt({
        title: 'Generate Math Word Problems',
        prompt_text: 'Create {count} word problems about {topic} for {grade_level} students. Each problem should include the question, solution steps, and final answer.',
        prompt_type: PROMPT_TYPES.QUESTION_GENERATION,
        subject: 'Mathematics',
        grade_level: 'Grade 8',
        language: 'English',
        tags: ['word-problems', 'math', 'practice'],
        ai_model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1500,
        is_active: true
      });
      
      console.log('Prompt created:', newPrompt);
    } catch (error) {
      console.error('Error creating prompt:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
}
```

### Example 2: Using a Prompt with Third-Party AI

```javascript
import { usePrompts } from './context/PromptContext';

function AIQuestionGenerator() {
  const { getPromptsByType, formatPrompt, incrementUsage } = usePrompts();

  const generateQuestions = async () => {
    // Get prompts for question generation
    const prompts = await getPromptsByType('question_generation');
    
    // Select the first prompt (or let user choose)
    const selectedPrompt = prompts[0];
    
    // Format the prompt with actual values
    const formattedPrompt = formatPrompt(selectedPrompt.prompt_text, {
      count: 10,
      topic: 'Quadratic Equations',
      grade_level: 'Grade 10',
      subject: 'Mathematics'
    });
    
    // Send to your AI service (OpenAI, Claude, etc.)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOUR_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedPrompt.ai_model || 'gpt-4',
        messages: [{ role: 'user', content: formattedPrompt }],
        temperature: selectedPrompt.temperature || 0.7,
        max_tokens: selectedPrompt.max_tokens || 1000
      })
    });
    
    const result = await response.json();
    
    // Increment usage count
    await incrementUsage(selectedPrompt.id);
    
    return result.choices[0].message.content;
  };

  return (
    <button onClick={generateQuestions}>
      Generate Questions
    </button>
  );
}
```

### Example 3: Filtering and Displaying Prompts

```javascript
import { usePrompts } from './context/PromptContext';
import { filterPrompts, sortPrompts, getPopularPrompts } from './utils/promptUtils';

function PromptLibrary() {
  const { prompts } = usePrompts();
  const [filters, setFilters] = useState({
    promptType: '',
    subject: 'Mathematics'
  });

  // Filter prompts
  const filteredPrompts = filterPrompts(prompts, filters);
  
  // Sort by usage
  const sortedPrompts = sortPrompts(filteredPrompts, 'usage_count', 'desc');
  
  // Get top 5 popular prompts
  const popularPrompts = getPopularPrompts(prompts, 5);

  return (
    <div>
      <h2>Prompt Library</h2>
      
      {/* Filters */}
      <select onChange={(e) => setFilters({...filters, subject: e.target.value})}>
        <option value="">All Subjects</option>
        <option value="Mathematics">Mathematics</option>
        <option value="Science">Science</option>
        {/* More options */}
      </select>

      {/* Display prompts */}
      <div>
        {sortedPrompts.map(prompt => (
          <div key={prompt.id}>
            <h3>{prompt.title}</h3>
            <p>{prompt.prompt_text}</p>
            <span>Used {prompt.usage_count} times</span>
          </div>
        ))}
      </div>

      {/* Popular prompts sidebar */}
      <aside>
        <h3>Most Popular</h3>
        {popularPrompts.map(prompt => (
          <div key={prompt.id}>{prompt.title}</div>
        ))}
      </aside>
    </div>
  );
}
```

### Example 4: Bulk Import Prompts

```javascript
import { usePrompts } from './context/PromptContext';
import { importPromptsFromJSON } from './utils/promptUtils';

function ImportPrompts() {
  const { addPrompt } = usePrompts();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    const text = await file.text();
    const prompts = importPromptsFromJSON(text);

    for (const prompt of prompts) {
      try {
        await addPrompt(prompt);
      } catch (error) {
        console.error('Error importing prompt:', error);
      }
    }
  };

  return (
    <input type="file" accept=".json" onChange={handleFileUpload} />
  );
}
```

## 🚀 Next Steps

1. **Run the migration** to create the prompts table
2. **Add the PromptProvider** to your app
3. **Create your first prompts** using the provided examples
4. **Integrate with your AI service** of choice (OpenAI, Claude, Gemini, etc.)
5. **Build a UI** for managing prompts (create, edit, delete)

## 🔒 Security Notes

- Row Level Security (RLS) is enabled on the prompts table
- Read access is public, but write operations require authentication
- Make sure to set up proper authentication in your Supabase project
- Store API keys securely and never expose them in client-side code

## 🤝 Contributing

Feel free to extend the system with:
- More prompt templates
- Additional utility functions
- Custom filters and sorting options
- Export/import features
- Prompt versioning
- Prompt testing features

---

**Happy Prompting! 🎉**
