import React from 'react';
import { useQuestions } from '../../context/QuestionContext';

export default function SearchFilters() {
  const { questions, currentFilters, setFilters } = useQuestions();
  
  // Get unique values for dropdown options
  const uniqueSubjects = [...new Set(questions.map(q => q.subject).filter(Boolean))];
  const uniqueChapters = [...new Set(questions.map(q => q.chapter).filter(Boolean))];
  const uniqueLessons = [...new Set(questions.map(q => q.lesson).filter(Boolean))];
  const uniqueBoards = [...new Set(questions.map(q => q.board).filter(Boolean))];
  
  const handleFilterChange = (key, value) => {
    setFilters({ [key]: value });
  };
  
  const resetFilters = () => {
    setFilters({
      searchText: '',
      subject: '',
      chapter: '',
      lesson: '',
      type: '',
      board: '',
      language: '',
      flaggedStatus: ''
    });
  };

  return (
    <div className="search-filters">
      <div>
        <label htmlFor="searchText">Search Text:</label>
        <input
          type="text"
          id="searchText"
          placeholder="Enter keywords..."
          value={currentFilters.searchText}
          onChange={(e) => handleFilterChange('searchText', e.target.value)}
        />
      </div>
      
      <div>
        <label htmlFor="filterSubject">Subject:</label>
        <select
          id="filterSubject"
          value={currentFilters.subject}
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
          value={currentFilters.chapter}
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
          value={currentFilters.lesson}
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
          value={currentFilters.type}
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
          value={currentFilters.board}
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
          value={currentFilters.language}
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
          value={currentFilters.flaggedStatus || ''}
          onChange={(e) => handleFilterChange('flaggedStatus', e.target.value)}
          style={{ 
            borderColor: currentFilters.flaggedStatus === 'flagged' ? '#e74c3c' : undefined,
            fontWeight: currentFilters.flaggedStatus === 'flagged' ? 'bold' : 'normal'
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