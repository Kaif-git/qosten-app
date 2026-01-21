import React, { useEffect, useCallback } from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function SearchFilters({ filters, onFilterChange }) {
  const context = useQuestions();
  const { hierarchy } = context; 
  
  // Determine source of truth
  const isControlled = !!filters && !!onFilterChange;
  const activeFilters = isControlled ? filters : context.currentFilters;
  const allQuestions = context.questions; 

  // Local state for debounced search text
  const [localSearchText, setLocalSearchText] = React.useState(activeFilters.searchText || '');

  const handleFilterChange = useCallback((keyOrMap, value) => {
    let newFilters;
    if (typeof keyOrMap === 'string') {
      newFilters = { [keyOrMap]: value };
      // Reset dependent filters
      if (keyOrMap === 'subject') {
        newFilters.chapter = ''; 
        newFilters.lesson = '';
      }
      if (keyOrMap === 'chapter') {
        newFilters.lesson = '';
      }
    } else {
      newFilters = keyOrMap;
    }

    if (isControlled) {
      onFilterChange(newFilters);
    } else {
      context.setFilters(newFilters);
    }
  }, [isControlled, onFilterChange, context]);
  
  const resetFilters = () => {
    const resetState = {
      searchText: '',
      subject: '',
      chapter: '',
      lesson: '',
      type: '',
      board: '',
      language: '',
      flaggedStatus: '',
      verifiedStatus: 'all'
    };
    
    if (isControlled) {
      onFilterChange(resetState);
    } else {
      context.setFilters(resetState);
    }
  };

  // Sync local text when filter changes externally
  useEffect(() => {
    setLocalSearchText(activeFilters.searchText || '');
  }, [activeFilters.searchText]);

  // Debounce search update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchText !== activeFilters.searchText) {
        handleFilterChange('searchText', localSearchText);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localSearchText, activeFilters.searchText, handleFilterChange]);
  
  // Optimization: Only use if hierarchy is not enough or for deep fields
  // For dropdown options, we only care about Subject and Chapter dependencies
  const getOptionsFiltered = useCallback((excludeKey) => {
      return allQuestions.filter(q => {
          if (excludeKey !== 'subject' && activeFilters.subject && activeFilters.subject !== 'none' && q.subject !== activeFilters.subject) return false;
          if (excludeKey !== 'chapter' && activeFilters.chapter && activeFilters.chapter !== 'none' && q.chapter !== activeFilters.chapter) return false;
          return true;
      });
  }, [allQuestions, activeFilters.subject, activeFilters.chapter]);

  // Extract complex expression for subjects
  const allQuestionsSmall = allQuestions.length < 5000 ? allQuestions : null;

  // 1. Subjects: Priority to Hierarchy
  const uniqueSubjects = React.useMemo(() => {
    const combined = [];
    const seen = new Set();

    if (hierarchy && hierarchy.length > 0) {
      hierarchy.forEach(h => {
        combined.push({
          name: h.name,
          count: h.total !== undefined ? h.total : (h.chapters || []).reduce((sum, c) => sum + (c.total || 0), 0)
        });
        seen.add(h.name);
      });
    }

    // Only scan allQuestions if hierarchy is missing items (rare)
    if (allQuestionsSmall) { // Only scan for small datasets
        allQuestionsSmall.forEach(q => {
            if (q.subject && !seen.has(q.subject)) {
                combined.push({ name: q.subject, count: null });
                seen.add(q.subject);
            }
        });
    }

    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [hierarchy, allQuestionsSmall]);

  // Extract complex expression for chapters
  const allQuestionsMedium = allQuestions.length < 10000 ? allQuestions : null;

  // 2. Chapters: Priority to Hierarchy
  const uniqueChapters = React.useMemo(() => {
    const combined = [];
    const seen = new Set();

    if (hierarchy && hierarchy.length > 0) {
      if (activeFilters.subject && activeFilters.subject !== 'none') {
        const subjectNode = hierarchy.find(h => h.name === activeFilters.subject);
        if (subjectNode && subjectNode.chapters) {
          subjectNode.chapters.forEach(c => {
            combined.push({ name: c.name, count: c.total || 0 });
            seen.add(c.name);
          });
        }
      } else {
        hierarchy.flatMap(h => h.chapters || []).forEach(c => {
          if (!seen.has(c.name)) {
            combined.push({ name: c.name, count: c.total || 0 });
            seen.add(c.name);
          }
        });
      }
    }

    // Only scan local questions if specifically filtered by subject and local data might be newer
    if (activeFilters.subject && activeFilters.subject !== 'none' && allQuestionsMedium) {
        allQuestionsMedium.forEach(q => {
            if (q.subject === activeFilters.subject && q.chapter && !seen.has(q.chapter)) {
                combined.push({ name: q.chapter, count: null });
                seen.add(q.chapter);
            }
        });
    }

    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [hierarchy, activeFilters.subject, allQuestionsMedium]);

  // For deeper levels (Lesson, Board) we still rely on loaded questions as Hierarchy might not go that deep yet
  // MEMOIZE these expensive scans! 
  // Safeguard: Skip deep scans if dataset is too large AND no subject is selected
  const shouldSkipDeepScan = allQuestions.length > 10000 && (!activeFilters.subject || activeFilters.subject === 'none');

  const uniqueLessons = React.useMemo(() => {
    if (shouldSkipDeepScan) return [];
    return [...new Set(getOptionsFiltered('lesson').map(q => q.lesson).filter(Boolean))].sort();
  }, [getOptionsFiltered, shouldSkipDeepScan]);

  const uniqueBoards = React.useMemo(() => {
    if (shouldSkipDeepScan) return [];
    return [...new Set(getOptionsFiltered('board').map(q => q.board).filter(Boolean))].sort();
  }, [getOptionsFiltered, shouldSkipDeepScan]);
  
  return (
    <div className="search-filters">
      <div>
        <label htmlFor="searchText">Search Text:</label>
        <input
          type="text"
          id="searchText"
          placeholder="Enter keywords..."
          value={localSearchText}
          onChange={(e) => setLocalSearchText(e.target.value)}
        />
      </div>
      
      <div>
        <label htmlFor="filterSubject">Subject:</label>
        <select
          id="filterSubject"
          value={activeFilters.subject || ''}
          onChange={(e) => handleFilterChange('subject', e.target.value)}
        >
          <option value="">All Subjects</option>
          <option value="none">None</option>
          {uniqueSubjects.map((sub, index) => (
            <option key={`${sub.name}-${index}`} value={sub.name}>
              {sub.name} {sub.count !== null ? `(${sub.count})` : ''}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label htmlFor="filterChapter">Chapter:</label>
        <select
          id="filterChapter"
          value={activeFilters.chapter || ''}
          onChange={(e) => handleFilterChange('chapter', e.target.value)}
        >
          <option value="">All Chapters</option>
          <option value="none">None</option>
          {uniqueChapters.map((chap, index) => (
            <option key={`${chap.name}-${index}`} value={chap.name}>
              {chap.name} {chap.count !== null ? `(${chap.count})` : ''}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label htmlFor="filterLesson">Lesson:</label>
        <select
          id="filterLesson"
          value={activeFilters.lesson || ''}
          onChange={(e) => handleFilterChange('lesson', e.target.value)}
        >
          <option value="">All Lessons</option>
          {uniqueLessons.map(lesson => (
            <option key={lesson} value={lesson}>{lesson}</option>
          ))}
        </select>
      </div>
      
      <div>
        <label htmlFor="filterType">Type:</label>
        <select
          id="filterType"
          value={activeFilters.type || ''}
          onChange={(e) => handleFilterChange('type', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="mcq">MCQ</option>
          <option value="cq">CQ</option>
          <option value="sq">SQ</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="filterBoard">Board:</label>
        <select
          id="filterBoard"
          value={activeFilters.board || ''}
          onChange={(e) => handleFilterChange('board', e.target.value)}
        >
          <option value="">All Boards</option>
          {uniqueBoards.map(board => (
            <option key={board} value={board}>{board}</option>
          ))}
        </select>
      </div>
      
      
      <div>
        <label htmlFor="filterLanguage">Language:</label>
        <select
          id="filterLanguage"
          value={activeFilters.language || ''}
          onChange={(e) => handleFilterChange('language', e.target.value)}
        >
          <option value="">All Languages</option>
          <option value="en">English</option>
          <option value="bn">Bangla</option>
        </select>
      </div>
      
      <div>
        <label htmlFor="filterFlagged">🚩 Flagged Status:</label>
        <select
          id="filterFlagged"
          value={activeFilters.flaggedStatus || ''}
          onChange={(e) => handleFilterChange('flaggedStatus', e.target.value)}
          style={{ 
            borderColor: activeFilters.flaggedStatus === 'flagged' ? '#e74c3c' : undefined,
            fontWeight: activeFilters.flaggedStatus === 'flagged' ? 'bold' : 'normal'
          }}
        >
          <option value="">All Questions</option>
          <option value="flagged">🚩 Flagged Only</option>
          <option value="unflagged">✓ Unflagged Only</option>
        </select>
      </div>

      <div>
        <label htmlFor="filterVerified">✅ Verified Status:</label>
        <select
          id="filterVerified"
          value={activeFilters.verifiedStatus || ''}
          onChange={(e) => handleFilterChange('verifiedStatus', e.target.value)}
          style={{ 
            borderColor: activeFilters.verifiedStatus === 'verified' ? '#27ae60' : undefined,
            fontWeight: activeFilters.verifiedStatus === 'verified' ? 'bold' : 'normal'
          }}
        >
          <option value="all">All Questions</option>
          <option value="verified">✅ Verified Only</option>
          <option value="unverified">❌ Unverified Only</option>
        </select>
      </div>
      
      <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
        <button className="secondary" onClick={resetFilters}>Reset Filters</button>
      </div>
    </div>
  );
}