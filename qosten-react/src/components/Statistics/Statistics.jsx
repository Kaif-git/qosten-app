import React from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function Statistics({ questions, onFilterSelect, onSelectAll, selectedCategories = [], filters }) {
  const context = useQuestions();
  const { hierarchy } = context;
  
  // Use provided filters or fallback to context (uncontrolled)
  const activeFilters = filters || context.currentFilters;

  // Memoize all calculations to prevent lag on every render
  const stats = React.useMemo(() => {
    // 1. Single Pass over Questions to collect all local data (O(N))
    const loadedSubjects = new Set();
    const loadedChapters = new Set();
    const detailedCounts = { subjects: {}, chapters: {}, types: {} };
    const chapterTypeBreakdown = {};
    const loadedBreakdownByChapter = {}; 
    const subjectToChaptersMap = {};

    questions.forEach(q => {
      const subject = (q.subject || '').trim();
      const chapter = (q.chapter || '').trim();
      const type = (q.type || 'unknown').toLowerCase();

      if (subject) {
        loadedSubjects.add(subject);
        detailedCounts.subjects[subject] = (detailedCounts.subjects[subject] || 0) + 1;
        
        if (chapter) {
            if (!subjectToChaptersMap[subject]) subjectToChaptersMap[subject] = new Set();
            subjectToChaptersMap[subject].add(chapter);
        }
      }
      
      if (chapter) {
        loadedChapters.add(chapter);
        detailedCounts.chapters[chapter] = (detailedCounts.chapters[chapter] || 0) + 1;
        
        if (!chapterTypeBreakdown[chapter]) chapterTypeBreakdown[chapter] = {};
        chapterTypeBreakdown[chapter][type] = (chapterTypeBreakdown[chapter][type] || 0) + 1;

        if (!loadedBreakdownByChapter[chapter]) loadedBreakdownByChapter[chapter] = {};
        loadedBreakdownByChapter[chapter][type] = (loadedBreakdownByChapter[chapter][type] || 0) + 1;
      }
      if (q.type) detailedCounts.types[q.type] = (detailedCounts.types[q.type] || 0) + 1;
    });

    // 2. Override with Hierarchy data if available
    let totalQuestionsCount = questions.length;
    let subjectCount = loadedSubjects.size;
    let chapterCount = loadedChapters.size;

    if (hierarchy && hierarchy.length > 0) {
        const hierarchySubjects = {};
        const hierarchyChapters = {};

        // Process Hierarchy Data (O(H))
        hierarchy.forEach(sub => {
            const subName = (sub.name || '').trim();
            if (!subName) return;

            let subTotalFromHierarchy = sub.total !== undefined ? sub.total : 0;
            let sumOfChapters = 0;

            if (sub.chapters) {
                sub.chapters.forEach(chap => {
                    const chapName = (chap.name || '').trim();
                    if (!chapName) return;

                    let chapTotalFromHierarchy = chap.total || 0;
                    let sumOfTypes = 0;
                    
                    if (!chapterTypeBreakdown[chapName]) chapterTypeBreakdown[chapName] = {};
                    
                    if (chap.types && Array.isArray(chap.types)) {
                         chap.types.forEach(t => {
                             const typeName = t.name || 'unknown';
                             chapterTypeBreakdown[chapName][typeName] = t.total;
                             sumOfTypes += t.total;
                         });
                    }

                    hierarchyChapters[chapName] = Math.max(chapTotalFromHierarchy, sumOfTypes);
                    sumOfChapters += hierarchyChapters[chapName];
                });
            }
            
            hierarchySubjects[subName] = Math.max(subTotalFromHierarchy, sumOfChapters);
        });

        // Merge with Loaded Questions (Priority to local if higher)
        Object.entries(detailedCounts.subjects).forEach(([sub, count]) => {
            hierarchySubjects[sub] = Math.max(hierarchySubjects[sub] || 0, count);
        });
        
        Object.entries(detailedCounts.chapters).forEach(([chap, count]) => {
            hierarchyChapters[chap] = Math.max(hierarchyChapters[chap] || 0, count);
        });

        // Resolve Discrepancies (O(Chapters))
        Object.keys(hierarchyChapters).forEach(chapName => {
            if (!chapterTypeBreakdown[chapName]) chapterTypeBreakdown[chapName] = {};
            
            if (loadedBreakdownByChapter[chapName]) {
                Object.entries(loadedBreakdownByChapter[chapName]).forEach(([type, count]) => {
                    chapterTypeBreakdown[chapName][type] = Math.max(chapterTypeBreakdown[chapName][type] || 0, count);
                });
            }

            const currentSumOfTypes = Object.entries(chapterTypeBreakdown[chapName])
              .filter(([t]) => t !== 'other')
              .reduce((a, b) => a + b[1], 0);
              
            const currentTotal = hierarchyChapters[chapName] || 0;
            
            if (currentTotal > currentSumOfTypes) {
                chapterTypeBreakdown[chapName]['other'] = currentTotal - currentSumOfTypes;
            } else if (currentSumOfTypes > currentTotal) {
                hierarchyChapters[chapName] = currentSumOfTypes;
                delete chapterTypeBreakdown[chapName]['other'];
            }
            else {
                delete chapterTypeBreakdown[chapName]['other'];
            }
        });

        // 3. Apply Filters to the merged data
        const filteredHierarchySubjects = {};
        const filteredHierarchyChapters = {};
        const filteredHierarchyTypes = {};
        let finalTotal = 0;

        const hasActiveFilters = Object.entries(activeFilters).some(([k, v]) => {
            if (k === 'verifiedStatus') return v !== 'all';
            return v !== '' && v !== 'none' && k !== 'subject' && k !== 'chapter' && k !== 'searchText';
        });

        Object.keys(hierarchySubjects).forEach(subName => {
            if (activeFilters.subject && activeFilters.subject !== 'none' && subName !== activeFilters.subject) return;
            if (activeFilters.subject === 'none' && subName) return;
            
            if (hasActiveFilters && !loadedSubjects.has(subName)) return;

            let subSum = 0;
            let calculatedSumOfChapters = 0;
            let hasMatchingChap = false;

            const subNode = hierarchy.find(h => (h.name || '').trim() === subName);
            const hierarchyChapterNames = subNode ? subNode.chapters.map(c => (c.name || '').trim()) : [];
            const loadedChapterNames = subjectToChaptersMap[subName] ? Array.from(subjectToChaptersMap[subName]) : [];
            
            let relevantChapters = [...new Set([...hierarchyChapterNames, ...loadedChapterNames])];
            
            const subTotalFromHierarchy = hierarchySubjects[subName] || 0;

            relevantChapters.forEach(chapName => {
                if (activeFilters.chapter && activeFilters.chapter !== 'none' && chapName !== activeFilters.chapter) return;
                if (activeFilters.chapter === 'none' && chapName) return;
                if (hasActiveFilters && !loadedChapters.has(chapName)) return;

                const val = hasActiveFilters ? (detailedCounts.chapters[chapName] || 0) : (hierarchyChapters[chapName] || 0);
                filteredHierarchyChapters[chapName] = val;
                calculatedSumOfChapters += val;
                subSum += val;
                hasMatchingChap = true;

                if (!hasActiveFilters && chapterTypeBreakdown[chapName]) {
                    Object.entries(chapterTypeBreakdown[chapName]).forEach(([t, count]) => {
                        const typeLabel = t === 'other' ? 'Unspecified' : t;
                        filteredHierarchyTypes[typeLabel] = (filteredHierarchyTypes[typeLabel] || 0) + count;
                    });
                } else if (hasActiveFilters) {
                    if (loadedBreakdownByChapter[chapName]) {
                        Object.entries(loadedBreakdownByChapter[chapName]).forEach(([t, count]) => {
                            filteredHierarchyTypes[t] = (filteredHierarchyTypes[t] || 0) + count;
                        });
                    }
                }
            });
            
            if (!hasActiveFilters && !activeFilters.chapter) {
                const uncategorizedCount = subTotalFromHierarchy - calculatedSumOfChapters;
                if (uncategorizedCount > 0) {
                    const noChapKey = `(No Chapter)`;
                    filteredHierarchyChapters[noChapKey] = (filteredHierarchyChapters[noChapKey] || 0) + uncategorizedCount;
                    subSum += uncategorizedCount;
                    filteredHierarchyTypes['Unspecified'] = (filteredHierarchyTypes['Unspecified'] || 0) + uncategorizedCount;
                }
            }

            if (activeFilters.chapter && !hasMatchingChap) return;

            filteredHierarchySubjects[subName] = hasActiveFilters ? (detailedCounts.subjects[subName] || 0) : (activeFilters.chapter ? subSum : hierarchySubjects[subName]);
            finalTotal += filteredHierarchySubjects[subName];
        });

        detailedCounts.subjects = filteredHierarchySubjects;
        detailedCounts.chapters = filteredHierarchyChapters;
        if (!hasActiveFilters) {
            detailedCounts.types = filteredHierarchyTypes;
        }
        totalQuestionsCount = finalTotal;
        subjectCount = Object.keys(filteredHierarchySubjects).length;
        chapterCount = Object.keys(filteredHierarchyChapters).length;
    }

    return {
        totalQuestionsCount,
        subjectCount,
        chapterCount,
        detailedCounts,
        chapterTypeBreakdown
    };
  }, [questions, hierarchy, activeFilters]);

  const { totalQuestionsCount, subjectCount, chapterCount, detailedCounts, chapterTypeBreakdown } = stats;


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
              <h4>By Type:</h4>
              {renderClickableList(detailedCounts.types, 'type')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}