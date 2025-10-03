import React, { useRef } from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function Header() {
  const { questions, setQuestions } = useQuestions();
  const fileInputRef = useRef(null);
  
  const exportQuestions = () => {
    if (questions.length === 0) {
      alert('No questions to export!');
      return;
    }
    
    const dataStr = JSON.stringify(questions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `question-bank-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert(`Exported ${questions.length} questions successfully!`);
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };
  
  const importQuestions = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedQuestions = JSON.parse(e.target.result);
        if (!Array.isArray(importedQuestions)) {
          alert('Invalid file format. Expected an array of questions.');
          return;
        }
        
        // Validate question structure
        const validQuestions = importedQuestions.filter(q => 
          q && typeof q === 'object' && q.type && (q.question || q.questionText)
        );
        
        if (validQuestions.length === 0) {
          alert('No valid questions found in the imported file.');
          return;
        }
        
        // Ask user if they want to replace or merge
        const shouldReplace = window.confirm(
          `Found ${validQuestions.length} valid questions.\n\n` +
          'Choose OK to REPLACE all existing questions, or Cancel to MERGE with existing questions.'
        );
        
        if (shouldReplace) {
          setQuestions(validQuestions);
          alert(`Replaced question bank with ${validQuestions.length} questions.`);
        } else {
          // Merge - add unique questions
          const existingIds = new Set(questions.map(q => q.id));
          let addedCount = 0;
          
          validQuestions.forEach(importedQ => {
            if (!existingIds.has(importedQ.id)) {
              questions.push({ ...importedQ, id: importedQ.id || Date.now().toString() + Math.random() });
              addedCount++;
            }
          });
          
          setQuestions([...questions]);
          alert(`Added ${addedCount} new questions to the existing bank.`);
        }
        
      } catch (error) {
        console.error('Error importing questions:', error);
        alert('Error reading file. Please ensure it\'s a valid JSON file.');
      }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };
  
  return (
    <div className="header" style={{display:'flex', flexDirection:'column', marginBottom:20}}>
      <h1>Advanced Question Bank with Images</h1>
      <div>
        <button className="secondary" onClick={exportQuestions}>Export All</button>
        <button className="secondary" onClick={handleImportClick}>Import JSON</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={importQuestions}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
