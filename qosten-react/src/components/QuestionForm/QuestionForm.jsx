import React, { useState, useEffect } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import { useNavigate } from 'react-router-dom';

export default function QuestionForm() {
  const { editingQuestion, addQuestion, updateQuestion, setEditingQuestion } = useQuestions();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    type: 'mcq',
    subject: '',
    chapter: '',
    lesson: '',
    board: '',
    isQuizzable: true,
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
    tags: '',
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
        isQuizzable: editingQuestion.isQuizzable !== false,
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
        tags: editingQuestion.tags ? editingQuestion.tags.join(', ') : '',
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
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.questionText.trim()) {
      alert('Please enter a question.');
      return;
    }
    
    // Prepare question object based on type
    let questionData = {
      type: formData.type,
      subject: formData.subject,
      chapter: formData.chapter,
      lesson: formData.lesson,
      board: formData.board,
      isQuizzable: formData.isQuizzable,
      language: formData.language,
      tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
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
        return;
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
        return;
      }
    }
    
    if (editingQuestion) {
      updateQuestion({ ...questionData, id: editingQuestion.id });
      alert('Question updated successfully!');
    } else {
      addQuestion(questionData);
      alert('Question added successfully!');
    }
    
    // Reset form and navigate back
    resetForm();
    navigate('/bank');
  };
  
  const resetForm = () => {
    setFormData({
      type: 'mcq',
      subject: '',
      chapter: '',
      lesson: '',
      board: '',
      isQuizzable: true,
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
      tags: '',
      image: null
    });
    setEditingQuestion(null);
  };
  
  const cancelEdit = () => {
    resetForm();
    navigate('/bank');
  };

  return (
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
          <div>
            <label htmlFor="isQuizzable">Quizzable:</label>
            <input 
              type="checkbox" 
              id="isQuizzable" 
              checked={formData.isQuizzable}
              onChange={(e) => handleInputChange('isQuizzable', e.target.checked)}
            />
            <span style={{marginLeft: '5px', fontSize: '0.9em'}}>(Include in quizzes?)</span>
          </div>
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
        
        <div>
          <label htmlFor="tags">Tags (comma separated):</label>
          <input 
            type="text" 
            id="tags" 
            placeholder="e.g., easy, formula, calculation"
            value={formData.tags}
            onChange={(e) => handleInputChange('tags', e.target.value)}
          />
        </div>
        
        <div style={{marginTop: '20px'}}>
          <button type="submit">{editingQuestion ? 'Update Question' : 'Save Question'}</button>
          {editingQuestion && (
            <button type="button" className="danger" onClick={cancelEdit}>Cancel Edit</button>
          )}
        </div>
      </form>
    </div>
  );
}
