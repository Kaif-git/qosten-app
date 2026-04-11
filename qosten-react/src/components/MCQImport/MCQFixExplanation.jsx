import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { questionApi } from '../../services/questionApi';
import { mapDatabaseToApp } from '../../context/QuestionContext';
import { formatMultipleMCQs } from '../../utils/mcqFormatter';
import { parseMCQQuestions } from '../../utils/mcqQuestionParser';
import { normalizeCircledNumerals } from '../../utils/mcqFixUtils';

export default function MCQFixExplanation() {
  const { bulkUpdateQuestions, refreshQuestions } = useQuestions();
  const [missingExplanationQuestions, setMissingExplanationQuestions] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [updateText, setUpdateText] = useState('');
  const [showUpdateArea, setShowUpdateArea] = useState(false);

  const scanForMissingExplanations = async () => {
    setIsScanning(true);
    setMissingExplanationQuestions([]);
    setScanProgress(0);
    
    try {
      console.log('📡 Starting full scan for MCQ questions with missing explanations...');
      // Use the API directly for the scan to avoid overhead of large local state if needed
      // though fetchAllQuestions returns everything.
      
      const allRawQuestions = await questionApi.fetchAllQuestions((batch) => {
        setScanProgress(prev => prev + batch.length);
      });
      
      console.log(`📊 Scanned ${allRawQuestions.length} questions. Filtering for MCQs with missing explanations...`);
      
      const missingExplanations = allRawQuestions
        .filter(q => q.type === 'mcq' && (!q.explanation || q.explanation.trim() === ''))
        .map(mapDatabaseToApp);
      
      console.log(`✅ Found ${missingExplanations.length} MCQ questions with missing explanations.`);
      setMissingExplanationQuestions(missingExplanations);
      
      if (missingExplanations.length === 0) {
        alert('🎉 No MCQ questions with missing explanations found!');
      } else {
        alert(`✅ Found ${missingExplanations.length} MCQ questions with missing explanations. You can now copy them and fix them.`);
        setShowUpdateArea(true);
      }
    } catch (error) {
      console.error('❌ Scan failed:', error);
      alert('Error scanning questions: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const copyToClipboard = () => {
    const text = formatMultipleMCQs(missingExplanationQuestions);
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 Copied to clipboard! Fix them and paste back below.');
    }, (err) => {
      console.error('Could not copy text: ', err);
      alert('Failed to copy. Please manually select and copy from the box.');
    });
  };

  const handleUpdate = async () => {
    if (!updateText.trim()) {
      alert('Please paste the fixed questions.');
      return;
    }

    setIsUpdating(true);
    try {
      const parsed = parseMCQQuestions(updateText);
      console.log(`📥 Parsed ${parsed.length} questions from fixed text.`);
      
      if (parsed.length === 0) {
        alert('No valid questions found in the pasted text. Please check the format.');
        setIsUpdating(false);
        return;
      }

      // Ensure all questions have IDs for update
      const validForUpdate = parsed.filter(q => q.id);
      if (validForUpdate.length < parsed.length) {
        const confirm = window.confirm(`${parsed.length - validForUpdate.length} questions are missing IDs and will be treated as NEW questions instead of UPDATES. Do you want to proceed?`);
        if (!confirm) {
            setIsUpdating(false);
            return;
        }
      }

      const results = await bulkUpdateQuestions(parsed);
      alert(`✅ Updated ${results.successCount} questions successfully!`);
      
      if (results.failedCount > 0) {
        alert(`❌ Failed to update ${results.failedCount} questions. Check console for details.`);
      }
      
      setUpdateText('');
      setShowUpdateArea(false);
      // Optional: Refresh local state
      // refreshQuestions();
    } catch (error) {
      console.error('❌ Update failed:', error);
      alert('Error updating questions: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFixCircledNumerals = async () => {
    if (!window.confirm('This will scan the entire database and fix all MCQs where the correct answer or options use circled numerals (①, ②, etc.). Continue?')) return;
    
    setIsScanning(true);
    setScanProgress(0);
    
    try {
      console.log('📡 Fetching all questions for circled numeral fix...');
      const allRawQuestions = await questionApi.fetchAllQuestions((batch) => {
        setScanProgress(prev => prev + batch.length);
      });
      
      const mcqs = allRawQuestions
        .filter(q => q.type === 'mcq')
        .map(mapDatabaseToApp);
        
      const fixable = [];
      for (const q of mcqs) {
        const fixed = normalizeCircledNumerals(q);
        if (fixed) {
          fixable.push(fixed);
        }
      }
      
      console.log(`✅ Found ${fixable.length} questions with circled numerals.`);
      
      if (fixable.length === 0) {
        alert('✨ No questions with circled numerals found!');
        return;
      }
      
      if (window.confirm(`Found ${fixable.length} questions to fix. Apply changes now?`)) {
        setIsUpdating(true);
        const results = await bulkUpdateQuestions(fixable);
        alert(`✅ Successfully fixed ${results.successCount} questions!`);
      }
    } catch (error) {
      console.error('❌ Circled numeral fix failed:', error);
      alert('Error: ' + error.message);
    } finally {
      setIsScanning(false);
      setIsUpdating(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: '20px', border: '2px solid #9b59b6' }}>
      <h3>🔧 Fix MCQ Utilities</h3>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Fetch and fix MCQ questions from the database in bulk.
      </p>
      
      {!isScanning && !showUpdateArea && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={scanForMissingExplanations} style={{ backgroundColor: '#9b59b6', color: 'white' }}>
            🔍 Scan Missing Explanations
          </button>
          <button onClick={handleFixCircledNumerals} style={{ backgroundColor: '#e67e22', color: 'white' }}>
            ① Fix Circled Numerals
          </button>
        </div>
      )}

      {isScanning && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <div className="loader" style={{ margin: '0 auto 10px auto' }}></div>
          <p>Scanning... {scanProgress} questions fetched.</p>
        </div>
      )}

      {showUpdateArea && missingExplanationQuestions.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ margin: 0 }}>Step 1: Copy Missing Explanations ({missingExplanationQuestions.length})</h4>
            <button onClick={copyToClipboard} style={{ fontSize: '12px', padding: '5px 10px' }}>
              📋 Copy All
            </button>
          </div>
          <textarea 
            readOnly 
            value={formatMultipleMCQs(missingExplanationQuestions)}
            style={{ minHeight: '150px', backgroundColor: '#f9f9f9', fontSize: '12px', fontFamily: 'monospace' }}
            onClick={(e) => e.target.select()}
          />

          <div style={{ marginTop: '20px' }}>
            <h4>Step 2: Paste Fixed Questions Here</h4>
            <p style={{ fontSize: '12px', color: '#666' }}>
              Paste the questions back here. Make sure the <strong>[ID: ...]</strong> metadata is preserved for each question to ensure they are updated instead of duplicated.
            </p>
            <textarea 
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="Paste fixed questions here (must include original IDs in metadata)..."
              style={{ minHeight: '200px' }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={handleUpdate} 
                disabled={isUpdating || !updateText.trim()}
                style={{ backgroundColor: '#27ae60', color: 'white', flex: 1 }}
              >
                {isUpdating ? 'Updating...' : `💾 Save ${parseMCQQuestions(updateText).length} Updated Explanations`}
              </button>
              <button 
                className="danger" 
                onClick={() => setShowUpdateArea(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
