import React, { useRef } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { questionApi } from '../../services/questionApi';

export default function Header() {
  const { questions, setQuestions, refreshQuestions } = useQuestions();
  const fileInputRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const fetchFullQuestionsData = async () => {
    console.log('Fetching full data for export...');
    try {
        const fullQuestions = await questionApi.fetchAllQuestions();
        console.log(`Fetched ${fullQuestions.length} full questions.`);
        return fullQuestions;
    } catch (e) {
        console.error('Error fetching full questions:', e);
        throw e;
    }
  };
  
  const exportQuestions = async () => {
    // We allow export even if local state is empty, if we fetch from API
    // But usually we want to confirm there is data. 
    // Let's attempt fetch.
    
    setIsExporting(true);
    try {
      const fullQuestions = await fetchFullQuestionsData();
      
      if (fullQuestions.length === 0) {
          alert('No questions found in database to export.');
          return;
      }
      
      const dataStr = JSON.stringify(fullQuestions, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `question-bank-full-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(`Exported ${fullQuestions.length} questions (full data) successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export questions: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const exportQuestionsCSV = async () => {
    setIsExporting(true);
    try {
      const fullQuestions = await fetchFullQuestionsData();
      
      if (fullQuestions.length === 0) {
          alert('No questions found in database to export.');
          return;
      }

      // Define CSV Headers
      const headers = [
        'ID', 'Type', 'Subject', 'Chapter', 'Lesson', 'Board', 
        'Language', 'Question', 'Answer', 'Explanation',
        'Option A', 'Option B', 'Option C', 'Option D',
        'Part A Question', 'Part A Answer', 'Part A Marks',
        'Part B Question', 'Part B Answer', 'Part B Marks',
        'Part C Question', 'Part C Answer', 'Part C Marks',
        'Part D Question', 'Part D Answer', 'Part D Marks',
        'Flagged', 'Verified'
      ];

      // Helper to escape CSV fields
      const escape = (text) => {
        if (!text && text !== 0) return '';
        const stringText = String(text);
        if (stringText.includes(',') || stringText.includes('"') || stringText.includes('\n')) {
          return `"${stringText.replace(/"/g, '""')}"`;
        }
        return stringText;
      };

      const csvContent = [
        headers.join(','),
        ...fullQuestions.map(q => {
          // Flatten Options (MCQ)
          // The API returns DB format (snake_case likely) or whatever it stores.
          // We should check properties. If we used mapDatabaseToApp on fetch, we'd have camelCase.
          // But fetchAllQuestions returns raw JSON from API.
          // Let's assume the API returns standard JSON keys. 
          // If the API returns snake_case (e.g. question_text), we handle it.
          
          let optA = '', optB = '', optC = '', optD = '';
          if (q.type === 'mcq' && Array.isArray(q.options)) {
            const getOpt = (lbl) => q.options.find(o => o.label === lbl)?.text || '';
            optA = getOpt('a');
            optB = getOpt('b');
            optC = getOpt('c');
            optD = getOpt('d');
          }

          // Flatten Parts (CQ)
          let partA_q = '', partA_a = '', partA_m = '';
          let partB_q = '', partB_a = '', partB_m = '';
          let partC_q = '', partC_a = '', partC_m = '';
          let partD_q = '', partD_a = '', partD_m = '';

          if (q.type === 'cq' && Array.isArray(q.parts)) {
               const getPart = (lbl) => q.parts.find(p => p.letter === lbl || p.label === lbl);
               
               const pA = getPart('a');
               if (pA) { partA_q = pA.text; partA_a = pA.answer; partA_m = pA.marks; }

               const pB = getPart('b');
               if (pB) { partB_q = pB.text; partB_a = pB.answer; partB_m = pB.marks; }

               const pC = getPart('c');
               if (pC) { partC_q = pC.text; partC_a = pC.answer; partC_m = pC.marks; }

               const pD = getPart('d');
               if (pD) { partD_q = pD.text; partD_a = pD.answer; partD_m = pD.marks; }
          }
          
          let answer = q.correct_answer || q.answer || '';
          let questionText = q.question_text || q.question || '';

          return [
            q.id,
            q.type,
            q.subject,
            q.chapter,
            q.lesson,
            q.board,
            q.language,
            questionText,
            answer,
            q.explanation,
            optA, optB, optC, optD,
            partA_q, partA_a, partA_m,
            partB_q, partB_a, partB_m,
            partC_q, partC_a, partC_m,
            partD_q, partD_a, partD_m,
            q.is_flagged ? 'Yes' : 'No',
            q.is_verified ? 'Yes' : 'No'
          ].map(escape).join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `question-bank-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(`Exported ${fullQuestions.length} questions to CSV successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export questions: ' + error.message);
    } finally {
      setIsExporting(false);
    }
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

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshQuestions();
      alert('Questions refreshed successfully from database!');
    } catch (error) {
      console.error('Error refreshing questions:', error);
      alert('Failed to refresh questions. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return (
    <div className="header" style={{display:'flex', flexDirection:'column', marginBottom:20}}>
      <h1>Advanced Question Bank with Images</h1>
      <div>
        <button 
          className="secondary" 
          onClick={exportQuestions}
          disabled={isExporting}
          style={{ opacity: isExporting ? 0.6 : 1 }}
        >
          {isExporting ? '⌛ Exporting JSON...' : 'Export JSON'}
        </button>
        <button 
          className="secondary" 
          onClick={exportQuestionsCSV}
          disabled={isExporting}
          style={{ opacity: isExporting ? 0.6 : 1 }}
        >
          {isExporting ? '⌛ Exporting CSV...' : 'Export CSV'}
        </button>
        <button className="secondary" onClick={handleImportClick}>Import JSON</button>
        <button 
          className="secondary" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            opacity: isRefreshing ? 0.6 : 1,
            cursor: isRefreshing ? 'not-allowed' : 'pointer'
          }}
        >
          {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh from DB'}
        </button>
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