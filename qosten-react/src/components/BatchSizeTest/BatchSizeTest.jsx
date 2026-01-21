import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function BatchSizeTest() {
  const { addQuestion } = useQuestions();
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  // Generate dummy questions for testing
  const generateDummyQuestions = (count) => {
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        type: 'mcq',
        subject: `Test Subject ${i}`,
        chapter: `Test Chapter ${i}`,
        lesson: `Test Lesson ${i}`,
        board: 'Test Board',
        questionText: `Test question ${i}: What is the answer to this test?`,
        options: [
          { label: 'a', text: 'Option A' },
          { label: 'b', text: 'Option B' },
          { label: 'c', text: 'Option C' },
          { label: 'd', text: 'Option D' }
        ],
        correctAnswer: 'a',
        explanation: `This is test explanation ${i}`,
        language: 'en'
      });
    }
    return questions;
  };

  // Test upload with specific batch size
  const testBatchSize = async (batchSize, questions) => {
    const startTime = performance.now();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      const results = await Promise.allSettled(
        batch.map(question => addQuestion(question))
      );
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
        }
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      batchSize,
      totalQuestions: questions.length,
      successCount,
      errorCount,
      durationMs: Math.round(duration),
      durationSeconds: (duration / 1000).toFixed(2),
      questionsPerSecond: (questions.length / (duration / 1000)).toFixed(2)
    };
  };

  // Run comprehensive test
  const runComprehensiveTest = async () => {
    setIsRunning(true);
    setResults([]);
    
    const questionCount = 50; // Test with 50 questions
    const batchSizes = [1, 3, 5, 10, 15, 20, 25, 30];
    const testResults = [];

    for (const batchSize of batchSizes) {
      setCurrentTest(`Testing batch size ${batchSize}...`);
      
      const questions = generateDummyQuestions(questionCount);
      
      try {
        const result = await testBatchSize(batchSize, questions);
        testResults.push(result);
        console.log(`Batch size ${batchSize}:`, result);
      } catch (error) {
        console.error(`Error testing batch size ${batchSize}:`, error);
        testResults.push({
          batchSize,
          error: error.message,
          totalQuestions: questionCount
        });
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setResults(testResults);
    setIsRunning(false);
    setCurrentTest('');
  };

  // Run quick test with specific batch size
  const runQuickTest = async (batchSize) => {
    setIsRunning(true);
    setCurrentTest(`Testing batch size ${batchSize}...`);
    
    const questions = generateDummyQuestions(30);
    
    try {
      const result = await testBatchSize(batchSize, questions);
      setResults([result]);
      console.log(`Batch size ${batchSize}:`, result);
    } catch (error) {
      console.error(`Error testing batch size ${batchSize}:`, error);
    }
    
    setIsRunning(false);
    setCurrentTest('');
  };

  // Find optimal batch size
  const getOptimalBatchSize = () => {
    if (results.length === 0) return null;
    
    const validResults = results.filter(r => !r.error);
    if (validResults.length === 0) return null;
    
    return validResults.reduce((best, current) => {
      if (!best || current.durationMs < best.durationMs) {
        return current;
      }
      return best;
    }, null);
  };

  const optimal = getOptimalBatchSize();

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#3498db' }}>⚡ Batch Size Performance Test</h2>
      
      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #ddd'
      }}>
        <h3 style={{ marginTop: 0 }}>Test Controls</h3>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          This tool tests different batch sizes for uploading questions to find the optimal performance.
        </p>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={runComprehensiveTest}
            disabled={isRunning}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '5px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1,
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            🧪 Run Comprehensive Test
          </button>
          
          <button 
            onClick={() => runQuickTest(5)}
            disabled={isRunning}
            style={{
              backgroundColor: '#9b59b6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '5px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1,
              fontSize: '14px'
            }}
          >
            Quick Test (Batch 5)
          </button>
          
          <button 
            onClick={() => runQuickTest(10)}
            disabled={isRunning}
            style={{
              backgroundColor: '#9b59b6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '5px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1,
              fontSize: '14px'
            }}
          >
            Quick Test (Batch 10)
          </button>
          
          <button 
            onClick={() => runQuickTest(20)}
            disabled={isRunning}
            style={{
              backgroundColor: '#9b59b6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '5px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              opacity: isRunning ? 0.6 : 1,
              fontSize: '14px'
            }}
          >
            Quick Test (Batch 20)
          </button>
        </div>
        
        {isRunning && (
          <div style={{ marginTop: '15px', color: '#3498db', fontWeight: 'bold' }}>
            {currentTest}
          </div>
        )}
      </div>

      {optimal && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#155724', marginTop: 0 }}>
            🏆 Optimal Batch Size: {optimal.batchSize}
          </h3>
          <p style={{ color: '#155724', margin: 0 }}>
            Uploaded {optimal.totalQuestions} questions in {optimal.durationSeconds}s 
            ({optimal.questionsPerSecond} questions/second)
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <h3 style={{ padding: '15px 20px', margin: 0, backgroundColor: '#f8f9fa', borderBottom: '1px solid #ddd' }}>
            📊 Test Results
          </h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#e9ecef' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Batch Size</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Questions</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Success</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Duration (s)</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Speed (q/s)</th>
                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Performance</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => {
                const isOptimal = optimal && result.batchSize === optimal.batchSize;
                const isFastest = optimal && result.durationMs === optimal.durationMs;
                
                return (
                  <tr 
                    key={idx}
                    style={{ 
                      backgroundColor: isOptimal ? '#d4edda' : (idx % 2 === 0 ? 'white' : '#f8f9fa'),
                      fontWeight: isOptimal ? 'bold' : 'normal'
                    }}
                  >
                    <td style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>
                      {result.batchSize} {isOptimal && '🏆'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                      {result.totalQuestions}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                      {result.error ? '❌' : `${result.successCount}/${result.totalQuestions}`}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                      {result.error ? 'Error' : result.durationSeconds}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                      {result.error ? '-' : result.questionsPerSecond}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>
                      {result.error ? result.error : (
                        <div style={{ 
                          width: '100%', 
                          backgroundColor: '#e0e0e0', 
                          borderRadius: '4px',
                          height: '20px',
                          position: 'relative'
                        }}>
                          <div style={{
                            width: `${optimal ? (optimal.durationMs / result.durationMs) * 100 : 100}%`,
                            height: '100%',
                            backgroundColor: isFastest ? '#28a745' : '#3498db',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#fff3cd', 
        border: '1px solid #ffc107',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <strong>⚠️ Note:</strong> This test uploads real questions to your database. 
        You may want to delete the test questions afterwards from the Question Bank.
      </div>
    </div>
  );
}
