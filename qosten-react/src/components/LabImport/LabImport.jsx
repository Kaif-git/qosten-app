import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { labApi } from '../../services/labApi';
import './LabImport.css';

const LabImport = () => {
  const navigate = useNavigate();
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [recentProblems, setRecentProblems] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

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
      
      const formattedProblems = problems.map(p => ({
        lab_problem_id: p.lab_problem_id,
        subject: p.subject,
        chapter: p.chapter,
        lesson: p.lesson,
        board: p.board,
        stem: p.stem,
        parts: p.parts // Stored as JSONB
      }));

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
        <h3>Expected Format Guide:</h3>
        <pre>
{`{
  "lab_problem_id": "string",
  "subject": "string",
  "chapter": "string",
  "stem": "string",
  "parts": [
    {
      "part_id": "a",
      "question_text": "...",
      "guided_steps": [...],
      "final_answer": "..."
    }
  ]
}`}
        </pre>
      </div>
    </div>
  );
};

export default LabImport;
