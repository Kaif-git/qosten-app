import React from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function SearchFilters({ filters, onFilterChange }) {
  const context = useQuestions();
  
  // Determine source of truth: props (controlled) or context (uncontrolled)
  const isControlled = !!filters && !!onFilterChange;
  const activeFilters = isControlled ? filters : context.currentFilters;
  const allQuestions = context.questions; // Always get questions from context for options
  
  // Helper to filter questions based on ACTIVE filters, but excluding the key being generated
  // This allows the user to see all options for a specific filter if they haven't selected it yet,
  // but restricts other filters based on selections.
  // Actually, standard drill-down usually means:
  // - Subject dropdown shows ALL subjects (unless maybe board is selected?)
  // - Chapter dropdown shows chapters for Selected Subject (and Board/Type etc)
  // - Lesson dropdown shows lessons for Selected Chapter (and Subject/Board/Type)
  // - Board dropdown shows boards for Selected Subject/Chapter... or maybe all boards?
  
  // Let's implement strict drill-down:
  // 1. Filter the base list of questions by *other* active filters.
  
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

  // Get unique values for dropdown options based on filtered sets
  const uniqueSubjects = [...new Set(getFilteredFor('subject').map(q => q.subject).filter(Boolean))].sort();
  const uniqueChapters = [...new Set(getFilteredFor('chapter').map(q => q.chapter).filter(Boolean))].sort();
  const uniqueLessons = [...new Set(getFilteredFor('lesson').map(q => q.lesson).filter(Boolean))].sort();
  const uniqueBoards = [...new Set(getFilteredFor('board').map(q => q.board).filter(Boolean))].sort();
  
  const handleFilterChange = (key, value) => {
    if (isControlled) {
      onFilterChange({ [key]: value });
    } else {
      context.setFilters({ [key]: value });
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
      flaggedStatus: ''
    };
    
    if (isControlled) {
      // For controlled mode, we need to pass the full object if the parent expects a merge, 
      // or just call onFilterChange multiple times? 
      // Usually setFilters in context does a merge.
      // Let's assume onFilterChange handles the merge or we pass the full object if it expects full state?
      // Based on typical React patterns, onFilterChange usually updates specific fields.
      // But for a "Reset", we want to set all.
      // Let's iterate or pass a special "reset" object if the parent supports it.
      // Or better: The parent's handler `handleFilterChange` (which we will write) should handle merging.
      // But here we want to replace multiple fields.
      // Let's pass the full reset object and let the parent handle it.
      // Actually, my proposed QuestionBank handler will probably just do `setFilters(prev => ({...prev, ...changes}))`.
      // So passing the full object works.
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
          {uniqueSubjects.map(subject => (
            <option key={subject} value={subject}>{subject}</option>
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
          {uniqueChapters.map(chapter => (
            <option key={chapter} value={chapter}>{chapter}</option>
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
      
      <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
        <button className="secondary" onClick={resetFilters}>Reset Filters</button>
      </div>
    </div>
  );
}