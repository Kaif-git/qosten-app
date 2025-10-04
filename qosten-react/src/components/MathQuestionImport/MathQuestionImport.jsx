import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import QuestionPreview from '../QuestionPreview/QuestionPreview';
import { parseMathQuestions, getMathQuestionExample } from '../../utils/mathQuestionParser';

export default function MathQuestionImport() {
  const { addQuestion } = useQuestions();
  const [inputText, setInputText] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

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
    let addedCount = 0;
    let duplicateCount = 0;

    for (const question of editedQuestions) {
      try {
        await addQuestion(question);
        addedCount++;
      } catch (error) {
        if (error.message.includes('Duplicate')) {
          duplicateCount++;
        } else {
          console.error('Error adding question:', error);
        }
      }
    }

    let message = `Successfully added ${addedCount} math question(s) to the question bank!`;
    if (duplicateCount > 0) {
      message += `\n${duplicateCount} duplicate question(s) were skipped.`;
    }
    alert(message);
    
    setShowPreview(false);
    
    if (addedCount > 0) {
      setInputText('');
      setParsedQuestions([]);
    }
  };

  const cancelPreview = () => {
    setShowPreview(false);
  };

  const clearInput = () => {
    setInputText('');
    setParsedQuestions([]);
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
