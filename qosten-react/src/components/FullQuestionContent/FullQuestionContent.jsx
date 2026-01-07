import React from 'react';
import LatexRenderer from '../LatexRenderer/LatexRenderer';

export default function FullQuestionContent({ question }) {
  if (!question) return null;

  if (question.type === 'mcq') {
    return (
      <div className="full-question-content">
        <div style={{ marginBottom: '10px' }}><strong>Question:</strong> <LatexRenderer text={question.questionText || question.question || 'N/A'} /></div>
        {question.image && (
          <img 
            src={question.image} 
            alt="Question" 
            style={{maxWidth: '100%', maxHeight: '200px', marginBottom: '10px'}} 
          />
        )}
        {question.options && Array.isArray(question.options) ? (
          <ul className="options-list" style={{ listStyleType: 'none', paddingLeft: 0 }}>
            {question.options.map((option, index) => (
              <li 
                key={index} 
                style={{
                  padding: '5px 10px',
                  marginBottom: '5px',
                  borderRadius: '4px',
                  backgroundColor: question.correctAnswer && option.label === question.correctAnswer ? '#d4edda' : 'transparent',
                  border: question.correctAnswer && option.label === question.correctAnswer ? '1px solid #c3e6cb' : '1px solid #eee'
                }}
              >
                <strong>{option.label?.toUpperCase()}.</strong> <LatexRenderer text={option.text || 'N/A'} />
              </li>
            ))}
          </ul>
        ) : (
          <p>No options available</p>
        )}
        <div style={{ marginBottom: '10px' }}><strong>Correct Answer:</strong> {question.correctAnswer ? question.correctAnswer.toUpperCase() : 'N/A'}</div>
        {question.explanation && (
          <div>
            <strong>Explanation:</strong>
            <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginTop: '5px' }}>
              <LatexRenderer text={question.explanation} />
            </div>
          </div>
        )}
      </div>
    );
  } else if (question.type === 'cq') {
    return (
      <div className="full-question-content">
        <div style={{ marginBottom: '10px' }}><strong>Stimulus/Stem:</strong></div>
        <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '10px' }}>
          <LatexRenderer text={question.questionText || 'N/A'} />
        </div>
        {question.image && (
          <img 
            src={question.image} 
            alt="Question" 
            style={{maxWidth: '100%', maxHeight: '200px', marginBottom: '10px'}} 
          />
        )}
        {question.parts && Array.isArray(question.parts) ? (
          <div className="parts-list">
            {question.parts.map((part, index) => (
              <div key={index} style={{ marginBottom: '15px', padding: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
                <div style={{ margin: '0 0 5px 0' }}>
                  <strong>Part {part.letter?.toUpperCase() || 'N/A'}:</strong> <LatexRenderer text={part.text || 'N/A'} />
                </div>
                <div style={{ padding: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', fontSize: '0.9em' }}>
                  <strong>Answer:</strong> <LatexRenderer text={part.answer || 'N/A'} />
                </div>
                {(() => {
                  let partImage = part.image || part.answerImage;
                  const letter = part.letter?.toLowerCase();
                  if (letter === 'c' && question.answerimage1) partImage = question.answerimage1;
                  else if (letter === 'd' && question.answerimage2) partImage = question.answerimage2;
                  else if (letter === 'a' && question.answerimage3) partImage = question.answerimage3;
                  else if (letter === 'b' && question.answerimage4) partImage = question.answerimage4;
                  
                  return partImage && (
                    <img 
                      src={partImage} 
                      alt={`Part ${part.letter} answer`}
                      style={{maxWidth: '200px', maxHeight: '200px', display: 'block', marginTop: '10px', borderRadius: '4px'}} 
                    />
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <p>No parts available</p>
        )}
      </div>
    );
  } else if (question.type === 'sq') {
    return (
      <div className="full-question-content">
        <div style={{ marginBottom: '10px' }}><strong>Question:</strong> <LatexRenderer text={question.question || 'N/A'} /></div>
        <div style={{ marginBottom: '10px' }}><strong>Answer:</strong></div>
        <div style={{ padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <LatexRenderer text={question.answer || 'N/A'} />
        </div>
      </div>
    );
  }
  return null;
}
