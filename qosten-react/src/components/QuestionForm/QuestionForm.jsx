import React, { useState, useEffect } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { useNavigate } from 'react-router-dom';
import QuestionPreview from '../QuestionPreview/QuestionPreview';

export default function QuestionForm() {
  const { editingQuestion, addQuestion, updateQuestion, setEditingQuestion } = useQuestions();
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  
  const [formData, setFormData] = useState({
    type: 'mcq',
    subject: '',
    chapter: '',
    lesson: '',
    board: '',
    language: 'en',
    questionText: '',
    options: [
      { label: 'a', text: '', image: null },
      { label: 'b', text: '', image: null },
      { label: 'c', text: '', image: null },
      { label: 'd', text: '', image: null }
    ],
    correctAnswer: '',
    explanation: '',
    parts: [
      { letter: 'a', text: '', marks: 0, answer: '' },
      { letter: 'b', text: '', marks: 0, answer: '' },
      { letter: 'c', text: '', marks: 0, answer: '' },
      { letter: 'd', text: '', marks: 0, answer: '' }
    ],
    sqAnswer: '',
    image: null
  });
  
  // Load editing question data on mount
  useEffect(() => {
    if (editingQuestion) {
      setFormData({
        type: editingQuestion.type || 'mcq',
        subject: editingQuestion.subject || '',
        chapter: editingQuestion.chapter || '',
        lesson: editingQuestion.lesson || '',
        board: editingQuestion.board || '',
        language: editingQuestion.language || 'en',
        questionText: editingQuestion.questionText || editingQuestion.question || '',
        options: editingQuestion.options || [
          { label: 'a', text: '', image: null },
          { label: 'b', text: '', image: null },
          { label: 'c', text: '', image: null },
          { label: 'd', text: '', image: null }
        ],
        correctAnswer: editingQuestion.correctAnswer || '',
        explanation: editingQuestion.explanation || '',
        parts: editingQuestion.parts || [
          { letter: 'a', text: '', marks: 0, answer: '' },
          { letter: 'b', text: '', marks: 0, answer: '' },
          { letter: 'c', text: '', marks: 0, answer: '' },
          { letter: 'd', text: '', marks: 0, answer: '' }
        ],
        sqAnswer: editingQuestion.answer || '',
        image: editingQuestion.image
      });
    }
  }, [editingQuestion]);
  
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleOptionChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? { ...option, [field]: value } : option
      )
    }));
  };
  
  const handlePartChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.map((part, i) => 
        i === index ? { ...part, [field]: value } : part
      )
    }));
  };
  
  const handleImageUpload = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, image: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.questionText.trim()) {
      alert('Please enter a question.');
      return;
    }
    
    // Prepare question data for preview
    const questionData = prepareQuestionData();
    if (!questionData) {
      return; // Validation failed in prepareQuestionData
    }
    
    // Show preview
    setPreviewQuestion(questionData);
    setShowPreview(true);
  };
  
  const prepareQuestionData = () => {
    let questionData = {
      type: formData.type,
      subject: formData.subject,
      chapter: formData.chapter,
      lesson: formData.lesson,
      board: formData.board,
      language: formData.language,
      image: formData.image
    };
    
    if (formData.type === 'mcq') {
      questionData = {
        ...questionData,
        question: formData.questionText,
        options: formData.options.filter(opt => opt.text.trim()),
        correctAnswer: formData.correctAnswer,
        explanation: formData.explanation
      };
      
      if (!formData.correctAnswer) {
        alert('Please select the correct answer.');
        return null;
      }
    } else if (formData.type === 'cq') {
      questionData = {
        ...questionData,
        questionText: formData.questionText,
        parts: formData.parts.filter(part => part.text.trim())
      };
    } else if (formData.type === 'sq') {
      questionData = {
        ...questionData,
        question: formData.questionText,
        answer: formData.sqAnswer
      };
      
      if (!formData.sqAnswer.trim()) {
        alert('Please enter an answer for the short question.');
        return null;
      }
    }
    
    return questionData;
  };
  
  const confirmAddQuestion = async (editedQuestions) => {
    // Get the first (and only) question from the array
    const editedQuestion = editedQuestions[0];
    
    try {
      if (editingQuestion) {
        await updateQuestion({ ...editedQuestion, id: editingQuestion.id });
        alert('Question updated successfully!');
      } else {
        await addQuestion(editedQuestion);
        alert('Question added successfully!');
      }
    } catch (error) {
      alert(error.message);
      setShowPreview(false);
      return;
    }
    
    // Reset form and navigate back
    setShowPreview(false);
    resetForm();
    navigate('/bank');
  };
  
  const cancelPreview = () => {
    setShowPreview(false);
    setPreviewQuestion(null);
  };
  
  const resetForm = () => {
    setFormData({
      type: 'mcq',
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      language: 'en',
      questionText: '',
      options: [
        { label: 'a', text: '', image: null },
        { label: 'b', text: '', image: null },
        { label: 'c', text: '', image: null },
        { label: 'd', text: '', image: null }
      ],
      correctAnswer: '',
      explanation: '',
      parts: [
        { letter: 'a', text: '', marks: 0, answer: '' },
        { letter: 'b', text: '', marks: 0, answer: '' },
        { letter: 'c', text: '', marks: 0, answer: '' },
        { letter: 'd', text: '', marks: 0, answer: '' }
      ],
      sqAnswer: '',
      image: null
    });
    setEditingQuestion(null);
  };
  
  const cancelEdit = () => {
    resetForm();
    navigate('/bank');
  };

  return (
    <>
      {showPreview && previewQuestion && (
        <QuestionPreview
          questions={[previewQuestion]}
          onConfirm={confirmAddQuestion}
          onCancel={cancelPreview}
        />
      )}
      
      <div className={`panel editing-${formData.type}`}>
        <h2>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h2>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="questionType">Question Type:</label>
          <select 
            id="questionType" 
            value={formData.type} 
            onChange={(e) => handleInputChange('type', e.target.value)}
          >
            <option value="mcq">MCQ</option>
            <option value="cq">CQ</option>
            <option value="sq">SQ</option>
          </select>
        </div>
        
        <div className="metadata-fields">
          <div>
            <label htmlFor="subject">Subject:</label>
            <input 
              type="text" 
              id="subject" 
              placeholder="e.g., Mathematics"
              value={formData.subject}
              onChange={(e) => handleInputChange('subject', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="chapter">Chapter:</label>
            <input 
              type="text" 
              id="chapter" 
              placeholder="e.g., Algebra"
              value={formData.chapter}
              onChange={(e) => handleInputChange('chapter', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="lesson">Lesson:</label>
            <input 
              type="text" 
              id="lesson" 
              placeholder="e.g., Linear Equations"
              value={formData.lesson}
              onChange={(e) => handleInputChange('lesson', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="board">Board:</label>
            <input 
              type="text" 
              id="board" 
              placeholder="e.g., DB24, JB21, SB20"
              value={formData.board}
              onChange={(e) => handleInputChange('board', e.target.value)}
            />
          </div>
        </div>
        
        <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f8ff', border: '2px dashed #007bff', borderRadius: '6px' }}>
          <label htmlFor="questionImage" style={{ display: 'block', fontWeight: '600', color: '#007bff', marginBottom: '10px' }}>
            {formData.type === 'cq' ? 'Question Stem Image (Optional):' : 'Question Image (Optional):'}
          </label>
          <input 
            type="file" 
            id="questionImage"
            accept="image/*"
            onChange={(e) => handleImageUpload(e.target.files[0])}
            style={{ display: 'block', width: '100%', padding: '8px', fontSize: '14px', cursor: 'pointer' }}
          />
          {formData.image && (
            <div style={{ marginTop: '15px' }}>
              <img 
                src={formData.image} 
                alt="Question" 
                style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'block', marginBottom: '10px' }}
              />
              <button 
                type="button" 
                onClick={removeImage}
                style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                ✕ Remove Image
              </button>
            </div>
          )}
        </div>
        
        <div>
          <label htmlFor="questionText">Question:</label>
          <textarea 
            id="questionText" 
            placeholder="Enter your question here..."
            value={formData.questionText}
            onChange={(e) => handleInputChange('questionText', e.target.value)}
            required
          />
        </div>
        
        {/* MCQ Options */}
        <div className="mcq-only">
          <div>
            <label>Options:</label>
            <div className="option-fields">
              {formData.options.map((option, index) => (
                <div key={option.label}>
                  <input 
                    type="text" 
                    placeholder={`Option ${option.label})`} 
                    value={option.text}
                    onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="correctAnswer">Correct Answer:</label>
            <select 
              id="correctAnswer" 
              value={formData.correctAnswer} 
              onChange={(e) => handleInputChange('correctAnswer', e.target.value)}
            >
              <option value="">Select correct answer</option>
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="c">C</option>
              <option value="d">D</option>
            </select>
          </div>
          <div>
            <label htmlFor="explanation">Explanation:</label>
            <textarea 
              id="explanation" 
              placeholder="Enter explanation (optional)..."
              value={formData.explanation}
              onChange={(e) => handleInputChange('explanation', e.target.value)}
            />
          </div>
        </div>
        
        {/* CQ Parts */}
        <div className="cq-only">
          <div>
            <label>Question Parts:</label>
            <div className="option-fields">
              {formData.parts.map((part, index) => (
                <div key={part.letter}>
                  <input 
                    type="text" 
                    placeholder={`Part ${part.letter}) text`} 
                    value={part.text}
                    onChange={(e) => handlePartChange(index, 'text', e.target.value)}
                  />
                  <input 
                    type="number" 
                    placeholder="Marks" 
                    min="0"
                    value={part.marks}
                    onChange={(e) => handlePartChange(index, 'marks', parseInt(e.target.value) || 0)}
                    style={{width: '80px', marginTop: '5px'}}
                  />
                  <textarea 
                    placeholder={`Answer for part ${part.letter}`} 
                    value={part.answer}
                    onChange={(e) => handlePartChange(index, 'answer', e.target.value)}
                    style={{minHeight: '80px', marginTop: '5px'}}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* SQ Answer */}
        <div className="sq-only">
          <div>
            <label htmlFor="sqAnswer">Answer:</label>
            <textarea 
              id="sqAnswer" 
              className="sq-answer" 
              placeholder="Enter the answer to the short question here..."
              value={formData.sqAnswer}
              onChange={(e) => handleInputChange('sqAnswer', e.target.value)}
            />
          </div>
        </div>
        
        
        <div style={{marginTop: '20px'}}>
          <button type="submit">{editingQuestion ? 'Update Question' : 'Save Question'}</button>
          {editingQuestion && (
            <button type="button" className="danger" onClick={cancelEdit}>Cancel Edit</button>
          )}
        </div>
      </form>
      </div>
    </>
  );
}
