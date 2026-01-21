import React, { useState, useEffect } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { useNavigate } from 'react-router-dom';
import QuestionPreview from '../QuestionPreview/QuestionPreview';
import { translateEnglishWordsToBangla } from '../../utils/translateToBangla';

export default function QuestionForm() {
  const { editingQuestion, addQuestion, updateQuestion, setEditingQuestion } = useQuestions();
  const navigate = useNavigate();
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
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
    image: null,
    answerimage1: null,
    answerimage2: null,
    answerimage3: null,
    answerimage4: null
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
        image: editingQuestion.image,
        answerimage1: editingQuestion.answerimage1 || null,
        answerimage2: editingQuestion.answerimage2 || null,
        answerimage3: editingQuestion.answerimage3 || null,
        answerimage4: editingQuestion.answerimage4 || null
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
  
  const handleAnswerImage1Upload = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, answerimage1: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeAnswerImage1 = () => {
    setFormData(prev => ({ ...prev, answerimage1: null }));
  };
  
  const handleAnswerImage2Upload = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, answerimage2: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeAnswerImage2 = () => {
    setFormData(prev => ({ ...prev, answerimage2: null }));
  };
  
  const handleAnswerImage3Upload = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, answerimage3: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeAnswerImage3 = () => {
    setFormData(prev => ({ ...prev, answerimage3: null }));
  };
  
  const handleAnswerImage4Upload = (file) => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, answerimage4: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const removeAnswerImage4 = () => {
    setFormData(prev => ({ ...prev, answerimage4: null }));
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
      image: formData.image,
      answerimage1: formData.answerimage1,
      answerimage2: formData.answerimage2,
      answerimage3: formData.answerimage3,
      answerimage4: formData.answerimage4
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
      image: null,
      answerimage1: null,
      answerimage2: null,
      answerimage3: null,
      answerimage4: null
    });
    setEditingQuestion(null);
  };
  
  const cancelEdit = () => {
    resetForm();
    navigate('/bank');
  };
  
  const translateField = async (fieldName) => {
    const fieldValue = formData[fieldName];
    if (!fieldValue || !fieldValue.trim()) {
      alert('Field is empty. Nothing to translate.');
      return;
    }
    
    setIsTranslating(true);
    try {
      const translated = await translateEnglishWordsToBangla(fieldValue);
      handleInputChange(fieldName, translated);
    } catch (error) {
      console.error('Translation error:', error);
      alert('❌ Translation failed. Please try again.');
    } finally {
      setIsTranslating(false);
    }
  };
  
  const translateOption = async (index) => {
    const optionText = formData.options[index].text;
    if (!optionText || !optionText.trim()) {
      return;
    }
    
    setIsTranslating(true);
    try {
      const translated = await translateEnglishWordsToBangla(optionText);
      handleOptionChange(index, 'text', translated);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };
  
  const translatePart = async (index, field) => {
    const partValue = formData.parts[index][field];
    if (!partValue || !partValue.trim()) {
      return;
    }
    
    setIsTranslating(true);
    try {
      const translated = await translateEnglishWordsToBangla(partValue);
      handlePartChange(index, field, translated);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
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
          {formData.language === 'bn' && (
            <button 
              type="button"
              onClick={() => translateField('questionText')}
              disabled={isTranslating || !formData.questionText.trim()}
              style={{ 
                backgroundColor: '#28a745', 
                color: 'white',
                marginTop: '5px',
                padding: '5px 10px',
                fontSize: '12px'
              }}
            >
              {isTranslating ? 'Translating...' : '🌐 Translate to Bangla'}
            </button>
          )}
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
                  {formData.language === 'bn' && option.text.trim() && (
                    <button 
                      type="button"
                      onClick={() => translateOption(index)}
                      disabled={isTranslating}
                      style={{ 
                        backgroundColor: '#28a745', 
                        color: 'white',
                        marginLeft: '5px',
                        padding: '3px 8px',
                        fontSize: '11px'
                      }}
                    >
                      🌐
                    </button>
                  )}
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
            {formData.language === 'bn' && formData.explanation.trim() && (
              <button 
                type="button"
                onClick={() => translateField('explanation')}
                disabled={isTranslating}
                style={{ 
                  backgroundColor: '#28a745', 
                  color: 'white',
                  marginTop: '5px',
                  padding: '5px 10px',
                  fontSize: '12px'
                }}
              >
                {isTranslating ? 'Translating...' : '🌐 Translate to Bangla'}
              </button>
            )}
          </div>
        </div>
        
        {/* CQ Parts */}
        <div className="cq-only">
          {/* Answer Image 1 (for part c) */}
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff3cd', border: '2px dashed #ffc107', borderRadius: '6px' }}>
            <label htmlFor="answerImage1" style={{ display: 'block', fontWeight: '600', color: '#856404', marginBottom: '10px' }}>
              Answer Image 1 (for part c):
            </label>
            {(
              <input 
                type="file" 
                id="answerImage1"
                accept="image/*"
                onChange={(e) => handleAnswerImage1Upload(e.target.files[0])}
                style={{ display: 'block', width: '100%', padding: '8px', fontSize: '14px', cursor: 'pointer' }}
              />
            )}
            {formData.answerimage1 && (
              <div style={{ marginTop: '15px' }}>
                <img 
                  src={formData.answerimage1} 
                  alt="Part c" 
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'block', marginBottom: '10px' }}
                />
                <button 
                  type="button" 
                  onClick={removeAnswerImage1}
                  style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Remove Image
                </button>
              </div>
            )}
          </div>
          
          {/* Answer Image 2 (for part d) */}
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#d1ecf1', border: '2px dashed #0c5460', borderRadius: '6px' }}>
            <label htmlFor="answerImage2" style={{ display: 'block', fontWeight: '600', color: '#0c5460', marginBottom: '10px' }}>
              Answer Image 2 (for part d):
            </label>
            {(
              <input 
                type="file" 
                id="answerImage2"
                accept="image/*"
                onChange={(e) => handleAnswerImage2Upload(e.target.files[0])}
                style={{ display: 'block', width: '100%', padding: '8px', fontSize: '14px', cursor: 'pointer' }}
              />
            )}
            {formData.answerimage2 && (
              <div style={{ marginTop: '15px' }}>
                <img 
                  src={formData.answerimage2} 
                  alt="Part d" 
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'block', marginBottom: '10px' }}
                />
                <button 
                  type="button" 
                  onClick={removeAnswerImage2}
                  style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Remove Image
                </button>
              </div>
            )}
          </div>

          {/* Answer Image 3 (for part a) */}
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#e2e3e5', border: '2px dashed #383d41', borderRadius: '6px' }}>
            <label htmlFor="answerImage3" style={{ display: 'block', fontWeight: '600', color: '#383d41', marginBottom: '10px' }}>
              Answer Image 3 (for part a):
            </label>
            <input 
              type="file" 
              id="answerImage3"
              accept="image/*"
              onChange={(e) => handleAnswerImage3Upload(e.target.files[0])}
              style={{ display: 'block', width: '100%', padding: '8px', fontSize: '14px', cursor: 'pointer' }}
            />
            {formData.answerimage3 && (
              <div style={{ marginTop: '15px' }}>
                <img 
                  src={formData.answerimage3} 
                  alt="Part a" 
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'block', marginBottom: '10px' }}
                />
                <button 
                  type="button" 
                  onClick={removeAnswerImage3}
                  style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Remove Image
                </button>
              </div>
            )}
          </div>

          {/* Answer Image 4 (for part b) */}
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#d4edda', border: '2px dashed #155724', borderRadius: '6px' }}>
            <label htmlFor="answerImage4" style={{ display: 'block', fontWeight: '600', color: '#155724', marginBottom: '10px' }}>
              Answer Image 4 (for part b):
            </label>
            <input 
              type="file" 
              id="answerImage4"
              accept="image/*"
              onChange={(e) => handleAnswerImage4Upload(e.target.files[0])}
              style={{ display: 'block', width: '100%', padding: '8px', fontSize: '14px', cursor: 'pointer' }}
            />
            {formData.answerimage4 && (
              <div style={{ marginTop: '15px' }}>
                <img 
                  src={formData.answerimage4} 
                  alt="Part b" 
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'block', marginBottom: '10px' }}
                />
                <button 
                  type="button" 
                  onClick={removeAnswerImage4}
                  style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ✕ Remove Image
                </button>
              </div>
            )}
          </div>
          
          <div>
            <label>Question Parts:</label>
            <div className="option-fields">
              {formData.parts.map((part, index) => (
                <div key={part.letter}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                      type="text" 
                      placeholder={`Part ${part.letter}) text`} 
                      value={part.text}
                      onChange={(e) => handlePartChange(index, 'text', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {formData.language === 'bn' && part.text.trim() && (
                      <button 
                        type="button"
                        onClick={() => translatePart(index, 'text')}
                        disabled={isTranslating}
                        style={{ 
                          backgroundColor: '#28a745', 
                          color: 'white',
                          padding: '3px 8px',
                          fontSize: '11px'
                        }}
                      >
                        🌐
                      </button>
                    )}
                  </div>
                  <input 
                    type="number" 
                    placeholder="Marks" 
                    min="0"
                    value={part.marks}
                    onChange={(e) => handlePartChange(index, 'marks', parseInt(e.target.value) || 0)}
                    style={{width: '80px', marginTop: '5px'}}
                  />
                  <div style={{ position: 'relative' }}>
                    <textarea 
                      placeholder={`Answer for part ${part.letter}`} 
                      value={part.answer}
                      onChange={(e) => handlePartChange(index, 'answer', e.target.value)}
                      style={{minHeight: '80px', marginTop: '5px', width: '100%'}}
                    />
                    {formData.language === 'bn' && part.answer.trim() && (
                      <button 
                        type="button"
                        onClick={() => translatePart(index, 'answer')}
                        disabled={isTranslating}
                        style={{ 
                          backgroundColor: '#28a745', 
                          color: 'white',
                          marginTop: '5px',
                          padding: '3px 8px',
                          fontSize: '11px'
                        }}
                      >
                        🌐 Translate Answer
                      </button>
                    )}
                  </div>
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
            {formData.language === 'bn' && formData.sqAnswer.trim() && (
              <button 
                type="button"
                onClick={() => translateField('sqAnswer')}
                disabled={isTranslating}
                style={{ 
                  backgroundColor: '#28a745', 
                  color: 'white',
                  marginTop: '5px',
                  padding: '5px 10px',
                  fontSize: '12px'
                }}
              >
                {isTranslating ? 'Translating...' : '🌐 Translate to Bangla'}
              </button>
            )}
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
