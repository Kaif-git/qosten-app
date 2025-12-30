import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { useNavigate } from 'react-router-dom';

export default function CQJSONImport() {
  const { batchAddQuestions, questions: existingQuestions } = useQuestions();
  const [fileContent, setFileContent] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          if (!Array.isArray(json)) {
            alert('JSON must be an array of questions.');
            setFileContent(null);
            return;
          }

          // 1. Only parse CQs
          const cqOnly = json.filter(q => (q.type || '').toLowerCase() === 'cq');
          
          // 2. Skip existing questions
          // Create sets for O(1) lookup
          const existingIds = new Set(existingQuestions.map(q => q.id?.toString()));
          const existingTexts = new Set(existingQuestions.map(q => (q.questionText || q.question || '').trim().toLowerCase()));

          const newCQs = cqOnly.filter(q => {
            const idMatch = q.id && existingIds.has(q.id.toString());
            const text = (q.questionText || q.question || '').trim().toLowerCase();
            const textMatch = text && existingTexts.has(text);
            return !idMatch && !textMatch;
          });

          setFileContent(newCQs);
          setImportSummary({
            total: json.length,
            cqCount: cqOnly.length,
            newCount: newCQs.length,
            skipped: cqOnly.length - newCQs.length,
            nonCQ: json.length - cqOnly.length
          });

        } catch (err) {
          console.error('JSON Parse Error:', err);
          alert('Invalid JSON file.');
          setFileContent(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const startUpload = async () => {
    if (!fileContent || fileContent.length === 0) {
      alert('No new CQ questions to upload.');
      return;
    }

    setIsUploading(true);
    setProgress({ current: 0, total: fileContent.length });

    try {
      await batchAddQuestions(fileContent, (current, total) => {
        setProgress({ current, total });
      });
      alert(`Successfully imported ${fileContent.length} new CQ questions!`);
      navigate('/bank');
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Something went wrong during upload. Check the console.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="panel">
      <h2>📦 Import CQ Questions (JSON)</h2>
      <p>
        Upload a JSON file. This tool will <strong>only</strong> parse CQ questions 
        and will <strong>skip</strong> any that already exist in your bank.
      </p>
      
      <div style={{ margin: '20px 0', padding: '20px', border: '2px dashed #ccc', borderRadius: '10px', textAlign: 'center' }}>
        <input 
          type="file" 
          accept=".json" 
          onChange={handleFileChange} 
          style={{ display: 'none' }} 
          id="json-upload"
        />
        <label htmlFor="json-upload" style={{ cursor: 'pointer', color: '#3498db', fontWeight: 'bold' }}>
          {fileName ? `Selected: ${fileName}` : 'Click to select JSON file'}
        </label>
        
        {importSummary && (
          <div style={{ marginTop: '15px', textAlign: 'left', display: 'inline-block', backgroundColor: '#fff', padding: '10px', borderRadius: '5px', border: '1px solid #eee' }}>
            <div style={{ color: '#666' }}>Total items in file: <strong>{importSummary.total}</strong></div>
            <div style={{ color: '#2980b9' }}>CQ questions found: <strong>{importSummary.cqCount}</strong></div>
            {importSummary.nonCQ > 0 && <div style={{ color: '#e67e22', fontSize: '12px' }}>• Ignored {importSummary.nonCQ} non-CQ items</div>}
            <div style={{ color: '#27ae60', marginTop: '5px', borderTop: '1px solid #eee', paddingTop: '5px' }}>
              <strong>{importSummary.newCount}</strong> new questions to import
            </div>
            {importSummary.skipped > 0 && <div style={{ color: '#7f8c8d', fontSize: '12px' }}>• Skipped {importSummary.skipped} duplicates</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={startUpload} 
          disabled={!fileContent || isUploading}
          style={{ backgroundColor: '#27ae60', color: 'white' }}
        >
          {isUploading ? 'Uploading...' : 'Start Import'}
        </button>
        <button 
          className="danger" 
          onClick={() => { setFileContent(null); setFileName(''); }}
          disabled={isUploading}
        >
          Clear
        </button>
      </div>

      {isUploading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '400px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Importing Questions...</h3>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#27ae60'
            }}>
              {progress.current} / {progress.total}
            </div>
            <div style={{
              width: '100%',
              height: '30px',
              backgroundColor: '#e0e0e0',
              borderRadius: '15px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}>
              <div style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#27ae60',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              {Math.round((progress.current / progress.total) * 100)}% Complete
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
