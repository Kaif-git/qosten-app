import React from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function SearchFilters({ filters, onFilterChange }) {
  const context = useQuestions();
  const { hierarchy } = context; // Access hierarchy data
  
  // Debugging hierarchy
  console.log('SearchFilters render. Hierarchy:', hierarchy?.length, hierarchy);

  // Determine source of truth: props (controlled) or context (uncontrolled)
  const isControlled = !!filters && !!onFilterChange;
  const activeFilters = isControlled ? filters : context.currentFilters;
  const allQuestions = context.questions; // Always get questions from context for options
  
  // Helper to filter questions based on ACTIVE filters, but excluding the key being generated
  const getFilteredFor = (excludeKey) => {
      return allQuestions.filter(q => {
          if (excludeKey !== 'subject' && activeFilters.subject && activeFilters.subject !== 'none' && q.subject !== activeFilters.subject) return false;
          if (excludeKey !== 'chapter' && activeFilters.chapter && activeFilters.chapter !== 'none' && q.chapter !== activeFilters.chapter) return false;
          // Lesson usually depends on chapter, so we filter by chapter. 
          // If we are populating 'lesson', we respect 'chapter' filter.
          if (excludeKey !== 'lesson' && activeFilters.lesson && q.lesson !== activeFilters.lesson) return false;
          if (excludeKey !== 'board' && activeFilters.board && q.board !== activeFilters.board) return false;
          if (excludeKey !== 'type' && activeFilters.type && q.type !== activeFilters.type) return false;
          if (excludeKey !== 'language' && activeFilters.language && q.language !== activeFilters.language) return false;
          return true;
      });
  };

  // 1. Subjects: Use Hierarchy if available, else fallback to loaded questions
  const uniqueSubjects = React.useMemo(() => {
    console.log('Calculating uniqueSubjects. Hierarchy length:', hierarchy?.length);
    if (hierarchy && hierarchy.length > 0) {
      return hierarchy.map(h => ({
        name: h.name,
        // Calculate total from chapters if not present on subject
        count: h.total !== undefined ? h.total : (h.chapters || []).reduce((sum, c) => sum + (c.total || 0), 0)
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
    // Fallback
    const subjects = [...new Set(getFilteredFor('subject').map(q => q.subject).filter(Boolean))].sort();
    return subjects.map(s => ({ name: s, count: null }));
  }, [hierarchy, allQuestions, activeFilters]); // Re-calc if activeFilters changes (for fallback)

  // 2. Chapters: Use Hierarchy based on selected Subject
  const uniqueChapters = React.useMemo(() => {
    console.log('Calculating uniqueChapters. Subject:', activeFilters.subject);
    if (hierarchy && hierarchy.length > 0) {
      if (activeFilters.subject && activeFilters.subject !== 'none') {
        const subjectNode = hierarchy.find(h => h.name === activeFilters.subject);
        if (subjectNode && subjectNode.chapters) {
          return subjectNode.chapters.map(c => ({
            name: c.name,
            count: c.total || 0
          })).sort((a, b) => a.name.localeCompare(b.name));
        }
      } else {
        // All chapters from all subjects
        return hierarchy.flatMap(h => h.chapters || []).map(c => ({
           name: c.name,
           count: c.total || 0
        })).sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    // Fallback
    const chapters = [...new Set(getFilteredFor('chapter').map(q => q.chapter).filter(Boolean))].sort();
    return chapters.map(c => ({ name: c, count: null }));
  }, [hierarchy, activeFilters.subject, allQuestions]);


  // For deeper levels (Lesson, Board) we still rely on loaded questions as Hierarchy might not go that deep yet
  const uniqueLessons = [...new Set(getFilteredFor('lesson').map(q => q.lesson).filter(Boolean))].sort();
  const uniqueBoards = [...new Set(getFilteredFor('board').map(q => q.board).filter(Boolean))].sort();
  
  const handleFilterChange = (key, value) => {
    const newFilters = { [key]: value };
    // Reset dependent filters
    if (key === 'subject') {
       newFilters.chapter = ''; 
       newFilters.lesson = '';
    }
    if (key === 'chapter') {
       newFilters.lesson = '';
    }

    if (isControlled) {
      // Merge with existing filters for the parent callback? 
      // Usually parent expects just the change or the full new state.
      // We'll pass the change and let parent handle merge, 
      // OR we merge locally if we are supposed to pass full state.
      // SearchFilters usually passes just the change based on previous code: onFilterChange({ [key]: value });
      // But since we want to clear dependents, we pass multiple.
      onFilterChange(newFilters);
    } else {
      context.setFilters(newFilters);
    }
  };
  
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

  return (
    <div className="search-filters">
      <div>
        <label htmlFor="searchText">Search Text:</label>
        <input
          type="text"
          id="searchText"
          placeholder="Enter keywords..."
          value={activeFilters.searchText || ''}
          onChange={(e) => handleFilterChange('searchText', e.target.value)}
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