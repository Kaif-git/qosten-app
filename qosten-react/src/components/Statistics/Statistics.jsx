import React from 'react';

export default function Statistics({ questions, onFilterSelect, onSelectAll, selectedCategories = [] }) {
  const subjects = new Set(questions.map(q => q.subject).filter(Boolean));
  const chapters = new Set(questions.map(q => q.chapter).filter(Boolean));
  const types = new Set(questions.map(q => q.type).filter(Boolean));
  
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

  const isSelected = (type, key) => {
    return selectedCategories.some(cat => cat.type === type && cat.key === key);
  };

  const renderClickableList = (items, type) => {
    // Sort items by key (alphabetically) so range selection makes sense
    const sortedEntries = Object.entries(items).sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <ul className="clickable-stats-list" style={{ padding: 0, listStyle: 'none' }}>
        {sortedEntries.map(([key, count]) => {
          const selected = isSelected(type, key);
          let labelContent = null;
          
          if (type === 'chapter') {
             const breakdown = chapterTypeBreakdown[key];
             const breakdownString = breakdown 
               ? Object.entries(breakdown)
                   .map(([t, typeCount]) => `${t.toUpperCase()}: ${typeCount}`)
                   .join(', ')
               : '';
             labelContent = (
                <div style={{ flex: 1 }}>
                   <strong>{key}:</strong> {count} {breakdownString && <span style={{fontSize: '0.85em', color: '#666'}}>({breakdownString})</span>}
                </div>
             );
          } else if (type === 'type') {
             labelContent = <div style={{ flex: 1 }}><strong>{key.toUpperCase()}:</strong> {count}</div>;
          } else {
             labelContent = <div style={{ flex: 1 }}><strong>{key}:</strong> {count}</div>;
          }

          return (
            <li 
              key={key} 
              onClick={(e) => onSelectAll && onSelectAll(type, key, e)}
              style={{
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '6px',
                transition: 'all 0.2s',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                backgroundColor: selected ? '#e7f3ff' : 'transparent',
                border: selected ? '1px solid #007bff' : '1px solid transparent',
                boxShadow: selected ? '0 2px 4px rgba(0,123,255,0.1)' : 'none'
              }}
              onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = '#f1f3f5';
              }}
              onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ 
                width: '18px', 
                height: '18px', 
                borderRadius: '4px', 
                border: '2px solid #007bff', 
                marginRight: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? '#007bff' : 'white',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                userSelect: 'none'
              }}>
                {selected ? '✓' : ''}
              </div>
              
              {labelContent}
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onFilterSelect && onFilterSelect(type, key);
                }}
                title={`Filter by ${type}`}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  opacity: 0.7
                }}
              >
                🔍 Filter
              </button>
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