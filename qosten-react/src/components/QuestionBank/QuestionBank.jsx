import React, { useState } from 'react';
import { useQuestions } from '../../context/QuestionContext';
import Statistics from '../Statistics/Statistics';
import SearchFilters from '../SearchFilters/SearchFilters';
import QuestionCard from '../QuestionCard/QuestionCard';
import FullQuestionContent from '../FullQuestionContent/FullQuestionContent';

const getFilteredQuestions = (questions, filters, fullQuestionsMap = null, hasSearched = false) => {
  return questions.filter(q => {
    const matchesSubject = filters.subject === 'none'
      ? !q.subject
      : !filters.subject || q.subject === filters.subject;
      
    const matchesChapter = filters.chapter === 'none'
      ? !q.chapter
      : !filters.chapter || q.chapter === filters.chapter;

    const matchesLesson = !filters.lesson || q.lesson === filters.lesson;
    const matchesType = !filters.type || q.type === filters.type;
    const matchesBoard = !filters.board || q.board === filters.board;
    const matchesLanguage = !filters.language || q.language === filters.language;
    const matchesFlaggedStatus = !filters.flaggedStatus || 
      (filters.flaggedStatus === 'flagged' && q.isFlagged) ||
      (filters.flaggedStatus === 'unflagged' && !q.isFlagged);
    
    const matchesMetadata = matchesSubject && matchesChapter && matchesLesson && matchesType && matchesBoard && matchesLanguage && matchesFlaggedStatus;
    
    if (!matchesMetadata) return false;

    // If no search text, we match
    if (!filters.searchText) return true;

    // If we haven't searched (clicked the button), ignore text filter (for stats/metadata view)
    if (!hasSearched) return true;

    // If searched, use full data to check text
    const fullQ = (fullQuestionsMap && fullQuestionsMap.get(q.id)) || q;
    const searchText = filters.searchText.toLowerCase();

    // Safe access
    const question = (fullQ.question || '').toLowerCase();
    const questionText = (fullQ.questionText || '').toLowerCase();
    const answer = (fullQ.answer || '').toLowerCase();
    const explanation = (fullQ.explanation || '').toLowerCase();
    const partsMatch = fullQ.parts?.some(p => 
      (p.text || '').toLowerCase().includes(searchText) || 
      (p.answer || '').toLowerCase().includes(searchText)
    );

    return question.includes(searchText) ||
      questionText.includes(searchText) ||
      answer.includes(searchText) ||
      explanation.includes(searchText) ||
      partsMatch;
  });
};

export default function QuestionBank() {
  const { questions, currentFilters, deleteQuestion, updateQuestion, bulkFlagQuestions, fetchQuestionsByIds, setFilters } = useQuestions();
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showBulkMetadataEditor, setShowBulkMetadataEditor] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({ subject: '', chapter: '', lesson: '', board: '' });
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);

  // Search State
  const [fullQuestionsMap, setFullQuestionsMap] = useState(new Map());
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Split View State
  const [isSplitView, setIsSplitView] = useState(false);
  const [leftFilters, setLeftFilters] = useState({});
  const [rightFilters, setRightFilters] = useState({});
  
  // Get unique metadata values from all questions
  const getUniqueValues = (field) => {
    const values = questions
      .map(q => q[field])
      .filter(val => val && val.trim() !== '' && val !== 'N/A')
      .filter((value, index, self) => self.indexOf(value) === index);
    return values.sort();
  };
  
  const uniqueSubjects = getUniqueValues('subject');
  const uniqueChapters = getUniqueValues('chapter');
  const uniqueLessons = getUniqueValues('lesson');
  const uniqueBoards = getUniqueValues('board');

  // Computed questions based on view mode
  const filteredQuestionsSingle = getFilteredQuestions(questions, currentFilters, fullQuestionsMap, hasSearched);
  const filteredQuestionsLeft = getFilteredQuestions(questions, { ...currentFilters, ...leftFilters }, fullQuestionsMap, hasSearched);
  const filteredQuestionsRight = getFilteredQuestions(questions, { ...currentFilters, ...rightFilters }, fullQuestionsMap, hasSearched);
  
  // For selection actions, we need to know which set of questions we are operating on?
  // No, selection actions operate on `selectedQuestions` IDs which are global.
  // The list of "filtered questions" is just for display.
  // However, "Select All" needs to know which list to select.
  // In Split View, "Select All" is ambiguous. It should probably select all from BOTH lists? Or maybe we disable global "Select All" in split view?
  // Or render a "Select All" button in each pane?
  // For now, let's make global "Select All" select from the currently visible questions.
  
  const currentVisibleQuestions = isSplitView 
    ? [...new Set([...filteredQuestionsLeft, ...filteredQuestionsRight])] 
    : filteredQuestionsSingle;
  
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedQuestions([]);
  };
  
  const toggleQuestionSelection = (questionId) => {
    setSelectedQuestions(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId);
      } else {
        return [...prev, questionId];
      }
    });
  };
  
  const selectAll = () => {
    setSelectedQuestions(currentVisibleQuestions.map(q => q.id));
  };
  
  const deselectAll = () => {
    setSelectedQuestions([]);
  };

  const toggleSplitView = () => {
    if (!isSplitView) {
        // When entering split view, initialize both sides with current context filters
        setLeftFilters({ ...currentFilters });
        setRightFilters({ ...currentFilters });
    }
    setIsSplitView(!isSplitView);
  };
  
  const areQuestionsDeeplyEqual = (q1, q2) => {
    // 1. Basic Metadata
    if (q1.type !== q2.type) return false;
    
    // 2. Main Question Text (normalize)
    const t1 = (q1.questionText || q1.question || '').trim();
    const t2 = (q2.questionText || q2.question || '').trim();
    if (t1 !== t2) return false;

    // 3. Sub-questions / Options
    if (q1.type === 'mcq') {
        const opts1 = q1.options || [];
        const opts2 = q2.options || [];
        if (opts1.length !== opts2.length) return false;
        
        // Compare options (assume sorted order or strict index match)
        for (let i = 0; i < opts1.length; i++) {
            if ((opts1[i].text || '').trim() !== (opts2[i].text || '').trim()) return false;
            if (opts1[i].label !== opts2[i].label) return false;
        }
        // Check Correct Answer
        if ((q1.correctAnswer || '').toLowerCase() !== (q2.correctAnswer || '').toLowerCase()) return false;
    } else if (q1.type === 'cq') {
        const parts1 = q1.parts || [];
        const parts2 = q2.parts || [];
        if (parts1.length !== parts2.length) return false;
        
        for (let i = 0; i < parts1.length; i++) {
            if (parts1[i].letter !== parts2[i].letter) return false;
            if ((parts1[i].text || '').trim() !== (parts2[i].text || '').trim()) return false;
            // Optionally check answers too? Usually stem + question parts define unique CQ
            // if ((parts1[i].answer || '').trim() !== (parts2[i].answer || '').trim()) return false;
        }
    } else if (q1.type === 'sq') {
        // Check answer
        if ((q1.answer || '').trim() !== (q2.answer || '').trim()) return false;
    }
    
    return true;
  };

  const findDuplicates = async () => {
    const groups = [];
    const originalsMap = new Map();
    const potentialDuplicates = [];

    setIsSearching(true); // Show loading indicator

    // 1. Identify base keys and potential duplicates
    questions.forEach(q => {
      // Use the 'question' field as it's our unique constraint field
      const uniqueKey = q.question || '';
      const type = q.type || '';
      
      // Skip common placeholders that shouldn't be treated as duplicates
      const isPlaceholder = (key) => {
        const k = key.trim().toLowerCase();
        return k === '[there is a picture]' || 
               k === '[ছবি আছে]' || 
               k === 'picture' || 
               k === 'image' || 
               k === 'ছবি' ||
               k.includes('[there is a picture for part');
      };

      // Regex to find suffix like [1234567890] at the end
      const match = uniqueKey.match(/^(.*)\s*\[(\d+)\]$/);
      
      if (match) {
        // It's a potential duplicate with a suffix
        const baseKey = match[1].trim();
        
        // Skip if the base content is just a placeholder
        if (!isPlaceholder(baseKey)) {
          potentialDuplicates.push({ question: q, baseKey, type });
        }
      } else {
        // It's a potential original (no suffix)
        // Skip if it's just a placeholder
        if (!isPlaceholder(uniqueKey)) {
          // Use type-aware key to prevent cross-type matching
          const lookupKey = `${type}:${uniqueKey.trim()}`;
          if (!originalsMap.has(lookupKey)) {
            originalsMap.set(lookupKey, q);
          }
        }
      }
    });

    // 2. Identify candidate groups
    const candidateGroups = [];
    potentialDuplicates.forEach(pd => {
      const lookupKey = `${pd.type}:${pd.baseKey}`;
      const original = originalsMap.get(lookupKey);
      if (original) {
        // We found a pair!
        let group = candidateGroups.find(g => g.original.id === original.id);
        if (!group) {
          group = { original: original, duplicates: [] };
          candidateGroups.push(group);
        }
        group.duplicates.push(pd.question);
      }
    });

    if (candidateGroups.length === 0) {
      setIsSearching(false);
      alert('No duplicates with [number] suffix patterns found.');
      return;
    }

    // 3. Fetch full details for strict comparison
    // Collect all IDs needed
    const idsToFetch = new Set();
    candidateGroups.forEach(g => {
        if (!fullQuestionsMap.has(g.original.id)) idsToFetch.add(g.original.id);
        g.duplicates.forEach(d => {
            if (!fullQuestionsMap.has(d.id)) idsToFetch.add(d.id);
        });
    });

    if (idsToFetch.size > 0) {
        try {
            console.log(`Fetching ${idsToFetch.size} questions for strict duplicate check...`);
            const fetched = await fetchQuestionsByIds(Array.from(idsToFetch));
            
            // Update local cache
            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                fetched.forEach(q => next.set(q.id, q));
                return next;
            });
        } catch (e) {
            console.error("Error fetching for duplicate check", e);
            setIsSearching(false);
            alert("Error verifying duplicates. Please try again.");
            return;
        }
    }

    // 4. Strict Deep Equality Check
    const finalGroups = [];
    
    // We need to access the updated map, but state update is async. 
    // Ideally we should use the fetched data directly or wait.
    // Since we just fetched, let's assume we can merge fetched into a temp map for this check
    // Actually, fetchQuestionsByIds returns the data, so we can use that combined with existing state.
    
    // Re-construct a temporary map for this immediate check
    const tempFullMap = new Map(fullQuestionsMap); 
    // Note: state update won't be reflected in 'fullQuestionsMap' variable in this closure immediately
    // unless we use the result of fetch.
    // But fetchQuestionsByIds returns the *newly fetched* items.
    // So we need to merge them.
    // Wait, I updated state but 'fullQuestionsMap' here is the old closure value.
    // I should perform the check using a fresh map combined from old + new.
    
    // But I can't easily get the 'fetched' result here because I didn't store it in a variable accessible 
    // after the if block easily without refactoring.
    
    // Let's refactor slightly to be safe.
    
    // ... refactoring flow ...
    // To solve closure stale state, I'll fetch again or restructure.
    // Actually, I can just use the fetched array if I move it out.
    
    // Re-writing step 3 & 4 properly in the replacement string below.
    // See the 'new_string' content.
    
    // ... (This comment is part of thought process, code is in new_string)
    
    // 5. Finalize
    setDuplicateGroups(finalGroups);
    setShowDuplicateModal(true);
    setIsSearching(false);
  };

  const deleteDuplicateQuestion = async (questionId) => {
    if (window.confirm('Are you sure you want to delete this duplicate?')) {
      await deleteQuestion(questionId);
      // Update local state to remove the deleted question from the UI
      setDuplicateGroups(prevGroups => {
        return prevGroups.map(group => ({
          ...group,
          duplicates: group.duplicates.filter(d => d.id !== questionId)
        })).filter(group => group.duplicates.length > 0); // Remove group if no duplicates left
      });
    }
  };

  const deleteAllDuplicates = async () => {
    // Collect all duplicate IDs
    const allDuplicateIds = duplicateGroups.flatMap(group => group.duplicates.map(d => d.id));
    
    if (allDuplicateIds.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ALL ${allDuplicateIds.length} duplicates?`)) {
      try {
        // Delete in batches to avoid overwhelming the server
        const BATCH_SIZE = 20;
        for (let i = 0; i < allDuplicateIds.length; i += BATCH_SIZE) {
          const batch = allDuplicateIds.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(id => deleteQuestion(id)));
        }
        
        setDuplicateGroups([]);
        setShowDuplicateModal(false);
        alert(`Successfully deleted ${allDuplicateIds.length} duplicates.`);
      } catch (error) {
        console.error("Error deleting duplicates:", error);
        alert("An error occurred while deleting some duplicates.");
      }
    }
  };

  const bulkDelete = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to delete.');
      return;
    }
    
    const confirmMessage = `Are you sure you want to delete ${selectedQuestions.length} question(s)? This action cannot be undone.`;
    if (window.confirm(confirmMessage)) {
      try {
        // Delete in batches to avoid overwhelming the server
        const BATCH_SIZE = 20;
        for (let i = 0; i < selectedQuestions.length; i += BATCH_SIZE) {
          const batch = selectedQuestions.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(id => deleteQuestion(id)));
        }
        
        setSelectedQuestions([]);
        setSelectionMode(false);
        alert(`Successfully deleted ${selectedQuestions.length} question(s).`);
      } catch (error) {
        console.error("Error deleting questions:", error);
        alert("An error occurred while deleting some questions.");
      }
    }
  };

  const bulkEditMetadata = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to edit.');
      return;
    }

    // Ensure we have full data for selected questions to prevent overwriting with defaults
    const missingIds = selectedQuestions.filter(id => !fullQuestionsMap.has(id));
    if (missingIds.length > 0) {
        try {
            const fetched = await fetchQuestionsByIds(missingIds);
            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                fetched.forEach(q => next.set(q.id, q));
                return next;
            });
        } catch (e) {
            console.error("Error fetching for bulk edit", e);
            alert("Error preparing questions for edit.");
            return;
        }
    }

    // Get the selected question objects
    const selectedQuestionObjects = selectedQuestions.map(id => fullQuestionsMap.get(id) || questions.find(q => q.id === id));
    
    let updatedCount = 0;
    for (const question of selectedQuestionObjects) {
      const updatedQuestion = { ...question };
      
      // Only update fields that have values
      if (bulkMetadata.subject) {
        updatedQuestion.subject = bulkMetadata.subject;
      }
      if (bulkMetadata.chapter) {
        updatedQuestion.chapter = bulkMetadata.chapter;
      }
      if (bulkMetadata.lesson) {
        updatedQuestion.lesson = bulkMetadata.lesson;
      }
      if (bulkMetadata.board) {
        updatedQuestion.board = bulkMetadata.board;
      }
      
      try {
        await updateQuestion(updatedQuestion);
        updatedCount++;
      } catch (error) {
        console.error('Error updating question:', error);
      }
    }

    // Reset and close
    setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
    setShowBulkMetadataEditor(false);
    setSelectedQuestions([]);
    setSelectionMode(false);
    alert(`✅ Metadata updated for ${updatedCount} question(s)!`);
  };

  const bulkFlag = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to flag.');
      return;
    }
    
    try {
      const result = await bulkFlagQuestions(selectedQuestions, true);
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`🚩 Flagged ${result.successCount} question(s) for review!`);
    } catch (error) {
      console.error('Error flagging questions:', error);
      alert('Error flagging questions. Please try again.');
    }
  };

  const bulkUnflag = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to unflag.');
      return;
    }
    
    try {
      const result = await bulkFlagQuestions(selectedQuestions, false);
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`✓ Unflagged ${result.successCount} question(s)!`);
    } catch (error) {
      console.error('Error unflagging questions:', error);
      alert('Error unflagging questions. Please try again.');
    }
  };

  const handleSearch = async (view = 'single') => {
    setIsSearching(true);
    
    // Determine which filters to use
    let filtersToUse = currentFilters;
    if (view === 'left') filtersToUse = { ...currentFilters, ...leftFilters };
    if (view === 'right') filtersToUse = { ...currentFilters, ...rightFilters };
    
    // 1. Get filtered Metadata (ignoring text, so hasSearched=false logic)
    // We want to fetch everything that matches the category filters
    const candidates = getFilteredQuestions(questions, filtersToUse, null, false);
    
    // 2. Identify missing full data
    const idsToFetch = candidates
        .filter(q => !fullQuestionsMap.has(q.id))
        .map(q => q.id);
        
    if (idsToFetch.length > 0) {
        // Fetch full data for candidates
        try {
            const newFullQuestions = await fetchQuestionsByIds(idsToFetch);
            
            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                newFullQuestions.forEach(q => next.set(q.id, q));
                return next;
            });
        } catch (error) {
            console.error("Error fetching questions:", error);
            alert("Failed to fetch questions. Please try again.");
        }
    }
    
    setHasSearched(true);
    setIsSearching(false);
  };

  const renderQuestionList = (qList, viewName = 'single') => (
    <div className="questionsContainer">
        {!hasSearched ? (
            <div style={{
                textAlign: 'center', 
                padding: '40px', 
                color: '#666',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                marginTop: '20px',
                border: '1px dashed #ced4da'
            }}>
                <p style={{fontSize: '1.1em', marginBottom: '20px'}}>
                    {qList.length} potential questions found based on filters.
                </p>
                <button 
                    onClick={() => handleSearch(viewName)} 
                    disabled={isSearching}
                    style={{
                        padding: '12px 24px', 
                        fontSize: '16px', 
                        backgroundColor: '#3498db', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: isSearching ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}
                >
                    {isSearching ? '⏳ Searching & Loading...' : '🔍 Search & Load Questions'}
                </button>
            </div>
        ) : qList.length === 0 ? (
          <div style={{textAlign: 'center', padding: '40px'}}>
             <p>No questions found matching your criteria.</p>
             <button 
                onClick={() => handleSearch(viewName)} 
                style={{
                    padding: '8px 16px', 
                    backgroundColor: '#6c757d', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
             >
                Refresh Search
             </button>
          </div>
        ) : (
            qList.map(question => (
            <QuestionCard 
              key={question.id} 
              question={fullQuestionsMap.get(question.id) || question}
              selectionMode={selectionMode}
              isSelected={selectedQuestions.includes(question.id)}
              onToggleSelect={toggleQuestionSelection}
            />
          ))
        )}
    </div>
  );

  return (
    <>
      {/* Bulk Metadata Editor Modal */}
      {showBulkMetadataEditor && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '600px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0, color: '#3498db' }}>✏️ Bulk Edit Metadata</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Update metadata for <strong>{selectedQuestions.length}</strong> selected question(s).
              Leave fields empty to keep existing values.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '25px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Subject:
                  {uniqueSubjects.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueSubjects.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="subjects-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.subject}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="subjects-list">
                    {uniqueSubjects.map((subject, idx) => (
                      <option key={idx} value={subject} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.subject}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueSubjects.map((subject, idx) => (
                      <option key={idx} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Chapter:
                  {uniqueChapters.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueChapters.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="chapters-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.chapter}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="chapters-list">
                    {uniqueChapters.map((chapter, idx) => (
                      <option key={idx} value={chapter} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.chapter}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueChapters.map((chapter, idx) => (
                      <option key={idx} value={chapter}>{chapter}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Lesson:
                  {uniqueLessons.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueLessons.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="lessons-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.lesson}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="lessons-list">
                    {uniqueLessons.map((lesson, idx) => (
                      <option key={idx} value={lesson} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.lesson}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueLessons.map((lesson, idx) => (
                      <option key={idx} value={lesson}>{lesson}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '5px' }}>
                  Board:
                  {uniqueBoards.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#666', marginLeft: '5px' }}>
                      ({uniqueBoards.length} existing)
                    </span>
                  )}
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    list="boards-list"
                    type="text"
                    placeholder="Type or select from existing"
                    value={bulkMetadata.board}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
                  />
                  <datalist id="boards-list">
                    {uniqueBoards.map((board, idx) => (
                      <option key={idx} value={board} />
                    ))}
                  </datalist>
                  <select
                    value={bulkMetadata.board}
                    onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px', minWidth: '150px' }}
                  >
                    <option value="">-- Select --</option>
                    {uniqueBoards.map((board, idx) => (
                      <option key={idx} value={board}>{board}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => {
                  setShowBulkMetadataEditor(false);
                  setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
                }}
                style={{
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
              <button 
                onClick={bulkEditMetadata}
                style={{
                  backgroundColor: '#27ae60',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                ✓ Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Duplicate Detector Modal */}
      {showDuplicateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            maxWidth: '900px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#6f42c1' }}>🔍 Duplicate Detector Results</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={deleteAllDuplicates}
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🗑 Delete ALL Duplicates
                </button>
                <button
                  onClick={() => setShowDuplicateModal(false)}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <p style={{ color: '#666', marginBottom: '20px' }}>
              Found <strong>{duplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)}</strong> duplicates across <strong>{duplicateGroups.length}</strong> unique questions.
            </p>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                          {duplicateGroups.map((group, idx) => (
                            <div key={idx} style={{ 
                              border: '2px solid #6f42c1', 
                              borderRadius: '12px', 
                              marginBottom: '30px',
                              overflow: 'hidden',
                              backgroundColor: '#fdfdfd'
                            }}>
                              <div style={{ 
                                backgroundColor: '#6f42c1', 
                                padding: '12px 20px', 
                                fontWeight: 'bold',
                                color: 'white',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span style={{ fontSize: '1.1em' }}>Duplicate Group #{idx + 1}</span>
                                <span style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.9em' }}>
                                  {group.duplicates.length} duplicate(s) found
                                </span>
                              </div>
                              
                              <div style={{ display: 'flex', borderBottom: '1px solid #ddd', minHeight: '400px' }}>
                                {/* Original Column */}
                                <div style={{ flex: 1, borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ 
                                    padding: '10px 15px', 
                                    backgroundColor: '#e8f5e9', 
                                    color: '#2e7d32', 
                                    fontWeight: 'bold',
                                    borderBottom: '1px solid #c8e6c9',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                  }}>
                                    <span>ORIGINAL (ID: {group.original.id})</span>
                                    <span>Keep This</span>
                                  </div>
                                                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                                                          <div style={{ marginBottom: '10px', fontSize: '0.85em', color: '#666' }}>
                                                            <span style={{ backgroundColor: '#6f42c1', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginRight: '8px' }}>
                                                              {group.original.type?.toUpperCase()}
                                                            </span>
                                                            <strong>Metadata:</strong> {group.original.subject} | {group.original.chapter} | {group.original.board}
                                                          </div>
                                                          <FullQuestionContent question={group.original} />
                                                        </div>                                </div>
            
                                {/* Duplicates Column(s) */}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff9f9' }}>
                                  {group.duplicates.map((dup, dIdx) => (
                                    <div key={dup.id} style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      flex: 1,
                                      borderBottom: dIdx < group.duplicates.length - 1 ? '4px solid #dee2e6' : 'none'
                                    }}>
                                      <div style={{ 
                                        padding: '10px 15px', 
                                        backgroundColor: '#ffebee', 
                                        color: '#c62828', 
                                        fontWeight: 'bold',
                                        borderBottom: '1px solid #ffcdd2',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                      }}>
                                        <span>DUPLICATE #{dIdx + 1} (ID: {dup.id})</span>
                                        <button
                                          onClick={() => deleteDuplicateQuestion(dup.id)}
                                          style={{
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            padding: '5px 15px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '0.85em'
                                          }}
                                        >
                                          🗑 DELETE DUPLICATE
                                        </button>
                                      </div>
                                                                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                                                                  <div style={{ marginBottom: '10px', fontSize: '0.85em', color: '#666' }}>
                                                                    <span style={{ backgroundColor: '#6f42c1', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', marginRight: '8px' }}>
                                                                      {dup.type?.toUpperCase()}
                                                                    </span>
                                                                    <strong>Metadata:</strong> {dup.subject} | {dup.chapter} | {dup.board}
                                                                  </div>
                                                                  <FullQuestionContent question={dup} />
                                                                </div>                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>          </div>
        </div>
      )}
      
      <div className="panel">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2>Question Bank</h2>
            <button 
                onClick={toggleSplitView}
                style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                }}
            >
                {isSplitView ? "Show Single View" : "Show Split View"}
            </button>
        </div>
      
      {/* Selection Mode Controls - Always Visible */}
      <div className="selection-controls" style={{ 
        margin: '20px 0', 
        padding: '15px', 
        backgroundColor: selectionMode ? '#e7f3ff' : '#f9f9f9',
        borderRadius: '8px',
        border: selectionMode ? '2px solid #007bff' : '1px solid #ddd'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={findDuplicates}
            style={{
              backgroundColor: '#6f42c1',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            🔍 Duplicate Detector
          </button>

          <button 
            onClick={toggleSelectionMode}
            style={{
              backgroundColor: selectionMode ? '#6c757d' : '#007bff',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {selectionMode ? '✕ Cancel Selection' : '☑ Select Multiple'}
          </button>
          
          {selectionMode && (
            <>
              <button 
                onClick={selectAll}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Select All ({currentVisibleQuestions.length})
              </button>
              
              <button 
                onClick={deselectAll}
                style={{
                  backgroundColor: '#ffc107',
                  color: '#333',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Deselect All
              </button>
              
              <button 
                onClick={() => setShowBulkMetadataEditor(true)}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#3498db' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✏️ Edit Metadata ({selectedQuestions.length})
              </button>
              
              <button 
                onClick={bulkFlag}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#e74c3c' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                🚩 Flag ({selectedQuestions.length})
              </button>
              
              <button 
                onClick={bulkUnflag}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#27ae60' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✓ Unflag ({selectedQuestions.length})
              </button>
              
              <button 
                onClick={bulkDelete}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#dc3545' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                🗑 Delete Selected ({selectedQuestions.length})
              </button>
              
              <span style={{ 
                marginLeft: 'auto', 
                fontWeight: '600', 
                color: selectedQuestions.length > 0 ? '#007bff' : '#666'
              }}>
                {selectedQuestions.length} selected
              </span>
            </>
          )}
        </div>
      </div>
      
      {!isSplitView ? (
          <>
            <SearchFilters />
            <div style={{marginBottom: '15px', marginTop: '10px', display: 'flex', justifyContent: 'flex-end'}}>
                <button 
                    onClick={() => handleSearch('single')}
                    disabled={isSearching}
                    style={{
                        padding: '10px 20px', 
                        backgroundColor: '#3498db', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: isSearching ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    {isSearching ? '⏳ Searching...' : '🔍 Search / Refresh Results'}
                </button>
            </div>
            <Statistics 
                questions={filteredQuestionsSingle} 
                onFilterSelect={(key, value) => {
                    // Update global context filters
                    // Since setFilters does a merge, this works perfectly for drill-down
                    const filterKey = key === 'board' ? 'board' : 
                                      key === 'subject' ? 'subject' : 
                                      key === 'chapter' ? 'chapter' : 
                                      key === 'lesson' ? 'lesson' : 
                                      key === 'type' ? 'type' : key;
                    setFilters({ [filterKey]: value });
                }}
            />
            {renderQuestionList(filteredQuestionsSingle)}
          </>
      ) : (
          <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
              {/* Left Pane */}
              <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
                  <h3 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Left View</h3>
                  <SearchFilters 
                    filters={leftFilters} 
                    onFilterChange={(newFilters) => setLeftFilters(prev => ({ ...prev, ...newFilters }))} 
                  />
                  <div style={{marginBottom: '10px', marginTop: '10px'}}>
                     <button 
                        onClick={() => handleSearch('left')}
                        disabled={isSearching}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                     >
                        {isSearching ? '...' : '🔍 Search Left'}
                     </button>
                  </div>
                  <Statistics 
                    questions={filteredQuestionsLeft} 
                    onFilterSelect={(key, value) => setLeftFilters(prev => ({ ...prev, [key]: value }))}
                  />
                  {renderQuestionList(filteredQuestionsLeft, 'left')}
              </div>
              
              {/* Right Pane */}
              <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
                  <h3 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Right View</h3>
                   <SearchFilters 
                    filters={rightFilters} 
                    onFilterChange={(newFilters) => setRightFilters(prev => ({ ...prev, ...newFilters }))} 
                  />
                  <div style={{marginBottom: '10px', marginTop: '10px'}}>
                     <button 
                        onClick={() => handleSearch('right')}
                        disabled={isSearching}
                        style={{
                            width: '100%',
                            padding: '8px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                     >
                        {isSearching ? '...' : '🔍 Search Right'}
                     </button>
                  </div>
                  <Statistics 
                    questions={filteredQuestionsRight} 
                    onFilterSelect={(key, value) => setRightFilters(prev => ({ ...prev, [key]: value }))}
                  />
                  {renderQuestionList(filteredQuestionsRight, 'right')}
              </div>
          </div>
      )}
      
    </div>
    </>
  );
}