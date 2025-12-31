import React from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function Statistics({ questions, onFilterSelect, onSelectAll, selectedCategories = [] }) {
  const { hierarchy, currentFilters } = useQuestions();

  // 1. Calculate stats from loaded questions (Default / Fallback)
  const loadedSubjects = new Set(questions.map(q => q.subject).filter(Boolean));
  const loadedChapters = new Set(questions.map(q => q.chapter).filter(Boolean));
  const loadedTypes = new Set(questions.map(q => q.type).filter(Boolean));
  
  const detailedCounts = {
    subjects: {},
    chapters: {},
    types: {}
  };
  
  const chapterTypeBreakdown = {};
  
  // Populate from loaded questions
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

  // 2. Override with Hierarchy data if available (for Subjects and Chapters)
  let totalQuestionsCount = questions.length;
  let subjectCount = loadedSubjects.size;
  let chapterCount = loadedChapters.size;

  if (hierarchy && hierarchy.length > 0) {
      const hierarchySubjects = {};
      const hierarchyChapters = {};
      let hierarchyTotal = 0;

      // Filter hierarchy based on current filters
      hierarchy.forEach(sub => {
          // 1. Basic Subject Filter match
          if (currentFilters.subject && currentFilters.subject !== 'none' && sub.name !== currentFilters.subject) {
              return;
          }
          if (currentFilters.subject === 'none' && sub.name) {
              return;
          }

          // 2. Narrowing down: If any filters are active (beyond just subject), 
          // ensure the subject is actually present in our filtered questions set.
          // This handles Board, Type, Language, etc.
          const hasActiveFilters = Object.entries(currentFilters).some(([k, v]) => {
              if (k === 'verifiedStatus') return v !== 'all';
              return v !== '' && v !== 'none' && k !== 'subject'; // ignore subject here as it's handled above
          });

          if (hasActiveFilters && !loadedSubjects.has(sub.name)) {
              return;
          }

          let subTotal = 0;
          let subHasMatchingChapters = false;

          if (sub.chapters) {
              sub.chapters.forEach(chap => {
                  // Filter by Chapter
                  if (currentFilters.chapter && currentFilters.chapter !== 'none' && chap.name !== currentFilters.chapter) {
                      return;
                  }
                  if (currentFilters.chapter === 'none' && chap.name) {
                      return;
                  }

                  // If we have non-hierarchy filters, ensure chapter is in filtered set
                  if (hasActiveFilters && !loadedChapters.has(chap.name)) {
                      return;
                  }

                  // If non-hierarchy filters are active, hierarchy counts are inaccurate.
                  // Use loaded counts instead.
                  if (hasActiveFilters) {
                      hierarchyChapters[chap.name] = detailedCounts.chapters[chap.name] || 0;
                  } else {
                      hierarchyChapters[chap.name] = chap.total || 0;
                  }
                  
                  subTotal += hierarchyChapters[chap.name];
                  subHasMatchingChapters = true;
                  
                  // Try to merge type breakdown if available in hierarchy
                  // ONLY if we don't have non-hierarchy filters (which hierarchy doesn't know about)
                  if (!hasActiveFilters && chap.types && Array.isArray(chap.types)) {
                       if (!chapterTypeBreakdown[chap.name]) chapterTypeBreakdown[chap.name] = {};
                       chap.types.forEach(t => {
                           if (currentFilters.type && t.name !== currentFilters.type) return;
                           chapterTypeBreakdown[chap.name][t.name] = t.total;
                       });
                  }
              });
          }

          // If we filtered chapters and none matched, this subject shouldn't show
          if (currentFilters.chapter && !subHasMatchingChapters) {
              return;
          }
          // If we have other filters and no matching chapters were found for this subject
          if (hasActiveFilters && !subHasMatchingChapters && sub.chapters && sub.chapters.length > 0) {
              return;
          }

          if (hasActiveFilters) {
              hierarchySubjects[sub.name] = detailedCounts.subjects[sub.name] || 0;
          } else {
              hierarchySubjects[sub.name] = sub.total !== undefined ? sub.total : subTotal;
          }
          
          // If filtering by chapter, use subTotal (sum of matched chapters)
          if (currentFilters.chapter) {
              hierarchySubjects[sub.name] = subTotal;
          }
          
          hierarchyTotal += hierarchySubjects[sub.name];
      });

      // Override display data
      detailedCounts.subjects = hierarchySubjects;
      detailedCounts.chapters = hierarchyChapters;
      
      // Update summary counts
      totalQuestionsCount = hierarchyTotal;
      subjectCount = Object.keys(hierarchySubjects).length;
      chapterCount = Object.keys(hierarchyChapters).length;
  }

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
          <div className="stat-value">{totalQuestionsCount}</div>
          <div>Total Questions {hierarchy?.length > 0 && <span style={{fontSize: '0.6em', color: '#666'}}>(Available)</span>}</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{subjectCount}</div>
          <div>Subjects</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{chapterCount}</div>
          <div>Chapters</div>
        </div>
      </div>

      <div className="detailed-stats">
        <h3>Detailed Counts {hierarchy?.length > 0 && <span style={{fontSize: '0.6em', color: '#666'}}>(Server Data)</span>}</h3>
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
              <h4>By Type (Loaded):</h4>
              {renderClickableList(detailedCounts.types, 'type')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}