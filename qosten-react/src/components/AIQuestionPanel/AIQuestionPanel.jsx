import React, { useState, useEffect } from 'react';
import { aiService } from '../../services/aiService';
import { useQuestions } from '../../context/QuestionContext';
import './AIQuestionPanel.css';

export default function AIQuestionPanel({ question, onClose }) {
  const { updateQuestion } = useQuestions();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('agent'); // 'ask' or 'agent'
  const [selectedFields, setSelectedFields] = useState([]);
  const [task, setTask] = useState('improve'); // 'improve', 'fix_latex', 'fact_check'
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState(null);

  // Available fields based on question type
  const availableFields = [
    { id: 'questionText', label: 'Question Text' },
    { id: 'explanation', label: 'Explanation', types: ['mcq'] },
    { id: 'options', label: 'Options', types: ['mcq'] },
    { id: 'answer', label: 'Answer', types: ['sq'] },
    { id: 'parts', label: 'CQ Parts', types: ['cq'] }
  ].filter(f => !f.types || f.types.includes(question.type));

  useEffect(() => {
    // Default select all available fields
    setSelectedFields(availableFields.map(f => f.id));
  }, [question.type]);

  const toggleField = (fieldId) => {
    setSelectedFields(prev => 
      prev.includes(fieldId) ? prev.filter(id => id !== fieldId) : [...prev, fieldId]
    );
  };

  const handleExecute = async () => {
    if (selectedFields.length === 0) {
      alert('Please select at least one field to improve.');
      return;
    }

    setLoading(true);
    setAiResponse(null);
    
    try {
      // We'll use a specialized prompt or repurpose the existing service
      const response = await aiService.improveQuestions(
        [question], 
        `${task}_on_fields_${selectedFields.join('_')}`,
        customPrompt
      );
      
      const improvement = response[0];
      
      if (mode === 'ask') {
        setAiResponse(improvement);
      } else {
        // Agent mode: Update database
        const updatedQuestion = { ...question, ...improvement };
        await updateQuestion(updatedQuestion);
        alert('Agent successfully updated the question! You can undo this change using the "Undo AI" button on the card.');
        onClose();
      }
    } catch (err) {
      console.error('AI Error:', err);
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveToTxt = () => {
    const content = `Question ID: ${question.id}\nType: ${question.type}\nSubject: ${question.subject}\n\n--- CURRENT STATE ---\n${JSON.stringify(question, null, 2)}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `question_${question.id}_backup.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-panel-modal" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>✨ AI Contextual Actions [ID: {question.id}]</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="panel-body">
          <div className="section">
            <h4>1. Select Fields to Process</h4>
            <div className="field-grid">
              {availableFields.map(field => (
                <label key={field.id} className="field-checkbox">
                  <input 
                    type="checkbox" 
                    checked={selectedFields.includes(field.id)}
                    onChange={() => toggleField(field.id)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          <div className="section">
            <h4>2. Select Mode</h4>
            <div className="mode-toggle">
              <button 
                className={mode === 'ask' ? 'active' : ''} 
                onClick={() => setMode('ask')}
              >
                💬 Ask (Get Advice)
              </button>
              <button 
                className={mode === 'agent' ? 'active' : ''} 
                onClick={() => setMode('agent')}
              >
                🤖 Agent (Modify DB)
              </button>
            </div>
          </div>

          <div className="section">
            <h4>3. Select Task</h4>
            <select value={task} onChange={e => setTask(e.target.value)}>
              <option value="improve">Improve Content</option>
              <option value="fix_latex">Fix LaTeX</option>
              <option value="fact_check">Fact Check</option>
              <option value="expand_answer">Expand Answer</option>
            </select>
          </div>

          <div className="section">
            <h4>4. Custom Instructions (Optional)</h4>
            <textarea 
              className="custom-prompt-input"
              placeholder="e.g. 'Make the language more professional' or 'Change the options to use Bengali numbers'..."
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              rows={3}
            />
          </div>

          {aiResponse && (
            <div className="ai-response-box">
              <h4>AI Advice:</h4>
              <pre>{JSON.stringify(aiResponse, null, 2)}</pre>
            </div>
          )}
        </div>

        <div className="panel-footer">
          <button className="secondary" onClick={saveToTxt}>💾 Save to TXT</button>
          <button className="primary" onClick={handleExecute} disabled={loading}>
            {loading ? 'Processing...' : 'Execute Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
