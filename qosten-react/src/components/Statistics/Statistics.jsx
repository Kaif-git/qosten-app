import React from 'react';

export default function Statistics({ questions, onFilterSelect }) {
  const subjects = new Set(questions.map(q => q.subject).filter(Boolean));
  const chapters = new Set(questions.map(q => q.chapter).filter(Boolean));
  const types = new Set(questions.map(q => q.type).filter(Boolean));
  const boards = new Set(questions.map(q => q.board).filter(Boolean));
  
  // Detailed counts
  const detailedCounts = {
    subjects: {},
    chapters: {},
    types: {}
  };
  
  const chapterTypeBreakdown = {};
  
  questions.forEach(q => {
    if (q.subject) detailedCounts.subjects[q.subject] = (detailedCounts.subjects[q.subject] || 0) + 1;
    if (q.chapter) {
      detailedCounts.chapters[q.chapter] = (detailedCounts.chapters[q.chapter] || 0) + 1;
      
      if (!chapterTypeBreakdown[q.chapter]) {
        chapterTypeBreakdown[q.chapter] = {};
      }
      const type = q.type || 'unknown';
      chapterTypeBreakdown[q.chapter][type] = (chapterTypeBreakdown[q.chapter][type] || 0) + 1;
    }
    if (q.type) detailedCounts.types[q.type] = (detailedCounts.types[q.type] || 0) + 1;
  });

  const renderClickableList = (items, type) => {
    return (
      <ul className="clickable-stats-list">
        {Object.entries(items).map(([key, count]) => {
          let content = null;
          
          if (type === 'chapter') {
             const breakdown = chapterTypeBreakdown[key];
             const breakdownString = breakdown 
               ? Object.entries(breakdown)
                   .map(([t, typeCount]) => `${t.toUpperCase()}: ${typeCount}`)
                   .join(', ')
               : '';
             content = (
                <>
                   <strong>{key}:</strong> {count} {breakdownString && <span style={{fontSize: '0.85em', color: '#666'}}>({breakdownString})</span>}
                </>
             );
          } else if (type === 'type') {
             content = <><strong>{key.toUpperCase()}:</strong> {count}</>;
          } else {
             content = <><strong>{key}:</strong> {count}</>;
          }

          return (
            <li 
              key={key} 
              onClick={() => onFilterSelect && onFilterSelect(type, key)}
              title={`Click to filter by ${type}: ${key}`}
              style={{
                cursor: onFilterSelect ? 'pointer' : 'default',
                padding: '2px 5px',
                borderRadius: '3px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                  if (onFilterSelect) e.currentTarget.style.backgroundColor = '#e9ecef';
              }}
              onMouseLeave={(e) => {
                  if (onFilterSelect) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {content}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <>
      <div className="stats">
        <div className="stat-item">
          <div className="stat-value">{questions.length}</div>
          <div>Total Questions</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{subjects.size}</div>
          <div>Subjects</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{chapters.size}</div>
          <div>Chapters</div>
        </div>
      </div>

      <div className="detailed-stats">
        <h3>Detailed Counts</h3>
        <div className="detailed-stats-content">
          {Object.keys(detailedCounts.subjects).length > 0 && (
            <div>
              <h4>By Subject:</h4>
              {renderClickableList(detailedCounts.subjects, 'subject')}
            </div>
          )}

          {Object.keys(detailedCounts.chapters).length > 0 && (
            <div>
              <h4>By Chapter:</h4>
              {renderClickableList(detailedCounts.chapters, 'chapter')}
            </div>
          )}
          
          {Object.keys(detailedCounts.types).length > 0 && (
            <div>
              <h4>By Type:</h4>
              {renderClickableList(detailedCounts.types, 'type')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}