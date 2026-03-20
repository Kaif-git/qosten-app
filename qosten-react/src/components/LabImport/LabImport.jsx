import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { labApi } from '../../services/labApi';
import { safeJsonParse } from '../../utils/jsonFixUtils';
import { parseLabBulletPoints, LAB_BULLET_TEMPLATE } from '../../utils/labParser';
import './LabImport.css';

const LabImport = () => {
  const navigate = useNavigate();
  const [importMode, setImportMode] = useState('json'); // 'json' | 'bullet'
  const [jsonInput, setJsonInput] = useState('');
  const [bulletInput, setBulletInput] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [recentProblems, setRecentProblems] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);

  const lineCount = jsonInput.split('\n').length;

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const goToError = (line, col) => {
    if (!textareaRef.current) return;
    
    const lines = jsonInput.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1; i++) {
      pos += lines[i].length + 1; // +1 for \n
    }
    pos += col - 1;

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos);
    
    // Scroll to the line
    const lineHeight = 21; // Match CSS line-height
    textareaRef.current.scrollTop = (line - 5) * lineHeight;
  };

  const removeProblematicObject = (line, col) => {
    if (!window.confirm("Are you sure you want to remove the entire question containing this error?")) return;

    const lines = jsonInput.split('\n');
    let errorPos = 0;
    for (let i = 0; i < line - 1; i++) {
      errorPos += lines[i].length + 1;
    }
    errorPos += col - 1;

    // Search backwards for the start of the top-level object
    let startPos = errorPos;
    let bDepth = 0;
    while (startPos >= 0) {
      const char = jsonInput[startPos];
      if (char === '}') bDepth++;
      if (char === '{') {
        if (bDepth === 0) break; 
        bDepth--;
      }
      startPos--;
    }

    // Search forwards for the end of the top-level object
    let endPos = errorPos;
    bDepth = 0;
    while (endPos < jsonInput.length) {
      const char = jsonInput[endPos];
      if (char === '{') bDepth++;
      if (char === '}') {
        if (bDepth === 0) break;
        bDepth--;
      }
      endPos++;
    }

    if (startPos >= 0 && endPos < jsonInput.length) {
      let finalStart = startPos;
      let finalEnd = endPos + 1;

      // Handle commas and whitespace
      // 1. Try to find trailing comma
      let trailingSearch = finalEnd;
      while (trailingSearch < jsonInput.length && /\s/.test(jsonInput[trailingSearch])) trailingSearch++;
      if (jsonInput[trailingSearch] === ',') {
        finalEnd = trailingSearch + 1;
      } else {
        // 2. If no trailing comma, try to find leading comma
        let leadingSearch = finalStart - 1;
        while (leadingSearch >= 0 && /\s/.test(jsonInput[leadingSearch])) leadingSearch--;
        if (jsonInput[leadingSearch] === ',') {
          finalStart = leadingSearch;
        }
      }

      const newInput = jsonInput.substring(0, finalStart) + jsonInput.substring(finalEnd);
      setJsonInput(newInput);
      setStatus({ type: 'success', message: 'Removed problematic question. You can try parsing/uploading again.' });
    } else {
      alert("Could not automatically determine object boundaries to remove. Please delete it manually.");
    }
  };

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
// ... rest of example
      ],
      "final_answer": "AC = 2 cm"
    }
  ]
}`;

  const handleCopyPrompt = () => {
    const textToCopy = importMode === 'json' ? LAB_PROMPT_TEMPLATE : LAB_BULLET_TEMPLATE;
    const type = importMode === 'json' ? 'JSON' : 'Bullet Point';
    navigator.clipboard.writeText(textToCopy);
    alert(`📋 ${type} Template copied to clipboard!`);
  };

  const handleConvertToJSON = () => {
    try {
      if (!bulletInput.trim()) {
        setStatus({ type: 'error', message: 'Please paste bullet point text first.' });
        return;
      }
      const parsed = parseLabBulletPoints(bulletInput);
      // Determine if we parsed a list or a single object. The parser returns a single object currently.
      // If we want to support multiple, we might need to adjust the parser, but for now let's wrap in array if needed or just use object.
      // The API expects an array usually for bulk create, but let's see.
      // The current handleUpload expects an array or single object in JSON.
      
      const jsonString = JSON.stringify(parsed, null, 2);
      setJsonInput(jsonString);
      setImportMode('json');
      setStatus({ type: 'success', message: 'Converted to JSON! Please review and upload.' });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', message: 'Failed to convert: ' + e.message });
    }
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
      
      const { data, error, line, column, snippet, pointer } = safeJsonParse(jsonInput);
      
      if (error) {
        setStatus({ 
          type: 'error', 
          message: (
            <div className="json-error-details">
              <strong>JSON Parse Error:</strong> {error}<br/>
              <span>Line: {line}, Column: {column}</span>
              <button 
                onClick={() => goToError(line, column)}
                className="jump-to-error-btn"
              >
                🎯 Jump to Line {line}
              </button>
              <button 
                onClick={() => removeProblematicObject(line, column)}
                className="remove-problem-btn"
              >
                🗑️ Remove This Question
              </button>
              <pre className="error-snippet">
                {snippet}{'\n'}{pointer}
              </pre>
            </div>
          )
        });
        return;
      }

      const problems = Array.isArray(data) ? data : [data];

      // Basic validation
      for (const problem of problems) {
        const missingFields = [];
        if (!problem.lab_problem_id) missingFields.push('lab_problem_id');
        if (!problem.subject) missingFields.push('subject');
        if (!problem.chapter) missingFields.push('chapter');
        if (!problem.stem) missingFields.push('stem');
        if (!problem.parts || problem.parts.length === 0) missingFields.push('parts');
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields [${missingFields.join(', ')}] in problem: ${problem.lab_problem_id || 'unknown'}`);
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
          parts: p.parts,
          questionimage: p.questionimage || p.stem_image || p.image || null,
          answerimage1: p.answerimage1 || null,
          answerimage2: p.answerimage2 || null,
          answerimage3: p.answerimage3 || null,
          answerimage4: p.answerimage4 || null
        };
      });

      await labApi.bulkCreateLabProblems(formattedProblems);

      setStatus({ type: 'success', message: `Successfully uploaded ${problems.length} lab problems!` });
      setJsonInput('');
      setBulletInput('');
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
      setImportMode('json'); // Switch to JSON mode on file load
    };
    reader.readAsText(file);
  };

  return (
    <div className="lab-import-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>🧪 Lab Problem Import</h2>
        <div style={{display:'flex', gap:'10px'}}>
            <button 
            onClick={() => navigate('/lab-view')}
            style={{ backgroundColor: '#273c75', color: 'white', padding: '8px 15px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
            📚 Lab Library
            </button>
        </div>
      </div>

      <div className="mode-toggle" style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <button
          className={importMode === 'json' ? 'active-mode' : ''}
          onClick={() => setImportMode('json')}
          style={{
            padding: '8px 16px',
            border: '1px solid #ccc',
            backgroundColor: importMode === 'json' ? '#273c75' : '#f1f2f6',
            color: importMode === 'json' ? 'white' : 'black',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          { } JSON Mode
        </button>
        <button
          className={importMode === 'bullet' ? 'active-mode' : ''}
          onClick={() => setImportMode('bullet')}
          style={{
            padding: '8px 16px',
            border: '1px solid #ccc',
            backgroundColor: importMode === 'bullet' ? '#273c75' : '#f1f2f6',
            color: importMode === 'bullet' ? 'white' : 'black',
            cursor: 'pointer',
            borderRadius: '4px'
          }}
        >
          📝 Bullet Point Mode
        </button>
      </div>
      
      <div className="import-section">
        {importMode === 'json' ? (
            <>
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

                <div className="json-editor-wrapper">
                <div className="line-numbers-gutter" ref={lineNumbersRef}>
                    {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i + 1} className="line-number">{i + 1}</div>
                    ))}
                </div>
                <textarea
                    ref={textareaRef}
                    className="json-textarea"
                    placeholder='Paste your JSON here... e.g. { "lab_problem_id": "...", "subject": "...", ... }'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    onScroll={handleScroll}
                    spellCheck="false"
                />
                </div>
            </>
        ) : (
            <>
                <p>Paste your bullet-point formatted problem here. Click "Convert to JSON" to process it.</p>
                <textarea
                    className="json-textarea"
                    style={{ minHeight: '400px', fontFamily: 'monospace' }}
                    placeholder={LAB_BULLET_TEMPLATE}
                    value={bulletInput}
                    onChange={(e) => setBulletInput(e.target.value)}
                />
            </>
        )}

        <div className="action-buttons">
          {importMode === 'bullet' ? (
              <button 
                className="upload-button" 
                onClick={handleConvertToJSON}
                style={{ backgroundColor: '#e67e22' }}
              >
                🔄 Convert to JSON
              </button>
          ) : (
            <button 
                className="upload-button" 
                onClick={handleUpload}
                disabled={isUploading}
            >
                {isUploading ? 'Uploading...' : '🚀 Upload to Lab'}
            </button>
          )}
          
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
            📋 Copy {importMode === 'json' ? 'JSON' : 'Bullet'} Template
          </button>
          <button 
            className="clear-button" 
            onClick={() => importMode === 'json' ? setJsonInput('') : setBulletInput('')}
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
        <h3>Expected {importMode === 'json' ? 'JSON' : 'Bullet Point'} Format:</h3>
        <div style={{ maxHeight: '500px', overflowY: 'auto', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #eee', fontSize: '13px' }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {importMode === 'json' ? LAB_PROMPT_TEMPLATE : LAB_BULLET_TEMPLATE}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default LabImport;
