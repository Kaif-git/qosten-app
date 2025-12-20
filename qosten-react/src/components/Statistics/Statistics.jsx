import React from 'react';

export default function Statistics({ questions }) {
  const subjects = new Set(questions.map(q => q.subject).filter(Boolean));
  const chapters = new Set(questions.map(q => q.chapter).filter(Boolean));
  const types = new Set(questions.map(q => q.type).filter(Boolean));
  const boards = new Set(questions.map(q => q.board).filter(Boolean));
  
  // Detailed counts
  const detailedCounts = {
    subjects: {},
    chapters: {},
    types: {},
    boards: {}
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
    if (q.board) detailedCounts.boards[q.board] = (detailedCounts.boards[q.board] || 0) + 1;
  });

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
              <ul>
                {Object.entries(detailedCounts.subjects).map(([subject, count]) => (
                  <li key={subject}>
                    <strong>{subject}:</strong> {count}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(detailedCounts.chapters).length > 0 && (
            <div>
              <h4>By Chapter:</h4>
              <ul>
                {Object.entries(detailedCounts.chapters).map(([chapter, count]) => {
                  const breakdown = chapterTypeBreakdown[chapter];
                  const breakdownString = breakdown 
                    ? Object.entries(breakdown)
                        .map(([type, typeCount]) => `${type.toUpperCase()}: ${typeCount}`)
                        .join(', ')
                    : '';
                  
                  return (
                    <li key={chapter}>
                      <strong>{chapter}:</strong> {count} {breakdownString && <span style={{fontSize: '0.85em', color: '#666'}}>({breakdownString})</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          
          {Object.keys(detailedCounts.types).length > 0 && (
            <div>
              <h4>By Type:</h4>
              <ul>
                {Object.entries(detailedCounts.types).map(([type, count]) => (
                  <li key={type}>
                    <strong>{type.toUpperCase()}:</strong> {count}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}