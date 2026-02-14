import React, { useState } from 'react';
import { parseLessonText, validateLesson } from '../../utils/lessonParser';
import { lessonApi } from '../../services/lessonApi';
import './LessonsImport.css';

const EXAMPLE_LESSON = `Subject: Biology Chapter: Reproduction
### **Topic: Plant Anatomy - The Flower**
A flower is a specialised modified shoot specifically designed for reproduction.

**Subtopic 1: The Thalamus**
*   **Definition:** The round tip of the floral axis.
*   **Explanation:** Acts as the physical base.
*   **Memorizing/Understanding shortcut:** Thalamus = "The Throne".
*   **Difficulty:** Easy.

---

### **Review Questions & Answers: Plant Anatomy**
**Q1: Why is a flower a "modified shoot"?**
a) Grows from root
b) Adapted for reproduction
**Correct: b**
**Explanation:** Specifically adapted for reproduction.

Subject: Biology
Chapter: Transport in Organisms
### **Topic: Plant and Water Relationship**
Water is the "fluid of life".

**Subtopic 1: Imbibition**
*   **Definition:** Absorption of liquid by colloidal substances.
*   **Difficulty:** Easy.
`;

export default function LessonsImport() {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleParse = () => {
    try {
      const data = parseLessonText(inputText);
      const validation = validateLesson(data);
      
      if (!validation.valid) {
        alert(`Validation Errors:\n${validation.errors.join('\n')}`);
        return;
      }
      
      setParsedData(data);
      console.log('Parsed Lesson Data:', data);
    } catch (error) {
      alert('Parsing Error: ' + error.message);
    }
  };

  const handleUpload = async () => {
    if (!parsedData) return;
    
    setIsUploading(true);
    setUploadStatus('Uploading to Supabase...');
    
    try {
      const result = await lessonApi.uploadLesson(parsedData);
      
      let message = `Upload Successful!\n\n` +
        `- Chapters: ${result.chaptersProcessed}\n` +
        `- Topics: ${result.topicsCreated}\n` +
        `- Subtopics: ${result.subtopicsCreated}\n` +
        `- Questions: ${result.questionsCreated}`;
        
      if (result.errors.length > 0) {
        message += `\n\nErrors encountered:\n${result.errors.join('\n')}`;
      }
      
      alert(message);
      setParsedData(null);
      setInputText('');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  return (
    <div className="lessons-import-container panel">
      <h2>Import Lessons</h2>
      <p>Paste your lesson content in the specified markdown format.</p>
      
      <div className="example-box">
        <details>
          <summary>View Example Format</summary>
          <pre>{EXAMPLE_LESSON}</pre>
        </details>
      </div>

      <textarea
        className="lesson-input"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Paste lesson content here..."
      />

      <div className="button-group">
        <button onClick={handleParse} disabled={!inputText.trim() || isUploading}>
          Parse Lesson
        </button>
        <button className="danger" onClick={() => setInputText('')} disabled={isUploading}>
          Clear
        </button>
      </div>

      {parsedData && (
        <div className="preview-section">
          <h3>Preview: {parsedData.length} Chapter(s)</h3>
          
          {parsedData.map((chapterData, cIdx) => {
            const totalSubtopics = chapterData.topics.reduce((sum, t) => sum + t.subtopics.length, 0);
            const totalQuestions = chapterData.topics.reduce((sum, t) => sum + t.questions.length, 0);
            
            return (
              <div key={cIdx} className="chapter-preview panel">
                <div className="chapter-preview-header">
                  <h4>{chapterData.subject} - {chapterData.chapter}</h4>
                  <div className="chapter-preview-stats">
                    <span>{chapterData.topics.length} Lessons</span>
                    <span>{totalSubtopics} Subtopics</span>
                    <span>{totalQuestions} Questions</span>
                  </div>
                </div>
                
                {chapterData.topics.map((topic, tIdx) => (
                <div key={tIdx} className="topic-preview">
                  <h5>Topic: {topic.title}</h5>
                  
                  <div className="subtopics-preview">
                    <h6>Subtopics ({topic.subtopics.length})</h6>
                    <ul>
                      {topic.subtopics.map((st, sIdx) => (
                        <li key={sIdx}>
                          <strong>{st.title}</strong> - {st.definition?.substring(0, 50)}...
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="questions-preview">
                    <h6>Questions ({topic.questions.length})</h6>
                    <div className="questions-list-preview">
                      {topic.questions.map((q, qIdx) => (
                        <div key={qIdx} className="q-preview-item">
                          <p><strong>Q: {q.question}</strong></p>
                          <ul className="options-preview">
                            {q.options.map((opt, oIdx) => (
                              <li key={oIdx} className={q.correct_answer === opt.label ? 'correct' : ''}>
                                {opt.label}) {opt.text}
                              </li>
                            ))}
                          </ul>
                          {q.explanation && <p className="exp-preview"><em>Exp: {q.explanation}</em></p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <button className="upload-btn" onClick={handleUpload} disabled={isUploading}>
          {isUploading ? uploadStatus : 'Upload All to Database'}
        </button>
      </div>
    )}
  </div>
);
}