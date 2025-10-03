import React, { useState, useEffect } from 'react';
import { usePrompts } from '../../context/PromptContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractPlaceholders, formatPromptText } from '../../utils/promptUtils';
import './PromptGenerator.css';

export default function PromptGenerator() {
  const { prompts, incrementUsage } = usePrompts();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [placeholderValues, setPlaceholderValues] = useState({});
  const [formattedPrompt, setFormattedPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Load prompt from navigation state or allow selection
  useEffect(() => {
    if (location.state?.prompt) {
      setSelectedPrompt(location.state.prompt);
      initializePlaceholders(location.state.prompt);
    }
  }, [location]);

  const initializePlaceholders = (prompt) => {
    const placeholders = extractPlaceholders(prompt.prompt_text);
    const initialValues = {};
    placeholders.forEach(ph => {
      initialValues[ph] = '';
    });
    setPlaceholderValues(initialValues);
  };

  const handlePromptSelect = (e) => {
    const promptId = e.target.value;
    const prompt = prompts.find(p => p.id === promptId);
    if (prompt) {
      setSelectedPrompt(prompt);
      initializePlaceholders(prompt);
      setFormattedPrompt('');
      setGeneratedContent('');
    }
  };

  const handlePlaceholderChange = (placeholder, value) => {
    setPlaceholderValues(prev => ({
      ...prev,
      [placeholder]: value
    }));
  };

  const handleFormatPrompt = () => {
    if (!selectedPrompt) {
      alert('Please select a prompt first.');
      return;
    }

    const formatted = formatPromptText(selectedPrompt.prompt_text, placeholderValues);
    setFormattedPrompt(formatted);
  };

  const handleCopyPrompt = () => {
    if (formattedPrompt) {
      navigator.clipboard.writeText(formattedPrompt);
      alert('Formatted prompt copied to clipboard!');
    }
  };

  const handleGenerateWithAI = async () => {
    if (!formattedPrompt) {
      alert('Please format the prompt first.');
      return;
    }

    if (!apiKey) {
      setShowApiKeyInput(true);
      alert('Please enter your API key to generate content.');
      return;
    }

    setLoading(true);
    setGeneratedContent('');

    try {
      // This is a template - you'll need to adapt this to your specific AI service
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedPrompt.ai_model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: formattedPrompt }],
          temperature: selectedPrompt.temperature || 0.7,
          max_tokens: selectedPrompt.max_tokens || 1000
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      setGeneratedContent(content);

      // Increment usage count
      await incrementUsage(selectedPrompt.id);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Error generating content: ' + error.message + '\n\nNote: This is a template. Please configure your AI API endpoint and key.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyGenerated = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent);
      alert('Generated content copied to clipboard!');
    }
  };

  const handleReset = () => {
    setPlaceholderValues({});
    setFormattedPrompt('');
    setGeneratedContent('');
    if (selectedPrompt) {
      initializePlaceholders(selectedPrompt);
    }
  };

  const placeholders = selectedPrompt ? extractPlaceholders(selectedPrompt.prompt_text) : [];

  return (
    <div className="prompt-generator">
      <div className="header">
        <div>
          <h1>AI Prompt Generator</h1>
          <p>Use prompts to generate content with AI</p>
        </div>
        <button className="secondary" onClick={() => navigate('/prompts')}>
          ← Back to Library
        </button>
      </div>

      {/* Prompt Selection */}
      <div className="panel">
        <h3>1. Select a Prompt</h3>
        <select 
          value={selectedPrompt?.id || ''} 
          onChange={handlePromptSelect}
          disabled={location.state?.prompt}
        >
          <option value="">Choose a prompt...</option>
          {prompts.filter(p => p.is_active).map(prompt => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.title} ({prompt.prompt_type})
            </option>
          ))}
        </select>

        {selectedPrompt && (
          <div className="selected-prompt-info">
            <div className="info-item">
              <strong>Type:</strong> {selectedPrompt.prompt_type?.replace(/_/g, ' ')}
            </div>
            {selectedPrompt.subject && (
              <div className="info-item">
                <strong>Subject:</strong> {selectedPrompt.subject}
              </div>
            )}
            {selectedPrompt.grade_level && (
              <div className="info-item">
                <strong>Grade:</strong> {selectedPrompt.grade_level}
              </div>
            )}
            <div className="info-item">
              <strong>Original Prompt:</strong>
              <div className="prompt-preview">{selectedPrompt.prompt_text}</div>
            </div>
          </div>
        )}
      </div>

      {/* Fill Placeholders */}
      {selectedPrompt && placeholders.length > 0 && (
        <div className="panel">
          <h3>2. Fill in Variables</h3>
          <div className="placeholders-form">
            {placeholders.map(placeholder => (
              <div key={placeholder} className="form-group">
                <label htmlFor={placeholder}>
                  {placeholder.replace(/_/g, ' ').toUpperCase()}
                </label>
                <input
                  id={placeholder}
                  type="text"
                  placeholder={`Enter ${placeholder}...`}
                  value={placeholderValues[placeholder] || ''}
                  onChange={(e) => handlePlaceholderChange(placeholder, e.target.value)}
                />
              </div>
            ))}
          </div>
          <button onClick={handleFormatPrompt}>Format Prompt</button>
          <button className="secondary" onClick={handleReset}>Reset</button>
        </div>
      )}

      {/* Formatted Prompt */}
      {formattedPrompt && (
        <div className="panel">
          <h3>3. Formatted Prompt</h3>
          <div className="formatted-output">
            {formattedPrompt}
          </div>
          <div className="actions">
            <button onClick={handleCopyPrompt}>Copy Prompt</button>
            <button className="secondary" onClick={handleGenerateWithAI}>
              🤖 Generate with AI
            </button>
          </div>
        </div>
      )}

      {/* API Key Input */}
      {showApiKeyInput && (
        <div className="panel api-key-section">
          <h3>API Configuration</h3>
          <p className="help-text">
            Enter your OpenAI API key (or configure for other AI services)
          </p>
          <input
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <small>Your API key is stored locally and never sent to our servers.</small>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="panel loading-panel">
          <div className="spinner"></div>
          <p>Generating content with AI...</p>
        </div>
      )}

      {/* Generated Content */}
      {generatedContent && (
        <div className="panel">
          <h3>4. Generated Content</h3>
          <div className="generated-output">
            <pre>{generatedContent}</pre>
          </div>
          <div className="actions">
            <button onClick={handleCopyGenerated}>Copy Content</button>
            <button className="secondary" onClick={handleReset}>
              Generate Another
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!selectedPrompt && (
        <div className="panel instructions">
          <h3>📝 How to Use</h3>
          <ol>
            <li>Select a prompt from the dropdown above</li>
            <li>Fill in the required variables (placeholders)</li>
            <li>Click "Format Prompt" to see the complete prompt</li>
            <li>Either copy the prompt or use "Generate with AI" to get content</li>
            <li>Copy the generated content or generate another variation</li>
          </ol>
          
          <div className="note">
            <strong>Note:</strong> To use AI generation, you'll need to configure your API key.
            The formatted prompt can always be copied and used with any AI service manually.
          </div>
        </div>
      )}
    </div>
  );
}
