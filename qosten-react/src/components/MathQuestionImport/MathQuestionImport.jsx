import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import QuestionPreview from '../QuestionPreview/QuestionPreview';
import { parseMathQuestions, getMathQuestionExample } from '../../utils/mathQuestionParser';

export default function MathQuestionImport() {
  const { bulkAddQuestions, setLastBatch, getLastBatchQuestions, lastBatch, updateQuestion } = useQuestions();
  const [inputText, setInputText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [failedQuestions, setFailedQuestions] = useState([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showBatchInspector, setShowBatchInspector] = useState(false);

  const parseQuestions = () => {
    if (!inputText.trim()) {
      alert('Please enter questions to parse.');
      return;
    }

    try {
      const questions = parseMathQuestions(inputText);
      
      if (questions.length === 0) {
        alert('No valid questions found. Please check the format.');
        return;
      }

      setParsedQuestions(questions);
      setShowPreview(true);
    } catch (error) {
      console.error('Error parsing questions:', error);
      alert(`Parsing error: ${error.message}`);
    }
  };

  const confirmAddQuestions = async (editedQuestions) => {
    setIsAdding(true);
    setProgress({ current: 0, total: editedQuestions.length });
    setFailedQuestions([]);
    
    try {
      const result = await bulkAddQuestions(editedQuestions, (current, total) => {
        setProgress({ current, total });
      });

      setIsAdding(false);
      setProgress({ current: 0, total: 0 });
      
      // Show error modal if there are failures
      if (result.errors.length > 0) {
        setFailedQuestions(result.errors.map((err, idx) => ({
            index: idx + 1,
            question: 'Check console for details',
            error: err.error || 'Unknown error',
            metadata: 'Bulk upload error'
        })));
        setShowErrorModal(true);
      }
      
      // Show success/summary message
      let message = `✅ Successfully added ${result.successCount} math question(s) to the question bank!`;
      if (result.failedCount > 0) {
        message += `\n❌ ${result.failedCount} question(s) failed to upload. See details in the notification.`;
      }
      alert(message);
      
      setShowPreview(false);
      
      if (result.successCount > 0) {
        setInputText('');
        setParsedQuestions([]);
      }
    } catch (error) {
      console.error('Error in bulk add:', error);
      alert('Failed to add questions: ' + error.message);
      setIsAdding(false);
    }
  };

  const cancelPreview = () => {
    setShowPreview(false);
  };

  const clearInput = () => {
    setInputText('');
    setParsedQuestions([]);
  };

  const inspectLastBatch = () => {
    const batchQuestions = getLastBatchQuestions();
    if (batchQuestions.length === 0) {
      alert('No batch to inspect. Add some questions first!');
      return;
    }
    setShowBatchInspector(true);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  return (
    <>
      {showPreview && parsedQuestions.length > 0 && (
        <QuestionPreview
          questions={parsedQuestions}
          onConfirm={confirmAddQuestions}
          onCancel={cancelPreview}
        />
      )}
      
      {isAdding && (
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
            <h3 style={{ marginBottom: '20px' }}>Adding Questions to Database</h3>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '15px',
              color: '#e67e22'
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
                backgroundColor: '#e67e22',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ color: '#666', fontSize: '14px' }}>
              {Math.round((progress.current / progress.total) * 100)}% Complete
            </div>
          </div>
        </div>
      )}
      
      {showErrorModal && failedQuestions.length > 0 && (
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
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #e74c3c',
              paddingBottom: '10px'
            }}>
              <h3 style={{ margin: 0, color: '#e74c3c' }}>
                ❌ Failed to Upload {failedQuestions.length} Question{failedQuestions.length > 1 ? 's' : ''}
              </h3>
              <button 
                onClick={() => setShowErrorModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#666', marginBottom: '15px' }}>
                The following questions encountered errors and were not added to the database:
              </p>
              
              {failedQuestions.map((failed, idx) => (
                <div key={idx} style={{
                  border: '1px solid #ffdddd',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '15px',
                  backgroundColor: '#fff5f5'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#e74c3c' }}>
                      Question #{failed.index}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {failed.metadata}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#333',
                    marginBottom: '8px',
                    fontStyle: 'italic'
                  }}>
                    {failed.question}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#c0392b',
                    backgroundColor: '#ffe6e6',
                    padding: '8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}>
                    <strong>Error:</strong> {failed.error}
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => setShowErrorModal(false)}
                style={{
                  backgroundColor: '#e67e22',
                  color: 'white',
                  border: 'none',
                  padding: '10px 30px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showBatchInspector && (
        <QuestionPreview
          questions={getLastBatchQuestions()}
          onConfirm={async (editedQuestions) => {
            // Save all edits to the database
            let updatedCount = 0;
            for (const question of editedQuestions) {
              try {
                await updateQuestion(question);
                updatedCount++;
              } catch (error) {
                console.error('Error updating question:', error);
              }
            }
            setShowBatchInspector(false);
            alert(`✅ ${updatedCount} question(s) updated successfully!`);
          }}
          onCancel={() => setShowBatchInspector(false)}
          isEditMode={true}
          title={`Last Batch (${lastBatch.count} questions added on ${formatTimestamp(lastBatch.timestamp)})`}
        />
      )}
      
      <div className="panel">
        <h2>📐 Bulk Import Math Questions with LaTeX</h2>
        <p>Format your math questions like this:</p>
        <pre className="mcq-example">{getMathQuestionExample()}</pre>
        <textarea 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your math questions with LaTeX here..."
          style={{ minHeight: '200px' }}
        />
        <button onClick={parseQuestions}>Parse Questions</button>
        <button className="danger" onClick={clearInput}>Clear</button>
        {lastBatch && lastBatch.count > 0 && (
          <button 
            onClick={inspectLastBatch}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              marginLeft: '10px'
            }}
          >
            🔍 Inspect Last Batch ({lastBatch.count})
          </button>
        )}
        
        {parsedQuestions.length > 0 && !showPreview && (
          <div style={{ marginTop: '20px' }}>
            <h3>Parsed Questions Preview:</h3>
            <p>{parsedQuestions.length} question(s) parsed and ready to add to question bank.</p>
          </div>
        )}
      </div>
    </>
  );
}
