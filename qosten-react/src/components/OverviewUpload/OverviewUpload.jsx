import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { 
  parseOverviewText, 
  validateOverview, 
  overviewToJSON, 
  EXAMPLE_FORMAT 
} from '../../utils/overviewParser';
import MarkdownContent from '../MarkdownContent/MarkdownContent';

export default function OverviewUpload() {
  const [inputText, setInputText] = useState('');
  const [chapterName, setChapterName] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [language, setLanguage] = useState('en');
  const [parsedData, setParsedData] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const handleParse = () => {
    try {
      setValidationErrors([]);
      setUploadStatus('');
      
      if (!inputText.trim()) {
        setValidationErrors(['Input text is empty']);
        return;
      }

      // Parse the text
      const parsed = parseOverviewText(inputText);
      
      // Validate the parsed data
      const validation = validateOverview(parsed);
      
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setParsedData(null);
        return;
      }

      setParsedData(parsed);
      setShowPreview(true);
      setUploadStatus('✅ Parsed successfully! Review the preview below.');
    } catch (error) {
      setValidationErrors([error.message]);
      setParsedData(null);
    }
  };

  const handleUpload = async () => {
    if (!parsedData) {
      setUploadStatus('❌ No data to upload. Please parse the text first.');
      return;
    }

    if (!chapterName.trim()) {
      setUploadStatus('❌ Please enter a chapter name.');
      return;
    }

    if (!supabase) {
      setUploadStatus('❌ Supabase is not configured.');
      return;
    }

    try {
      setUploadStatus('⏳ Uploading...');

      const { data, error } = await supabase
        .from('chapter_overviews')
        .insert([{
          name: chapterName,
          overview_data: parsedData,
          subject: subject || null,
          grade_level: gradeLevel || null,
          language: language
        }])
        .select();

      if (error) {
        throw error;
      }

      setUploadStatus('✅ Upload successful! Chapter overview has been saved to the database.');
      
      // Clear form after successful upload
      setTimeout(() => {
        setInputText('');
        setChapterName('');
        setSubject('');
        setGradeLevel('');
        setLanguage('en');
        setParsedData(null);
        setShowPreview(false);
        setUploadStatus('');
      }, 3000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus(`❌ Upload failed: ${error.message}`);
    }
  };

  const handleClear = () => {
    setInputText('');
    setParsedData(null);
    setValidationErrors([]);
    setUploadStatus('');
    setShowPreview(false);
  };

  const loadExample = () => {
    setInputText(EXAMPLE_FORMAT);
    setChapterName('Example Chapter');
    setSubject('Physics');
    setGradeLevel('High School');
    setLanguage('en');
  };


  return (
    <div style={{ padding: '20px', maxWidth: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ color: '#2c3e50', marginBottom: '10px' }}>📚 Upload Chapter Overview</h2>
      <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>
        Parse and upload chapter overviews from markdown-formatted text
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: window.innerWidth > 1200 ? '1fr 1fr' : '1fr',
        gap: '20px',
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {/* Left Column - Input */}
        <div>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontWeight: '600', color: '#2c3e50' }}>
                Chapter Overview Text:
              </label>
              <div>
                <button
                  onClick={() => setShowExample(!showExample)}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    marginRight: '5px'
                  }}
                >
                  {showExample ? 'Hide' : 'Show'} Format
                </button>
                <button
                  onClick={loadExample}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Load Example
                </button>
              </div>
            </div>

            {showExample && (
              <div style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                borderRadius: '6px',
                marginBottom: '10px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap'
              }}>
                {EXAMPLE_FORMAT}
              </div>
            )}

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your chapter overview text here..."
              style={{
                width: '100%',
                minHeight: '300px',
                maxHeight: '500px',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #ddd',
                fontSize: '0.95rem',
                fontFamily: 'monospace',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '5px', color: '#2c3e50' }}>
                Chapter Name: *
              </label>
              <input
                type="text"
                value={chapterName}
                onChange={(e) => setChapterName(e.target.value)}
                placeholder="e.g., Physics Chapter 4: Work and Energy"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '0.95rem'
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '5px', color: '#2c3e50' }}>
                Language: *
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '0.95rem',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="en">English</option>
                <option value="bn">বাংলা (Bangla)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '5px', color: '#2c3e50' }}>
                Subject:
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Physics"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '0.95rem'
                }}
              />
            </div>
            <div>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '5px', color: '#2c3e50' }}>
                Grade Level:
              </label>
              <input
                type="text"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="e.g., High School, Grade 10"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #ddd',
                  fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={handleParse}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              🔍 Parse & Preview
            </button>
            <button
              onClick={handleUpload}
              disabled={!parsedData}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: parsedData ? '#27ae60' : '#95a5a6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: parsedData ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              ⬆️ Upload to Database
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '12px 20px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Clear
            </button>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div style={{
              backgroundColor: '#ffe6e6',
              border: '1px solid #ffcccc',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '15px'
            }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#c0392b' }}>❌ Validation Errors:</h4>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.map((error, index) => (
                  <li key={index} style={{ color: '#c0392b', marginBottom: '5px' }}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload Status */}
          {uploadStatus && (
            <div style={{
              backgroundColor: uploadStatus.includes('❌') ? '#ffe6e6' : '#d5f4e6',
              border: `1px solid ${uploadStatus.includes('❌') ? '#ffcccc' : '#b8e6cc'}`,
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '15px',
              color: uploadStatus.includes('❌') ? '#c0392b' : '#27ae60',
              fontWeight: '500'
            }}>
              {uploadStatus}
            </div>
          )}

          {/* JSON Preview */}
          {parsedData && (
            <div>
              <h3 style={{ color: '#2c3e50', marginBottom: '10px' }}>📄 Generated JSON:</h3>
              <pre style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                borderRadius: '6px',
                overflow: 'auto',
                maxHeight: '250px',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {overviewToJSON(parsedData)}
              </pre>
            </div>
          )}
        </div>

        {/* Right Column - Preview */}
        <div>
          {showPreview && parsedData && (
            <div>
              <h3 style={{ color: '#2c3e50', marginBottom: '15px' }}>👁️ Preview:</h3>
              <div style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#fafafa',
                maxHeight: '600px',
                overflowY: 'auto',
                boxSizing: 'border-box'
              }}>
                {parsedData.topics.map((topic, index) => (
                  <div key={topic.id || index} style={{
                    marginBottom: '25px',
                    padding: '15px',
                    backgroundColor: 'white',
                    borderRadius: '6px',
                    borderLeft: '4px solid #3498db'
                  }}>
                    <h4 style={{
                      color: '#2c3e50',
                      marginTop: 0,
                      marginBottom: '12px',
                      fontSize: '1.2rem'
                    }}>
                      {topic.id}: {topic.title}
                    </h4>
                    <MarkdownContent content={topic.content} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {!showPreview && (
            <div style={{
              border: '2px dashed #ddd',
              borderRadius: '8px',
              padding: '40px',
              textAlign: 'center',
              color: '#95a5a6',
              minHeight: '300px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📋</div>
                <p>Preview will appear here after parsing</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
