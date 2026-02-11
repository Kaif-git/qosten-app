import React, { useState } from 'react';
import { parseLessonText, validateLesson } from '../../utils/lessonParser';
import { lessonApi } from '../../services/lessonApi';
import './LessonsImport.css';

const EXAMPLE_LESSON = `Subject: Biology
Chapter: Reproduction

### **Topic: Plant Anatomy - The Flower**

A flower is described in the sources as a **specialised modified shoot** specifically designed for the purpose of reproduction in higher plants.

---

#### **Subtopic 1: The Thalamus**
*   **Definition:** The usually **round tip of the floral axis** from which the various parts of the flower develop.
*   **Explanation:** It acts as the physical base or receptacle. All other floral whorls (calyx, corolla, androecium, and gynoecium) are arranged consecutively on this axis, one after the other.
*   **Memorizing/Understanding shortcut:** Thalamus = **"The Throne"** (The seat where all the flower parts sit).
*   **Common Misconceptions/Mistake:** Thinking it is a reproductive organ; it is actually a non-essential part that provides structural support.
*   **Difficulty:** Easy.

---

### **Review Questions & Answers: Plant Anatomy**

**Q1: Why is a flower technically considered a "modified shoot"?**
a) Because it grows from the root
b) Because it is adapted for reproduction
c) Because it has leaves
d) Because it grows in summer
**Correct: b**
**Explanation:** It is a shoot that has been specifically adapted and modified by the plant for the specialized purpose of reproduction.

**Q2: What is the main function of the Calyx?**
a) Reproduction
b) Attracting insects
c) Protection
d) Photosynthesis
**Correct: c**
**Explanation:** Its primary function is to protect the internal parts of the flower from environmental factors.`;

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
          <h3>Preview: {parsedData.subject} - {parsedData.chapter}</h3>
          {parsedData.topics.map((topic, tIdx) => (
            <div key={tIdx} className="topic-preview">
              <h4>Topic: {topic.title}</h4>
              
              <div className="subtopics-preview">
                <h5>Subtopics ({topic.subtopics.length})</h5>
                <ul>
                  {topic.subtopics.map((st, sIdx) => (
                    <li key={sIdx}>
                      <strong>{st.title}</strong> - {st.definition?.substring(0, 50)}...
                    </li>
                  ))}
                </ul>
              </div>

              <div className="questions-preview">
                <h5>Questions ({topic.questions.length})</h5>
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

          <button className="upload-btn" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? uploadStatus : 'Upload to Database'}
          </button>
        </div>
      )}
    </div>
  );
}