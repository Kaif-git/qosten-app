import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { labApi } from '../../services/labApi';
import { questionApi } from '../../services/questionApi';
import './LabImport.css';

const LabImport = () => {
  const navigate = useNavigate();
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [recentProblems, setRecentProblems] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const LAB_PROMPT_TEMPLATE = `{
  "lab_problem_id": "1766915237842",
  "subject": "Mathematics",
  "chapter": "Trigonometric Ratio",
  "lesson": null,
  "board": "Jashore Board-2022",

  "stem": "There is a triangle ABC with right angle at B, BC = √3 cm, angle ACB = 30°.",

  "parts": [

    {
      "part_id": "a",
      "question_text": "Determine the length of AC.",
      "guided_steps": [

        {
          "step_order": 1,
          "current_state": "Right triangle ABC, ∠ACB = 30°, BC = √3, AC = ?",
          "mcq": {
            "question": "Which trigonometric ratio connects BC and AC with angle 30°?",
            "options": [
              "sin 30°",
              "cos 30°",
              "tan 30°",
              "cot 30°"
            ],
            "correct_option_index": 1
          },
          "explanation": "Since BC is adjacent to angle 30° and AC is the hypotenuse, we use cos θ = adjacent / hypotenuse.",
          "concept_card": {
            "title": "Cosine in a Right Triangle",
            "concept_explanation": "In a right triangle, cos θ = adjacent side / hypotenuse.",
            "formula": "cos θ = adjacent / hypotenuse"
          },
          "next_state": "cos 30° = BC / AC"
        },

        {
          "step_order": 2,
          "current_state": "cos 30° = √3 / AC",
          "mcq": {
            "question": "What is the value of cos 30°?",
            "options": [
              "1/2",
              "√3/2",
              "√2/2",
              "√3"
            ],
            "correct_option_index": 1
          },
          "explanation": "The standard trigonometric value of cos 30° is √3/2.",
          "concept_card": {
            "title": "Standard Trigonometric Values",
            "concept_explanation": "cos 30° = √3/2 is a fundamental trigonometric value derived from a 30-60-90 triangle.",
            "formula": "cos 30° = √3/2"
          },
          "next_state": "√3/2 = √3 / AC"
        },

        {
          "step_order": 3,
          "current_state": "√3/2 = √3 / AC",
          "mcq": {
            "question": "How do we solve for AC?",
            "options": [
              "Add both sides",
              "Cross multiply",
              "Take square root",
              "Subtract √3"
            ],
            "correct_option_index": 1
          },
          "explanation": "Cross multiplication gives AC = 2 cm.",
          "concept_card": {
            "title": "Solving Proportions",
            "concept_explanation": "If a/b = c/d, then ad = bc. This method is called cross multiplication."
          },
          "next_state": "AC = 2 cm"
        }

      ],
      "final_answer": "AC = 2 cm"
    },

    {
      "part_id": "b",
      "question_text": "Prove that (2 - 1/csc²A)^(-1) + (2 + 1/cot²A)^(-1) = 1.",
      "guided_steps": [

        {
          "step_order": 1,
          "current_state": "Need values of sin A and tan A from triangle",
          "mcq": {
            "question": "Which ratio gives sin A?",
            "options": [
              "BC/AC",
              "AB/AC",
              "AC/BC",
              "AB/BC"
            ],
            "correct_option_index": 0
          },
          "explanation": "sin A = opposite / hypotenuse = BC / AC.",
          "concept_card": {
            "title": "Sine Definition",
            "concept_explanation": "sin θ = opposite side / hypotenuse in a right triangle."
          },
          "next_state": "sin A = √3 / 2"
        },

        {
          "step_order": 2,
          "current_state": "Find tan A",
          "mcq": {
            "question": "Which identity connects tan and sin/cos?",
            "options": [
              "tan θ = sin θ / cos θ",
              "tan θ = cos θ / sin θ",
              "tan θ = 1/sin θ",
              "tan θ = sin² θ"
            ],
            "correct_option_index": 0
          },
          "explanation": "tan θ = sin θ / cos θ, so tan A = √3.",
          "concept_card": {
            "title": "Tangent Identity",
            "concept_explanation": "tan θ = sin θ / cos θ."
          },
          "next_state": "tan A = √3"
        },

        {
          "step_order": 3,
          "current_state": "(2 - 1/csc²A)^(-1)",
          "mcq": {
            "question": "Which identity replaces 1/csc²A?",
            "options": [
              "cos²A",
              "tan²A",
              "sin²A",
              "sec²A"
            ],
            "correct_option_index": 2
          },
          "explanation": "1/csc²A = sin²A.",
          "concept_card": {
            "title": "Reciprocal Identity",
            "concept_explanation": "csc θ = 1/sin θ, so 1/csc²θ = sin²θ."
          },
          "next_state": "(2 - sin²A)^(-1)"
        },

        {
          "step_order": 4,
          "current_state": "Substitute sin²A = 3/4",
          "mcq": {
            "question": "What is 2 - 3/4?",
            "options": [
              "5/4",
              "4/5",
              "3/4",
              "1/4"
            ],
            "correct_option_index": 0
          },
          "explanation": "2 = 8/4, so 8/4 - 3/4 = 5/4. Its inverse is 4/5.",
          "concept_card": {
            "title": "Inverse of Fraction",
            "concept_explanation": "The inverse of a fraction a/b is b/a."
          },
          "next_state": "First term = 4/5"
        }

      ],
      "final_answer": "Sum = 1 (Proved)"
    },

    {
      "part_id": "c",
      "question_text": "Show that θ = 60°.",
      "guided_steps": [

        {
          "step_order": 1,
          "current_state": "2(BC/AC)^2 + 3(AB/AC) - 3 = 0",
          "mcq": {
            "question": "Which substitution is correct?",
            "options": [
              "BC/AC = cos θ",
              "BC/AC = sin θ",
              "AB/AC = sin θ",
              "AB/AC = tan θ"
            ],
            "correct_option_index": 1
          },
          "explanation": "BC is opposite and AC hypotenuse, so BC/AC = sin θ.",
          "concept_card": {
            "title": "Sine and Cosine in Triangle",
            "concept_explanation": "sin θ = opposite/hypotenuse, cos θ = adjacent/hypotenuse."
          },
          "next_state": "2sin²θ + 3cosθ - 3 = 0"
        },

        {
          "step_order": 2,
          "current_state": "2sin²θ + 3cosθ - 3 = 0",
          "mcq": {
            "question": "Which identity replaces sin²θ?",
            "options": [
              "1 - cos²θ",
              "cos²θ - 1",
              "1 + cos²θ",
              "tan²θ"
            ],
            "correct_option_index": 0
          },
          "explanation": "Using identity sin²θ = 1 - cos²θ.",
          "concept_card": {
            "title": "Pythagorean Identity",
            "concept_explanation": "sin²θ + cos²θ = 1 → sin²θ = 1 - cos²θ."
          },
          "next_state": "2(1 - cos²θ) + 3cosθ - 3 = 0"
        },

        {
          "step_order": 3,
          "current_state": "2cos²θ - 3cosθ + 1 = 0",
          "mcq": {
            "question": "What method solves this equation?",
            "options": [
              "Integration",
              "Factorization",
              "Differentiation",
              "Substitution"
            ],
            "correct_option_index": 1
          },
          "explanation": "This is a quadratic in cos θ. Factorize.",
          "concept_card": {
            "title": "Quadratic Factorization",
            "concept_explanation": "If ax² + bx + c = 0, try factorizing into (px + q)(rx + s)."
          },
          "next_state": "(2cosθ - 1)(cosθ - 1) = 0"
        }

      ],
      "final_answer": "θ = 60°"
    }

  ]
}

# Math Formatting Guide for Lab Problems
To ensure mathematical expressions render correctly, consistently, and without visual glitches (like white backgrounds or raw text), please follow these strict formatting guidelines when creating content 
## 1. Golden Rule: Always Use Delimiters
**NEVER** leave math "naked" in the text. Every single mathematical symbol, equation, or variable must be wrapped in LaTeX delimiters.
- **Inline Math:** Use \\( ... \\) or $ ... $.
  - ✅ Correct: The value of \\( x \\) is 5.
  - ✅ Correct: The value of $x$ is 5.
  - ❌ Incorrect: The value of x is 5.
- **Display Math (Centered):** Use \\[ ... \\] or $$ ... $$.
  - ✅ Correct: \\[ E = mc^2 \\]
  - ✅ Correct: $$ E = mc^2 $$
## 2. Fractions
Always use \\frac{numerator}{denominator} inside math delimiters. Do **not** use a/b or 1/2 in plain text if you want it formatted vertically.
- ✅ Correct: \\( \\frac{1}{2} \\) or \\( \\frac{3}{4} \\)
- ✅ Correct: \\( \\frac{a+b}{c} \\)
- ❌ Incorrect: 1/2 (will render as text "1/2")
- ❌ Incorrect: \\frac{1}{2} (missing delimiters)
## 3. Trigonometric Functions & Logs
Always use the backslash prefix for standard functions inside delimiters. This ensures they are rendered in upright roman font, not italic.
- ✅ Correct: \\( \\sin \\theta \\)
- ✅ Correct: \\( \\cos(2x) \\)
- ✅ Correct: \\( \\tan^{-1}(1) \\)
- ✅ Correct: \\( \\log_{10} x \\)
- ❌ Incorrect: sin theta
- ❌ Incorrect: \\( sin \\theta \\) (renders as italic variables *s* *i* *n*)
## 4. Superscripts and Subscripts
Must be inside delimiters. Use braces {} if the script is more than one character.
- ✅ Correct: \\( x^2 \\)
- ✅ Correct: \\( e^{-x} \\)
- ✅ Correct: \\( A_{initial} \\)
- ❌ Incorrect: x^2
- ❌ Incorrect: x^(-1) (outside delimiters)
## 5. Text Inside Math
If you need normal text inside an equation, use \\text{...}.
- ✅ Correct: \\( x = 5 \\text{ cm} \\)
- ❌ Incorrect: \\( x = 5 cm \\) (renders as variables *c* *m*)
## 6. Bold Text
- For **headings/emphasis** in the question text (outside math), use Markdown: **Step 1**
- For **vectors/matrices** (inside math), use \\mathbf{...}: \\( \\mathbf{v} = (1, 2) \\)
## Examples
### Bad Example (Will cause issues)
"Calculate 1/2 of sin 30. The answer is 0.5."
### Good Example (Renders perfectly)
"Calculate \\( \\frac{1}{2} \\) of \\( \\sin 30^\\circ \\). The answer is \\( 0.5 \\)."
### Bad Example
"Prove that (2 - 1/csc^2A)^(-1) = 1."
### Good Example
"Prove that \\( (2 - \\frac{1}{\\csc^2 A})^{-1} = 1 \\)."
## Troubleshooting
- **White Background?** Ensure you are not pasting formatted text from Word/Web that brings hidden styles. Use plain text.
- **Raw Code Showing?** You likely forgot the \\( ... \\) delimiters.
- **Weird Spacing?** You might be using math mode for English sentences. Only wrap the actual math parts.
  - ❌ \\( The answer is 5 \\)
  - ✅ The answer is \\( 5 \\)`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(LAB_PROMPT_TEMPLATE);
    alert('📋 AI Prompt Template & Math Guide copied to clipboard!');
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      setIsLoadingList(true);
      const { data } = await labApi.fetchLabProblems({ limit: 10 });
      setRecentProblems(data || []);
    } catch (error) {
      console.error('Failed to fetch problems:', error);
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleUpload = async () => {
    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: 'Please paste JSON data first.' });
      return;
    }

    try {
      setIsUploading(true);
      setStatus({ type: 'info', message: 'Parsing and validating JSON...' });
      
      const parsedData = JSON.parse(jsonInput);
      const problems = Array.isArray(parsedData) ? parsedData : [parsedData];

      // Basic validation
      for (const problem of problems) {
        if (!problem.lab_problem_id || !problem.subject || !problem.chapter || !problem.stem || !problem.parts) {
          throw new Error(`Missing required fields in problem: ${problem.lab_problem_id || 'unknown'}`);
        }
      }

      setStatus({ type: 'info', message: `Uploading ${problems.length} lab problems...` });
      
      const formattedProblems = problems.map(p => {
        return {
          lab_problem_id: p.lab_problem_id,
          subject: p.subject,
          chapter: p.chapter,
          lesson: p.lesson,
          board: p.board,
          stem: p.stem,
          parts: p.parts // Stored as JSONB
        };
      });

      await labApi.bulkCreateLabProblems(formattedProblems);

      setStatus({ type: 'success', message: `Successfully uploaded ${problems.length} lab problems!` });
      setJsonInput('');
      fetchProblems(); // Refresh list
    } catch (error) {
      console.error('Upload error:', error);
      setStatus({ type: 'error', message: `Upload failed: ${error.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this lab problem?')) return;
    try {
      await labApi.deleteLabProblem(id);
      fetchProblems();
    } catch (error) {
      alert('Delete failed: ' + error.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonInput(event.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="lab-import-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🧪 Lab Problem Import</h2>
        <button 
          onClick={() => navigate('/lab-view')}
          style={{ backgroundColor: '#273c75', color: 'white', padding: '8px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
        >
          📚 Go to Lab Library
        </button>
      </div>
      
      <div className="import-section">
        <p>Paste the JSON format for lab problems here or upload a JSON file.</p>
        
        <div className="upload-controls">
          <input 
            type="file" 
            accept=".json" 
            onChange={handleFileChange} 
            id="file-upload"
            className="file-input"
          />
          <label htmlFor="file-upload" className="file-label">
            📁 Choose JSON File
          </label>
        </div>

        <textarea
          className="json-textarea"
          placeholder='Paste your JSON here... e.g. { "lab_problem_id": "...", "subject": "...", ... }'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
        />

        <div className="action-buttons">
          <button 
            className="upload-button" 
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : '🚀 Upload to Lab'}
          </button>
          <button 
            className="copy-prompt-button" 
            onClick={handleCopyPrompt}
            style={{
              backgroundColor: '#8e44ad',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            📋 Copy AI Prompt
          </button>
          <button 
            className="clear-button" 
            onClick={() => setJsonInput('')}
            disabled={isUploading}
          >
            🗑️ Clear
          </button>
        </div>

        {status.message && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>

      <div className="list-section">
        <h3>📋 Recent Lab Problems</h3>
        {isLoadingList ? (
          <p>Loading...</p>
        ) : (
          <div className="problems-table-container">
            <table className="problems-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Chapter</th>
                  <th>Board</th>
                  <th>Parts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentProblems.map(p => (
                  <tr key={p.id}>
                    <td>{p.lab_problem_id}</td>
                    <td>{p.subject}</td>
                    <td>{p.chapter}</td>
                    <td>{p.board || '-'}</td>
                    <td>{p.parts?.length || 0}</td>
                    <td>
                      <button className="delete-btn" onClick={() => handleDelete(p.id)}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {recentProblems.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{textAlign:'center'}}>No lab problems found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="format-guide">
        <h3>Expected Format & Math Guide:</h3>
        <div style={{ maxHeight: '500px', overflowY: 'auto', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee', fontSize: '13px' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {LAB_PROMPT_TEMPLATE}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default LabImport;
