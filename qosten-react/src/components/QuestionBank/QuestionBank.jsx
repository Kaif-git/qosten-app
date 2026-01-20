import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuestions, cleanText, mapDatabaseToApp } from '../../context/QuestionContext';
import { questionApi } from '../../services/questionApi';
import Statistics from '../Statistics/Statistics';
import SearchFilters from '../SearchFilters/SearchFilters';
import QuestionCard from '../QuestionCard/QuestionCard';
import FullQuestionContent from '../FullQuestionContent/FullQuestionContent';
import { detectAndFixCQ } from '../../utils/cqFixUtils';
import { detectAndFixMCQOptions } from '../../utils/mcqFixUtils';
import { performImageMigration, getMigrationPreview } from '../../utils/imageMigration';

// Helper to fix corrupted MCQ format
const fixCorruptedMCQ = (text) => {
  if (!text) return null;
  
  // Clean up prefixes
  // Remove "Question:", "(N/A)", "(-)", "MCQ:", "MCQ:MCQ:" recursively
  let cleanText = text;
  let previousText = '';
  
  // Keep replacing prefixes until no change to handle nested/repeated patterns
  while (cleanText !== previousText) {
    previousText = cleanText;
    cleanText = cleanText
      .replace(/^Question:\s*/i, '')
      .replace(/^\(N\/A\)\s*/i, '')
      .replace(/^\(-\)\s*/i, '')
      .replace(/^MCQ:\s*/i, '')
      .trim();
  }
  
  // 1. Check for Standard Format: |a: ... |Ans: ...
  const optionsStartIndex = cleanText.search(/\|[a-d]:/i);
  
  if (optionsStartIndex !== -1) {
      const questionText = cleanText.substring(0, optionsStartIndex).trim();
      const remainder = cleanText.substring(optionsStartIndex);
      
      const parts = remainder.split('|').filter(p => p.trim());
      const options = [];
      let correctAnswer = null;
      
      parts.forEach(part => {
        const optMatch = part.match(/^([a-d]):\s*(.*)/i);
        const ansMatch = part.match(/^Ans:\s*([a-d])/i);
        
        if (optMatch) {
          options.push({
            label: optMatch[1].toLowerCase(),
            text: optMatch[2].trim()
          });
        } else if (ansMatch) {
          correctAnswer = ansMatch[1].toLowerCase();
        }
      });
      
      if (options.length === 0) return null;
      return { questionText, options, correctAnswer };
  }

  // 2. Check for Bengali Inline Format
  // Example: '...' ক) ... খ) ... সঠিক: খ ব্যাখ্যা: ...
  // Detect presence of Bengali options (ক), খ), etc) and 'সঠিক:' marker
  if (cleanText.includes('সঠিক:') || (cleanText.includes('ক)') && cleanText.includes('খ)'))) {
      // Extract Question Text: Everything before the first option 'ক)'
      const firstOptionIndex = cleanText.search(/\s+ক\)/);
      if (firstOptionIndex === -1) return null;

      const questionText = cleanText.substring(0, firstOptionIndex).trim();
      const remainder = cleanText.substring(firstOptionIndex);

      // Regex to parse:
      // ক) (option) খ) (option) ... সঠিক: (ans) ব্যাখ্যা: (explanation)
      // Note: explanation is optional
      
      const options = [];
      let correctAnswer = null;
      let explanation = null;

      // Helper to extract value between markers
      // Markers: ক), খ), গ), ঘ), সঠিক:, ব্যাখ্যা:
      const markers = ['ক\\)', 'খ\\)', 'গ\\)', 'ঘ\\)', 'সঠিক:', 'ব্যাখ্যা:'];
      const regexPattern = `(${markers.join('|')})\\s*(.*?)(?=(?:${markers.join('|')})|$)`;
      const regex = new RegExp(regexPattern, 'g');
      
      let match;
      while ((match = regex.exec(remainder)) !== null) {
          const marker = match[1]; // e.g. "ক)" or "সঠিক:"
          const content = match[2].trim();
          
          if (marker === 'ক)') options.push({ label: 'a', text: content });
          else if (marker === 'খ)') options.push({ label: 'b', text: content });
          else if (marker === 'গ)') options.push({ label: 'c', text: content });
          else if (marker === 'ঘ)') options.push({ label: 'd', text: content });
          else if (marker === 'সঠিক:') {
              // Map Bengali answer to English letter
              const ansMap = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' };
              // clean content might be "খ" or "খ।" etc.
              const cleanAns = content.replace(/[।.]/g, '').trim();
              correctAnswer = ansMap[cleanAns] || cleanAns;
          }
          else if (marker === 'ব্যাখ্যা:') {
              explanation = content;
          }
      }

      if (options.length === 0) return null;

      return {
          questionText,
          options,
          correctAnswer,
          explanation // Return explanation to be saved
      };
  }
  
  return null;
};

// Helper to fix corrupted SQ format
const fixCorruptedSQ = (text) => {
  if (!text) return null;
  
  let cleanText = text.trim();
  
  // 1. Extract Board if present (e.g., "(Monipur High School and College, Dhaka)")
  let board = '';
  const boardMatch = cleanText.match(/^\(([^)]+)\)/);
  if (boardMatch) {
    board = boardMatch[1].trim();
    cleanText = cleanText.replace(/^\([^)]+\)\s*/, '').trim();
  }

  // 2. Remove Prefixes
  cleanText = cleanText
    .replace(/^Question:\s*/i, '')
    .replace(/^SQ:\s*/i, '')
    .trim();

  // 3. Split Question and Answer (e.g., "What is...?|Ans:Haji...")
  if (cleanText.includes('|Ans:')) {
    const parts = cleanText.split('|Ans:');
    const questionText = parts[0].trim();
    const answer = parts[1].trim();
    
    return { questionText, answer, board };
  }
  
  // Bengali Support (সঠিক: or উত্তর:)
  if (cleanText.includes('উত্তর:') || cleanText.includes('সঠিক:')) {
    const marker = cleanText.includes('উত্তর:') ? 'উত্তর:' : 'সঠিক:';
    const parts = cleanText.split(marker);
    const questionText = parts[0].trim();
    const answer = parts[1].trim();
    
    return { questionText, answer, board };
  }

  return null;
};

const getFilteredQuestions = (questions, filters, fullQuestionsMap = null, hasSearched = false) => {
  // Stage 1: Metadata Filtering (Fast)
  let result = questions.filter(q => {
    const qSubject = (q.subject || '').trim();
    const qChapter = (q.chapter || '').trim();
    const fSubject = (filters.subject || '').trim();
    const fChapter = (filters.chapter || '').trim();

    const matchesSubject = filters.subject === 'none'
      ? !q.subject
      : !filters.subject || qSubject === fSubject;
      
    const matchesChapter = filters.chapter === 'none'
      ? !q.chapter
      : !filters.chapter || qChapter === fChapter;

    const matchesLesson = !filters.lesson || q.lesson === filters.lesson;
    const matchesType = !filters.type || 
      (filters.type === 'Unspecified' 
        ? (!q.type || q.type === 'other' || q.type === 'Unspecified') 
        : q.type === filters.type);

    const matchesBoard = !filters.board || q.board === filters.board;
    const matchesLanguage = !filters.language || q.language === filters.language;
    const matchesFlaggedStatus = !filters.flaggedStatus || 
      (filters.flaggedStatus === 'flagged' && q.isFlagged) ||
      (filters.flaggedStatus === 'unflagged' && !q.isFlagged);

    const matchesVerifiedStatus = !filters.verifiedStatus || filters.verifiedStatus === 'all' ||
      (filters.verifiedStatus === 'verified' && q.isVerified) ||
      (filters.verifiedStatus === 'unverified' && !q.isVerified);
    
    return matchesSubject && matchesChapter && matchesLesson && matchesType && matchesBoard && matchesLanguage && matchesFlaggedStatus && matchesVerifiedStatus;
  });

  // Stage 2: Text Search (Expensive - only if needed and searched)
  if (filters.searchText && hasSearched) {
    const searchText = filters.searchText.toLowerCase();
    result = result.filter(q => {
      const fullQ = (fullQuestionsMap && fullQuestionsMap.get(q.id)) || q;
      
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
  }

  return result.sort((a, b) => parseInt(b.id) - parseInt(a.id));
};

export default function QuestionBank() {
  const { 
    questions, 
    setQuestions, 
    currentFilters, 
    deleteQuestion, 
    updateQuestion, 
    bulkUpdateQuestions, 
    bulkFlagQuestions, 
    fetchQuestionsByIds, 
    setFilters, 
    fetchMoreQuestions, 
    fetchAllRemaining, 
    clearCache, 
    hierarchy,
    refreshQuestions
  } = useQuestions();
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState(null); // Track last selected for shift-click

  const [showBulkMetadataEditor, setShowBulkMetadataEditor] = useState(false);
  const [bulkMetadata, setBulkMetadata] = useState({ subject: '', chapter: '', lesson: '', board: '' });
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateResultsFilters, setDuplicateResultsFilters] = useState({ subject: '', chapter: '', type: '' });
  const [duplicateGroups, setDuplicateGroups] = useState([]);

  // Memoized filtered duplicate groups for display and deletion
  const displayDuplicateGroups = React.useMemo(() => {
    return duplicateGroups.filter(g => {
      if (duplicateResultsFilters.subject && g.original.subject !== duplicateResultsFilters.subject) return false;
      if (duplicateResultsFilters.chapter && g.original.chapter !== duplicateResultsFilters.chapter) return false;
      if (duplicateResultsFilters.type && g.original.type !== duplicateResultsFilters.type) return false;
      return true;
    });
  }, [duplicateGroups, duplicateResultsFilters]);

  // Search State
  const [fullQuestionsMap, setFullQuestionsMap] = useState(new Map());
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [isSyncingMetadata, setIsSyncingMetadata] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [showStats, setShowStats] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]); // [{type, key}]
  const [lastSelectedCategory, setLastSelectedCategory] = useState(null); // {type, key}
  
  // Bulk Fix Flagged Questions State
  const [showBulkFixModal, setShowBulkFixModal] = useState(false);
  const [bulkFixType, setBulkFixType] = useState('mcq'); // 'mcq', 'cq', 'sq'
  const [bulkFixInputText, setBulkFixInputText] = useState('');

  // Review Queue State
  const [showReviewQueueModal, setShowReviewQueueModal] = useState(false);
  const [reviewQueueType, setReviewQueueType] = useState('mcq');
  const [reviewQueueInputText, setReviewQueueInputText] = useState('');

  // Restoring missing state for existing CQ Fixing logic
  const [showCQFixModal, setShowCQFixModal] = useState(false);
  const [cqFixCandidates, setCqFixCandidates] = useState([]);

  // SQ Fixing State
  const [showSQFixModal, setShowSQFixModal] = useState(false);
  const [sqFixCandidates, setSqFixCandidates] = useState([]);

  // MCQ Fixing State
  const [showMCQFixModal, setShowMCQFixModal] = useState(false);
  const [mcqFixCandidates, setMcqFixCandidates] = useState([]);

  // MCQ Sync State
  const [mcqSyncCandidates, setMcqSyncCandidates] = useState([]);
  const [showMCQSyncModal, setShowMCQSyncModal] = useState(false);
  const [mcqOptionsFixCandidates, setMcqOptionsFixCandidates] = useState([]);
  const [showMCQOptionsFixModal, setShowMCQOptionsFixModal] = useState(false);
  const [migrationCandidates, setMigrationCandidates] = useState([]);
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // SQ Sync State
  const [showSQSyncModal, setShowSQSyncModal] = useState(false);
  const [sqSyncCandidates, setSqSyncCandidates] = useState([]);

  // CQ Sync State
  const [showCQSyncModal, setShowCQSyncModal] = useState(false);
  const [cqSyncCandidates, setCqSyncCandidates] = useState([]);

  // Unanswered MCQ State
  const [showUnansweredMCQModal, setShowUnansweredMCQModal] = useState(false);
  const [unansweredMCQs, setUnansweredMCQs] = useState([]);

  // Split View State
  const [isSplitView, setIsSplitView] = useState(false);
  const [leftFilters, setLeftFilters] = useState({});
  const [rightFilters, setRightFilters] = useState({});
  
  // Performance Optimization: Visible Count (Limit rendering)
  const [visibleCount, setVisibleCount] = useState(50);

  const generateBulkFixText = (type) => {
    const flagged = questions.filter(q => q.isFlagged && q.type === type);
    console.log(`[BulkFix Debug] generateBulkFixText: Found ${flagged.length} flagged ${type} questions`);
    if (flagged.length === 0) return '';

    return flagged.map((q, idx) => {
      const fullQ = fullQuestionsMap.get(q.id) || q;
      let text = `Question ${idx + 1}:\n`;
      text += `[ID: ${q.id}]\n`;
      text += `[Subject: ${fullQ.subject || ''}]\n[Chapter: ${fullQ.chapter || ''}]\n[Lesson: ${fullQ.lesson || ''}]\n[Board: ${fullQ.board || ''}]\n`;
      
      if (type === 'mcq') {
        text += `${idx + 1}. ${fullQ.questionText || fullQ.question || ''}\n`;
        if (fullQ.options && Array.isArray(fullQ.options)) {
          fullQ.options.forEach(opt => {
            text += `${opt.label}) ${opt.text}\n`;
          });
        }
        text += `Correct: ${fullQ.correctAnswer || ''}\n`;
        if (fullQ.explanation) text += `Explanation: ${fullQ.explanation}\n`;
      } else if (type === 'cq') {
        text += `Stem: ${fullQ.questionText || fullQ.question || ''}\n`;
        if (fullQ.parts && Array.isArray(fullQ.parts)) {
          fullQ.parts.forEach(part => {
            text += `${part.letter}. ${part.text} (${part.marks || 0})\n`;
          });
          text += `Answer:\n`;
          fullQ.parts.forEach(part => {
            text += `${part.letter}. ${part.answer || ''}\n`;
          });
        }
      } else if (type === 'sq') {
        text += `${idx + 1}. ${fullQ.questionText || fullQ.question || ''}\n`;
        text += `Answer: ${fullQ.answer || ''}\n`;
      }
      
      return text;
    }).join('\n---\n\n');
  };

  const generateReviewQueueText = (type) => {
    const queued = questions.filter(q => q.inReviewQueue && q.type === type);
    console.log(`[ReviewQueue Debug] generateReviewQueueText: Found ${queued.length} queued ${type} questions`);
    if (queued.length === 0) return '';

    return queued.map((q, idx) => {
      const fullQ = fullQuestionsMap.get(q.id) || q;
      let text = `Question ${idx + 1}:\n`;
      text += `[ID: ${q.id}]\n`;
      text += `[Subject: ${fullQ.subject || ''}]\n[Chapter: ${fullQ.chapter || ''}]\n[Lesson: ${fullQ.lesson || ''}]\n[Board: ${fullQ.board || ''}]\n`;
      
      if (type === 'mcq') {
        text += `${idx + 1}. ${fullQ.questionText || fullQ.question || ''}\n`;
        if (fullQ.options && Array.isArray(fullQ.options)) {
          fullQ.options.forEach(opt => {
            text += `${opt.label}) ${opt.text}\n`;
          });
        }
        text += `Correct: ${fullQ.correctAnswer || ''}\n`;
        if (fullQ.explanation) text += `Explanation: ${fullQ.explanation}\n`;
      } else if (type === 'cq') {
        text += `Stem: ${fullQ.questionText || fullQ.question || ''}\n`;
        if (fullQ.parts && Array.isArray(fullQ.parts)) {
          fullQ.parts.forEach(part => {
            text += `${part.letter}. ${part.text} (${part.marks || 0})\n`;
          });
          text += `Answer:\n`;
          fullQ.parts.forEach(part => {
            text += `${part.letter}. ${part.answer || ''}\n`;
          });
        }
      } else if (type === 'sq') {
        text += `${idx + 1}. ${fullQ.questionText || fullQ.question || ''}\n`;
        text += `Answer: ${fullQ.answer || ''}\n`;
      }
      
      return text;
    }).join('\n---\n\n');
  };

  const handleReviewQueueApply = async () => {
    if (!reviewQueueInputText.trim()) {
      alert('Please paste the verified questions first.');
      return;
    }

    const queued = questions.filter(q => q.inReviewQueue && q.type === reviewQueueType);
    console.log(`[ReviewQueue Debug] Found ${queued.length} queued questions in state`);

    try {
      setIsFixing(true);
      let parsedQuestions = [];
      
      if (reviewQueueType === 'mcq') {
        const { parseMCQQuestions } = await import('../../utils/mcqQuestionParser');
        parsedQuestions = parseMCQQuestions(reviewQueueInputText);
        console.log(`[ReviewQueue Debug] Parsed ${parsedQuestions.length} MCQs from input text`);
      } else if (reviewQueueType === 'cq') {
        const { parseCQQuestions } = await import('../../utils/cqParser');
        parsedQuestions = parseCQQuestions(reviewQueueInputText);
        console.log(`[ReviewQueue Debug] Parsed ${parsedQuestions.length} CQs from input text`);
      } else if (reviewQueueType === 'sq') {
        const blocks = reviewQueueInputText.split(/---+/).filter(b => b.trim());
        parsedQuestions = blocks.map(block => {
          const lines = block.split('\n').map(l => l.trim()).filter(l => l);
          const q = { type: 'sq', id: '', subject: '', chapter: '', lesson: '', board: '', questionText: '', answer: '' };
          
          lines.forEach(line => {
            if (line.includes('[ID:')) q.id = line.match(/\[ID:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Subject:')) q.subject = line.match(/\[Subject:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Chapter:')) q.chapter = line.match(/\[Chapter:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Lesson:')) q.lesson = line.match(/\[Lesson:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Board:')) q.board = line.match(/\[Board:\s*(.*?)\]/)?.[1] || '';
            else if (line.match(/^\d+\./)) q.questionText = line.replace(/^\d+\.\s*/, '');
            else if (line.toLowerCase().startsWith('answer:')) q.answer = line.replace(/^answer:\s*/i, '');
          });
          return q;
        });
        console.log(`[ReviewQueue Debug] Parsed ${parsedQuestions.length} SQs from input text`);
      }

      if (parsedQuestions.length === 0) {
        alert('Could not parse any questions. Please check the format.');
        return;
      }

      const updates = [];
      const hasIds = parsedQuestions.some(p => p.id);
      
      if (hasIds) {
        const parsedMap = new Map();
        parsedQuestions.forEach(p => {
          if (p.id) parsedMap.set(p.id.toString(), p);
        });

        // Process EVERY question in the current review queue
        queued.forEach(original => {
          const improved = parsedMap.get(original.id.toString());
          if (improved) {
            // Update and verify
            updates.push({
              ...original,
              ...improved,
              id: original.id,
              isVerified: true,
              inReviewQueue: false
            });
          } else {
            // Not mentioned in pasted text, but verify it as-is
            updates.push({
              ...original,
              isVerified: true,
              inReviewQueue: false
            });
          }
        });
        
        console.log(`[ReviewQueue Debug] Processing entire queue (${queued.length} questions). ${parsedQuestions.length} updates found in text.`);
      } else {
        // Fallback to matching by order (backward compatibility)
        const count = Math.min(queued.length, parsedQuestions.length);
        for (let i = 0; i < count; i++) {
          const original = queued[i];
          const improved = parsedQuestions[i];
          
          updates.push({
            ...original,
            ...improved,
            id: original.id,
            isVerified: true,
            inReviewQueue: false
          });
        }
      }

      if (updates.length === 0) {
        alert('No matching questions found to update or verify.');
        return;
      }

      const result = await bulkUpdateQuestions(updates);
      alert(`✅ Successfully updated, verified, and de-queued ${result.successCount} questions!`);
      
      setFullQuestionsMap(prev => {
        const next = new Map(prev);
        updates.forEach(q => next.set(q.id, q));
        return next;
      });

      setShowReviewQueueModal(false);
      setReviewQueueInputText('');
    } catch (error) {
      console.error('Error in review queue apply:', error);
      alert('Error updating questions: ' + error.message);
    } finally {
      setIsFixing(false);
    }
  };

  const handleBulkReplace = async () => {
    if (!bulkFixInputText.trim()) {
      alert('Please paste the improved questions first.');
      return;
    }

    const flagged = questions.filter(q => q.isFlagged && q.type === bulkFixType);
    console.log(`[BulkFix Debug] Found ${flagged.length} flagged questions in state`);

    try {
      setIsFixing(true);
      let parsedQuestions = [];
      
      if (bulkFixType === 'mcq') {
        const { parseMCQQuestions } = await import('../../utils/mcqQuestionParser');
        parsedQuestions = parseMCQQuestions(bulkFixInputText);
        console.log(`[BulkFix Debug] Parsed ${parsedQuestions.length} MCQs from input text`);
      } else if (bulkFixType === 'cq') {
        const { parseCQQuestions } = await import('../../utils/cqParser');
        parsedQuestions = parseCQQuestions(bulkFixInputText);
        console.log(`[BulkFix Debug] Parsed ${parsedQuestions.length} CQs from input text`);
      } else if (bulkFixType === 'sq') {
        // Targeted SQ parsing for bulk fix
        const blocks = bulkFixInputText.split(/---+|###/).filter(b => b.trim());
        parsedQuestions = blocks.map(block => {
          const lines = block.split('\n').map(l => l.trim()).filter(l => l);
          const q = { type: 'sq', id: '', subject: '', chapter: '', lesson: '', board: '', questionText: '', answer: '' };
          
          lines.forEach(line => {
            if (line.includes('[ID:')) q.id = line.match(/\[ID:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Subject:')) q.subject = line.match(/\[Subject:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Chapter:')) q.chapter = line.match(/\[Chapter:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Lesson:')) q.lesson = line.match(/\[Lesson:\s*(.*?)\]/)?.[1] || '';
            else if (line.includes('[Board:')) q.board = line.match(/\[Board:\s*(.*?)\]/)?.[1] || '';
            else if (line.match(/^\d+\./)) q.questionText = line.replace(/^\d+\.\s*/, '');
            else if (line.toLowerCase().startsWith('answer:')) q.answer = line.replace(/^answer:\s*/i, '');
          });
          return q;
        });
        console.log(`[BulkFix Debug] Parsed ${parsedQuestions.length} SQs from input text`);
      }

      if (parsedQuestions.length === 0) {
        alert('Could not parse any questions. Please check the format.');
        return;
      }

      const updates = [];
      const hasIds = parsedQuestions.some(p => p.id);
      
      if (hasIds) {
        parsedQuestions.forEach(improved => {
          if (!improved.id) return;
          
          const original = questions.find(q => q.id.toString() === improved.id.toString());
          if (original) {
            updates.push({
              ...original, 
              ...improved, 
              id: original.id,
              isFlagged: false 
            });
          }
        });
      } else {
        // Match by order of appearance (fallback)
        const count = Math.min(flagged.length, parsedQuestions.length);
        for (let i = 0; i < count; i++) {
          const original = flagged[i];
          const improved = parsedQuestions[i];
          
          updates.push({
            ...original, 
            ...improved, 
            id: original.id,
            isFlagged: false 
          });
        }

        if (parsedQuestions.length !== flagged.length) {
          const message = `Count mismatch! Found ${flagged.length} flagged questions but parsed ${parsedQuestions.length} from text.\n\nOnly the first ${count} will be updated and unflagged. Proceed?`;
          if (!window.confirm(message)) {
            return;
          }
        }
      }

      if (updates.length === 0) {
        alert('No matching questions found to update.');
        return;
      }

      const result = await bulkUpdateQuestions(updates);
      alert(`✅ Successfully updated and unflagged ${result.successCount} questions!`);
      
      // Update local map
      setFullQuestionsMap(prev => {
        const next = new Map(prev);
        updates.forEach(q => next.set(q.id, q));
        return next;
      });

      setShowBulkFixModal(false);
      setBulkFixInputText('');
    } catch (error) {
      console.error('Error in bulk replace:', error);
      alert('Error replacing questions: ' + error.message);
    } finally {
      setIsFixing(false);
    }
  };

  // Proactive Fetching for Statistics Accuracy
  useEffect(() => {
    const proactiveFetch = async () => {
      // 1. Identify what's currently shown in statistics
      // If a subject is selected, we are showing its chapters.
      // If no subject is selected, we are showing subjects.
      
      const targets = [];
      
      // Target 1: Global context subject
      if (currentFilters.subject && currentFilters.subject !== 'none') {
          targets.push({ subject: currentFilters.subject, chapter: currentFilters.chapter });
      }
      
      // Target 2 & 3: Split view subjects
      if (isSplitView) {
          if (leftFilters.subject && leftFilters.subject !== 'none') {
              targets.push({ subject: leftFilters.subject, chapter: leftFilters.chapter });
          }
          if (rightFilters.subject && rightFilters.subject !== 'none') {
              targets.push({ subject: rightFilters.subject, chapter: rightFilters.chapter });
          }
      }

      for (const target of targets) {
          const { subject, chapter } = target;
          
          // Calculate how many we have vs how many we expect
          const matches = questions.filter(q => {
              if ((q.subject || '').trim() !== subject.trim()) return false;
              if (chapter && (q.chapter || '').trim() !== chapter.trim()) return false;
              return true;
          });

          let expectedCount = 0;
          if (hierarchy && hierarchy.length > 0) {
              const subNode = hierarchy.find(h => (h.name || '').trim() === subject.trim());
              if (subNode) {
                  if (chapter) {
                      const chapNode = (subNode.chapters || []).find(c => (c.name || '').trim() === chapter.trim());
                      expectedCount = chapNode?.total || 0;
                  } else {
                      // Total for the entire subject
                      expectedCount = subNode.total || (subNode.chapters || []).reduce((sum, c) => sum + (c.total || 0), 0);
                  }
              }
          }

          // If we are missing more than a few questions, trigger a full fetch for this criteria
          // We use a small threshold (5) to account for minor sync delays
          if (expectedCount > matches.length + 5) {
            console.log(`[Proactive Fetch] 📥 Data incomplete for "${subject}${chapter ? ' / ' + chapter : ''}". Have ${matches.length}/${expectedCount}. Fetching...`);
            
            try {
               // Use a very high limit to get everything for this subject/chapter in one go
               // The API usually caps at a certain amount, but let's ask for up to 5000
               const response = await questionApi.fetchQuestions({ 
                   subject, 
                   chapter, 
                   limit: 5000 
               });
               const newQuestions = Array.isArray(response) ? response : (response.data || []);
               
               if (newQuestions.length > 0) {
                 const mapped = newQuestions.map(q => ({
                    id: q.id,
                    type: q.type,
                    subject: q.subject,
                    chapter: q.chapter,
                    lesson: q.lesson,
                    board: q.board,
                    language: q.language,
                    question: q.question,
                    questionText: q.question_text,
                    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                    correctAnswer: q.correct_answer,
                    answer: q.answer,
                    parts: typeof q.parts === 'string' ? JSON.parse(q.parts) : q.parts,
                    image: q.image,
                    answerimage1: q.answerimage1,
                    answerimage2: q.answerimage2,
                    answerimage3: q.answerimage3,
                    answerimage4: q.answerimage4,
                    explanation: q.explanation,
                    tags: typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags,
                    isFlagged: q.is_flagged,
                    isVerified: q.is_verified,
                    inReviewQueue: q.in_review_queue
                 }));

                 setQuestions(prev => {
                    const existing = new Set(prev.map(p => p.id));
                    const uniqueNew = mapped.filter(m => !existing.has(m.id));
                    if (uniqueNew.length === 0) return prev;
                    return [...prev, ...uniqueNew];
                 });
                 
                 console.log(`[Proactive Fetch] ✅ Loaded ${mapped.length} questions for "${subject}".`);
               }
            } catch (e) {
               console.error("[Proactive Fetch] ❌ Error:", e);
            }
          }
      }
    };
    
    // Debounce proactive fetch slightly to avoid spamming during rapid filter changes
    const timer = setTimeout(proactiveFetch, 1000);
    return () => clearTimeout(timer);
  }, [
    currentFilters.subject, currentFilters.chapter,
    leftFilters.subject, leftFilters.chapter,
    rightFilters.subject, rightFilters.chapter,
    isSplitView,
    hierarchy,
    // Dependency on questions.length is tricky but needed to re-evaluate when new data arrives
    // but only if the length actually changed.
    questions.length 
  ]); 
  // But we need to ensure we don't refetch if already fetched. The `hasQuestions` check handles the initial case.
  
  // Get unique metadata values from all questions - MEMOIZED
  const uniqueSubjects = React.useMemo(() => {
    return [...new Set(questions.map(q => q.subject).filter(s => s && s !== 'N/A'))].sort();
  }, [questions]);

  const uniqueChapters = React.useMemo(() => {
    return [...new Set(questions.map(q => q.chapter).filter(c => c && c !== 'N/A'))].sort();
  }, [questions]);

  const uniqueLessons = React.useMemo(() => {
    return [...new Set(questions.map(q => q.lesson).filter(l => l && l !== 'N/A'))].sort();
  }, [questions]);

  const uniqueBoards = React.useMemo(() => {
    return [...new Set(questions.map(q => q.board).filter(b => b && b !== 'N/A'))].sort();
  }, [questions]);

  // Computed questions based on view mode - MEMOIZED to prevent lag on every click
  const filteredQuestionsSingle = React.useMemo(() => 
    getFilteredQuestions(questions, currentFilters, fullQuestionsMap, hasSearched),
    [questions, currentFilters, fullQuestionsMap, hasSearched]
  );

  const filteredQuestionsLeft = React.useMemo(() => 
    getFilteredQuestions(questions, { ...currentFilters, ...leftFilters }, fullQuestionsMap, hasSearched),
    [questions, currentFilters, leftFilters, fullQuestionsMap, hasSearched]
  );

  const filteredQuestionsRight = React.useMemo(() => 
    getFilteredQuestions(questions, { ...currentFilters, ...rightFilters }, fullQuestionsMap, hasSearched),
    [questions, currentFilters, rightFilters, fullQuestionsMap, hasSearched]
  );
  
  const currentVisibleQuestions = React.useMemo(() => {
    if (!isSplitView) return filteredQuestionsSingle;
    // Efficiently merge two arrays and maintain uniqueness
    const seen = new Set();
    const result = [];
    [...filteredQuestionsLeft, ...filteredQuestionsRight].forEach(q => {
        if (!seen.has(q.id)) {
            seen.add(q.id);
            result.push(q);
        }
    });
    return result;
  }, [isSplitView, filteredQuestionsSingle, filteredQuestionsLeft, filteredQuestionsRight]);

  // Reset visibleCount when filters change to keep rendering fast
  useEffect(() => {
    setVisibleCount(50);
  }, [currentFilters, leftFilters, rightFilters, isSplitView]);
  
  // Convert selectedQuestions to Set for O(1) rendering performance
  const selectedSet = React.useMemo(() => new Set(selectedQuestions), [selectedQuestions]);

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedQuestions([]);
    setSelectedCategories([]);
    setLastSelectedId(null);
  };
  
  const toggleQuestionSelection = (questionId, event) => {
    if (event && event.shiftKey && lastSelectedId) {
        // Handle Range Selection
        const allIds = currentVisibleQuestions.map(q => q.id);
        const startIdx = allIds.indexOf(lastSelectedId);
        const endIdx = allIds.indexOf(questionId);
        
        if (startIdx !== -1 && endIdx !== -1) {
            const minIdx = Math.min(startIdx, endIdx);
            const maxIdx = Math.max(startIdx, endIdx);
            const rangeIds = allIds.slice(minIdx, maxIdx + 1);
            
            setSelectedQuestions(prev => {
                // Merge rangeIds with prev, ensuring no duplicates
                return [...new Set([...prev, ...rangeIds])];
            });
            // Update last selected to the one clicked
            setLastSelectedId(questionId);
            return;
        }
    }

    // Standard Toggle Selection
    setLastSelectedId(questionId);
    setSelectedQuestions(prev => {
      if (prev.includes(questionId)) {
        return prev.filter(id => id !== questionId);
      } else {
        return [...prev, questionId];
      }
    });
  };

  // Optimization: Stable reference for QuestionCard to prevent re-renders
  const toggleQuestionSelectionRef = React.useRef(toggleQuestionSelection);
  useEffect(() => {
      toggleQuestionSelectionRef.current = toggleQuestionSelection;
  });
  const stableToggleQuestionSelection = React.useCallback((...args) => {
      return toggleQuestionSelectionRef.current(...args);
  }, []);

  // Automatically trigger loading when global or split-view filters change
  // This ensures we immediately show results for Subject/Chapter selection
  useEffect(() => {
    const hasSubjectOrChapter = currentFilters.subject || currentFilters.chapter || 
                               leftFilters.subject || leftFilters.chapter || 
                               rightFilters.subject || rightFilters.chapter;
    
    if (hasSubjectOrChapter) {
        setHasSearched(true);
    }
  }, [currentFilters.subject, currentFilters.chapter, isSplitView, leftFilters.subject, leftFilters.chapter, rightFilters.subject, rightFilters.chapter]);
  
  const selectAll = () => {
    setSelectedQuestions(currentVisibleQuestions.map(q => q.id));
  };
  
  const deselectAll = () => {
    setSelectedQuestions([]);
    setLastSelectedId(null);
  };

  const toggleSplitView = () => {
    if (!isSplitView) {
        // When entering split view, initialize both sides with current context filters
        setLeftFilters({ ...currentFilters });
        setRightFilters({ ...currentFilters });
    }
    setIsSplitView(!isSplitView);
  };

  const handleSyncCQFields = async () => {
    setIsFixing(true);
    try {
        console.log("🚀 Starting CQ Field Sync Scan...");
        const cqs = currentVisibleQuestions.filter(q => q.type === 'cq');
        
        if (cqs.length === 0) {
            alert("No CQs found in current view.");
            setIsFixing(false);
            return;
        }

        const idsToFetch = cqs.map(s => s.id);
        const fullCQs = await fetchQuestionsByIds(idsToFetch);

        const getCQAnswerStatus = (q) => {
            // Check if any parts have answers
            const partsWithAnswers = (q.parts || []).filter(p => p.answer && p.answer.trim() !== '' && p.answer !== 'N/A');
            const hasFieldAnswer = partsWithAnswers.length > 0;
            const textToSearch = (q.question || q.questionText || '');
            const hasEmbeddedAnswer = textToSearch.includes('|Ans:') || 
                                      textToSearch.includes('|a:') ||
                                      textToSearch.includes('সঠিক:');
            return {
                hasAnswer: hasFieldAnswer || hasEmbeddedAnswer,
                source: hasFieldAnswer ? `Field (${partsWithAnswers.length} parts)` : (hasEmbeddedAnswer ? 'Text' : 'Missing')
            };
        };

        const candidates = [];
        for (const q of fullCQs) {
            const currentQText = (q.questionText || '').trim();
            const currentQuestionCol = (q.question || '').trim();
            
            const needsSync = currentQText !== '' && currentQuestionCol !== currentQText;
            
            if (needsSync) {
                candidates.push({
                    original: { ...q },
                    fixed: { ...q, question: q.questionText },
                    originalAnswer: getCQAnswerStatus(q),
                    fixedAnswer: getCQAnswerStatus({ ...q, question: q.questionText })
                });
            }
        }

        console.log(`✅ Found ${candidates.length} CQ candidates for sync`);

        if (candidates.length === 0) {
            alert("No CQs found that need syncing.");
        } else {
            setCqSyncCandidates(candidates);
            setShowCQSyncModal(true);
        }

    } catch (error) {
        console.error("❌ Error scanning CQs for sync:", error);
        alert("An error occurred while scanning CQs.");
    } finally {
        setIsFixing(false);
    }
  };

  const applyCQSync = async (batchLimit = null) => {
    const candidatesToSync = batchLimit ? cqSyncCandidates.slice(0, batchLimit) : cqSyncCandidates;
    const count = candidatesToSync.length;

    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to sync fields for ${count} Creative Questions?`)) return;

    setIsFixing(true);
    try {
        const updates = candidatesToSync.map(item => item.fixed);
        const result = await bulkUpdateQuestions(updates);
        
        const syncedIds = new Set(candidatesToSync.map(item => item.original.id));
        setCqSyncCandidates(prev => prev.filter(item => !syncedIds.has(item.original.id)));
        
        if (cqSyncCandidates.length <= count) {
            setShowCQSyncModal(false);
        }

        setFullQuestionsMap(prev => {
            const next = new Map(prev);
            candidatesToSync.forEach(item => next.set(item.fixed.id, item.fixed));
            return next;
        });

        alert(`Successfully synced ${result.successCount} CQs!`);
    } catch (error) {
        console.error("❌ Error applying CQ sync:", error);
        alert("An error occurred while applying CQ sync.");
    } finally {
        setIsFixing(false);
    }
  };

  const applyCQSyncAllBatched = async () => {
    const totalCount = cqSyncCandidates.length;
    if (totalCount === 0) return;
    
    if (!window.confirm(`Auto-sync all ${totalCount} CQs in batches of 100?`)) return;

    setIsAutoSyncing(true);
    setSyncProgress({ current: 0, total: totalCount });

    try {
        let currentCandidates = [...cqSyncCandidates];
        while (currentCandidates.length > 0) {
            const batch = currentCandidates.slice(0, 100);
            const updates = batch.map(item => item.fixed);
            
            const result = await bulkUpdateQuestions(updates);
            
            const syncedIds = new Set(batch.map(item => item.original.id));
            currentCandidates = currentCandidates.filter(item => !syncedIds.has(item.original.id));
            
            setCqSyncCandidates([...currentCandidates]);
            setSyncProgress(prev => ({ ...prev, current: prev.current + batch.length }));

            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                batch.forEach(item => next.set(item.fixed.id, item.fixed));
                return next;
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        alert("CQ Auto-sync complete!");
        setShowCQSyncModal(false);
    } catch (error) {
        console.error("❌ Error during CQ auto-sync:", error);
        alert("An error occurred during CQ auto-sync.");
    } finally {
        setIsAutoSyncing(false);
        setSyncProgress({ current: 0, total: 0 });
    }
  };

  const handleScanCorruptedCQs = async () => {
    setIsFixing(true);
    try {
        // 1. Filter candidates from current view
        const candidates = currentVisibleQuestions.filter(q => q.type === 'cq');
        
        if (candidates.length === 0) {
            alert("No CQ questions found in current view.");
            setIsFixing(false);
            return;
        }

        console.log(`Scanning ${candidates.length} CQs for corruption...`);

        // 2. Fetch full data for accurate scanning
        const idsToFetch = candidates.map(c => c.id);
        const fullCandidates = await fetchQuestionsByIds(idsToFetch);

        // 3. Detect corruption
        const fixableQuestions = [];
        
        for (const q of fullCandidates) {
            const fixed = detectAndFixCQ(q);
            if (fixed) {
                fixableQuestions.push({
                    original: q,
                    fixed: fixed
                });
            }
        }

        if (fixableQuestions.length === 0) {
            alert("No corrupted CQs detected.");
        } else {
            setCqFixCandidates(fixableQuestions);
            setShowCQFixModal(true);
        }

    } catch (error) {
        console.error("Error scanning CQs:", error);
        alert("An error occurred while scanning CQs.");
    } finally {
        setIsFixing(false);
    }
  };

  const applyCQFixes = async () => {
    if (!window.confirm(`Are you sure you want to fix ${cqFixCandidates.length} questions? This action cannot be undone.`)) return;

    setIsFixing(true);
    
    try {
        const updates = cqFixCandidates.map(item => item.fixed);
        const result = await bulkUpdateQuestions(updates);
        
        alert(`Successfully fixed ${result.successCount} CQs!${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}`);
        setShowCQFixModal(false);
        setCqFixCandidates([]);
        
        // Refresh full map with new data
        setFullQuestionsMap(prev => {
            const next = new Map(prev);
            cqFixCandidates.forEach(item => {
                next.set(item.fixed.id, item.fixed);
            });
            return next;
        });

    } catch (error) {
        console.error("Error applying CQ fixes:", error);
        alert("An error occurred while applying fixes.");
    } finally {
        setIsFixing(false);
    }
  };

  const handleSyncSQFields = async () => {
    setIsFixing(true);
    try {
        console.log("🚀 Starting SQ Field Sync Scan...");
        const sqs = currentVisibleQuestions.filter(q => q.type === 'sq');
        
        if (sqs.length === 0) {
            alert("No SQs found in current view.");
            setIsFixing(false);
            return;
        }

        const idsToFetch = sqs.map(s => s.id);
        const fullSQs = await fetchQuestionsByIds(idsToFetch);

        const getSQAnswerStatus = (q) => {
            const hasFieldAnswer = q.answer && q.answer.trim() !== '' && q.answer !== 'N/A';
            const textToSearch = (q.question || q.questionText || '');
            const hasEmbeddedAnswer = textToSearch.includes('|Ans:') || 
                                      textToSearch.includes('|Ans :') ||
                                      textToSearch.includes('উত্তর:');
            return {
                hasAnswer: hasFieldAnswer || hasEmbeddedAnswer,
                source: hasFieldAnswer ? 'Field' : (hasEmbeddedAnswer ? 'Text' : 'Missing')
            };
        };

        const candidates = [];
        for (const q of fullSQs) {
            const currentQText = (q.questionText || '').trim();
            const currentQuestionCol = (q.question || '').trim();
            
            const needsSync = currentQText !== '' && currentQuestionCol !== currentQText;
            
            if (needsSync) {
                candidates.push({
                    original: { ...q },
                    fixed: { ...q, question: q.questionText },
                    originalAnswer: getSQAnswerStatus(q),
                    fixedAnswer: getSQAnswerStatus({ ...q, question: q.questionText })
                });
            }
        }

        console.log(`✅ Found ${candidates.length} SQ candidates for sync`);

        if (candidates.length === 0) {
            alert("No SQs found that need syncing.");
        } else {
            setSqSyncCandidates(candidates);
            setShowSQSyncModal(true);
        }

    } catch (error) {
        console.error("❌ Error scanning SQs for sync:", error);
        alert("An error occurred while scanning SQs.");
    } finally {
        setIsFixing(false);
    }
  };

  const applySQSync = async (batchLimit = null) => {
    const candidatesToSync = batchLimit ? sqSyncCandidates.slice(0, batchLimit) : sqSyncCandidates;
    const count = candidatesToSync.length;

    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to sync fields for ${count} Short Questions?`)) return;

    setIsFixing(true);
    try {
        const updates = candidatesToSync.map(item => item.fixed);
        const result = await bulkUpdateQuestions(updates);
        
        const syncedIds = new Set(candidatesToSync.map(item => item.original.id));
        setSqSyncCandidates(prev => prev.filter(item => !syncedIds.has(item.original.id)));
        
        if (sqSyncCandidates.length <= count) {
            setShowSQSyncModal(false);
        }

        setFullQuestionsMap(prev => {
            const next = new Map(prev);
            candidatesToSync.forEach(item => next.set(item.fixed.id, item.fixed));
            return next;
        });

        alert(`Successfully synced ${result.successCount} SQs!`);
    } catch (error) {
        console.error("❌ Error applying SQ sync:", error);
        alert("An error occurred while applying SQ sync.");
    } finally {
        setIsFixing(false);
    }
  };

  const applySQSyncAllBatched = async () => {
    const totalCount = sqSyncCandidates.length;
    if (totalCount === 0) return;
    
    if (!window.confirm(`Auto-sync all ${totalCount} SQs in batches of 100?`)) return;

    setIsAutoSyncing(true);
    setSyncProgress({ current: 0, total: totalCount });

    try {
        let currentCandidates = [...sqSyncCandidates];
        while (currentCandidates.length > 0) {
            const batch = currentCandidates.slice(0, 100);
            const updates = batch.map(item => item.fixed);
            
            const result = await bulkUpdateQuestions(updates);
            
            const syncedIds = new Set(batch.map(item => item.original.id));
            currentCandidates = currentCandidates.filter(item => !syncedIds.has(item.original.id));
            
            setSqSyncCandidates([...currentCandidates]);
            setSyncProgress(prev => ({ ...prev, current: prev.current + batch.length }));

            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                batch.forEach(item => next.set(item.fixed.id, item.fixed));
                return next;
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        alert("SQ Auto-sync complete!");
        setShowSQSyncModal(false);
    } catch (error) {
        console.error("❌ Error during SQ auto-sync:", error);
        alert("An error occurred during SQ auto-sync.");
    } finally {
        setIsAutoSyncing(false);
        setSyncProgress({ current: 0, total: 0 });
    }
  };

  const handleFixCorruptedMCQs = async () => {
    if (!window.confirm("This will scan ALL displayed questions for corrupted MCQ formatting and attempt to fix them. Continue?")) return;
    
    setIsFixing(true);
    let fixedCount = 0;
    
    try {
      // 1. Identify candidates from CURRENT VIEW
      const candidates = currentVisibleQuestions.filter(q => {
        if (q.type !== 'mcq') return false;
        
        // Skip if already has structured options
        if (q.options && q.options.length > 0) return false;

        const text = q.question || '';
        // Check for Standard Corruption Pattern
        if (text.includes('|a:')) return true;
        
        // Check for Bengali Inline Pattern
        if (text.includes('সঠিক:') || (text.includes('ক)') && text.includes('খ)'))) return true;
        
        return false;
      });

      if (candidates.length === 0) {
        alert("No corrupted MCQ candidates found in current view.");
        setIsFixing(false);
        return;
      }

      console.log(`Found ${candidates.length} candidates. Fetching full data...`);

      // 2. Fetch full data for candidates
      const idsToFetch = candidates.map(c => c.id);
      const fullCandidates = await fetchQuestionsByIds(idsToFetch);
      
      // 3. Process and fix
      const fixableMCQs = [];
      for (const q of fullCandidates) {
        // Use question field as source of truth for corrupted text if questionText is missing or same
        const sourceText = q.question || q.questionText;
        const fixedData = fixCorruptedMCQ(sourceText);
        
        if (fixedData) {
            const updatedQuestion = {
                ...q,
                questionText: fixedData.questionText, // Clean question text
                question: fixedData.questionText, // Update main field too to avoid re-matching
                options: fixedData.options,
                correctAnswer: fixedData.correctAnswer
            };
            
            // If explanation was extracted, save it
            if (fixedData.explanation) {
                updatedQuestion.explanation = fixedData.explanation;
            }
            
            // Clean up Board if "N/A"
            if (updatedQuestion.board === 'N/A' || updatedQuestion.board === '(N/A)') {
                updatedQuestion.board = '';
            }
            
            fixableMCQs.push({
                original: q,
                fixed: updatedQuestion
            });
        }
      }
      
      if (fixableMCQs.length === 0) {
          alert("Could not generate valid fixes for the identified candidates.");
      } else {
          setMcqFixCandidates(fixableMCQs);
          setShowMCQFixModal(true);
      }
      
    } catch (error) {
      console.error("Error detecting corrupted MCQs:", error);
      alert("An error occurred while scanning MCQs.");
    } finally {
              setIsFixing(false);
          }
        };
      
        const handleFixCorruptedSQs = async () => {
          if (!window.confirm("This will scan all SQ questions in view for corrupted formatting (e.g., embedded answers and boards) and attempt to fix them. Continue?")) return;
      
          setIsFixing(true);
          try {
              const candidates = currentVisibleQuestions.filter(q => q.type === 'sq');
              
              if (candidates.length === 0) {
                  alert("No SQ questions found in current view.");
                  setIsFixing(false);
                  return;
              }
      
              const idsToFetch = candidates.map(c => c.id);
              const fullCandidates = await fetchQuestionsByIds(idsToFetch);
      
              const fixableSQs = [];
              for (const q of fullCandidates) {
                  const sourceText = q.question || q.questionText;
                  const fixedData = fixCorruptedSQ(sourceText);
                  
                  if (fixedData) {
                      fixableSQs.push({
                          original: q,
                          fixed: {
                              ...q,
                              questionText: fixedData.questionText,
                              question: fixedData.questionText, // Update main field
                              answer: fixedData.answer,
                              board: fixedData.board || q.board
                          }
                      });
                  }
              }
      
              if (fixableSQs.length === 0) {
                  alert("No corrupted SQs detected.");
              } else {
                  setSqFixCandidates(fixableSQs);
                  setShowSQFixModal(true);
              }
      
          } catch (error) {
              console.error("Error scanning SQs:", error);
              alert("An error occurred while scanning.");
          } finally {
              setIsFixing(false);
          }
        };
      
        const applySQFixes = async () => {
          if (!window.confirm(`Are you sure you want to fix ${sqFixCandidates.length} SQ questions?`)) return;
      
          setIsFixing(true);
          try {
              const updates = sqFixCandidates.map(item => item.fixed);
              const result = await bulkUpdateQuestions(updates);
              
              alert(`Successfully fixed ${result.successCount} SQs!`);
              setShowSQFixModal(false);
              setSqFixCandidates([]);
              
              setFullQuestionsMap(prev => {
                  const next = new Map(prev);
                  sqFixCandidates.forEach(item => next.set(item.fixed.id, item.fixed));
                  return next;
              });
      
          } catch (error) {
              console.error("Error applying SQ fixes:", error);
              alert("An error occurred while applying fixes.");
          } finally {
              setIsFixing(false);
          }
        };
      
        const handleNormalizeCQImages = async () => {
    setIsFixing(true);
    setSyncProgress({ current: 0, total: 0 });
    try {
        console.log("📡 Starting paginated fetch for ALL Creative Questions...");
        
        let allCQsMapped = [];
        let page = 0;
        const BATCH_SIZE = 500;
        let hasMore = true;

        while (hasMore) {
            console.log(`📡 Fetching CQs page ${page}...`);
            const response = await questionApi.fetchQuestions({ 
                type: 'cq', 
                limit: BATCH_SIZE,
                page: page
            });
            
            const batch = Array.isArray(response) ? response : (response.data || []);
            
            if (batch.length === 0) {
                hasMore = false;
            } else {
                const mappedBatch = batch.map(mapDatabaseToApp);
                allCQsMapped.push(...mappedBatch);
                
                if (batch.length < BATCH_SIZE) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
            // Small delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log(`✅ Fetched ${allCQsMapped.length} CQs total. Scanning for inconsistencies...`);
        
        if (allCQsMapped.length === 0) {
            alert("No CQs found in database.");
            return;
        }

        const preview = getMigrationPreview(allCQsMapped);
        
        if (preview.length > 0) {
            setMigrationCandidates(preview);
            setShowMigrationModal(true);
        } else {
            alert(`✨ All ${allCQsMapped.length} Creative Questions are already properly normalized.`);
        }
    } catch (err) {
        console.error("Migration scan failed:", err);
        alert("❌ Error: " + err.message);
    } finally {
        setIsFixing(false);
    }
  };

  const applyMigration = async () => {
    if (!window.confirm(`Apply migration to ${migrationCandidates.length} questions?`)) return;
    
    setIsFixing(true);
    try {
        const result = await performImageMigration(migrationCandidates, bulkUpdateQuestions);
        alert(`✅ Successfully normalized ${result.count} questions!`);
        setShowMigrationModal(false);
        refreshQuestions();
    } catch (err) {
        alert("❌ Error: " + err.message);
    } finally {
        setIsFixing(false);
    }
  };

  const applyMCQFixes = async () => {      if (!window.confirm(`Are you sure you want to fix ${mcqFixCandidates.length} questions? This action cannot be undone.`)) return;

      setIsFixing(true);

      try {
          const updates = mcqFixCandidates.map(item => item.fixed);
          const result = await bulkUpdateQuestions(updates);
          
          alert(`Successfully fixed ${result.successCount} MCQs!${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}`);
          setShowMCQFixModal(false);
          setMcqFixCandidates([]);
          
          // Refresh full map with new data
          setFullQuestionsMap(prev => {
              const next = new Map(prev);
              mcqFixCandidates.forEach(item => {
                  next.set(item.fixed.id, item.fixed);
              });
              return next;
          });
      } catch (error) {
          console.error("Error applying MCQ fixes:", error);
          alert("An error occurred while applying fixes.");
      } finally {
          setIsFixing(false);
      }
  };

  const handleSyncMCQFields = async (targetId = null) => {
    setIsFixing(true);
    try {
        console.log("🚀 Starting MCQ Field Sync...");
        // 1. Get MCQs from current view
        let mcqs = currentVisibleQuestions.filter(q => q.type === 'mcq');
        
        // Target specific ID if requested (for testing)
        if (targetId) {
            console.log(`🎯 Targeting specific ID: ${targetId}`);
            mcqs = mcqs.filter(q => q.id === targetId || q.id.toString() === targetId.toString());
        } else {
            // If no ID provided, maybe we want to target a specific one for testing as requested by user
            // Check if there is a query param or something? No, let's just use what we have.
            console.log(`🔍 Scanning all ${mcqs.length} MCQs in view...`);
        }

        if (mcqs.length === 0) {
            alert(targetId ? `Question with ID ${targetId} not found in current view.` : "No MCQs found in current view.");
            setIsFixing(false);
            return;
        }

        // 2. Fetch full data
        const idsToFetch = mcqs.map(m => m.id);
        const fullMCQs = await fetchQuestionsByIds(idsToFetch);
        console.log(`📥 Fetched full data for ${fullMCQs.length} questions`);

        // 3. Identify candidates
        const candidates = [];
        
        // Helper to detect if an answer exists (either in field or embedded in text)
        const getAnswerStatus = (q) => {
            const hasFieldAnswer = q.correctAnswer && q.correctAnswer.trim() !== '' && q.correctAnswer !== 'N/A';
            const textToSearch = (q.question || q.questionText || '');
            const hasEmbeddedAnswer = textToSearch.includes('|Ans:') || 
                                      textToSearch.includes('|Ans :') ||
                                      textToSearch.includes('সঠিক:') ||
                                      textToSearch.includes('উত্তর:');
            return {
                hasAnswer: hasFieldAnswer || hasEmbeddedAnswer,
                source: hasFieldAnswer ? 'Field' : (hasEmbeddedAnswer ? 'Text' : 'Missing'),
                value: hasFieldAnswer ? q.correctAnswer : '?'
            };
        };

        for (const q of fullMCQs) {
            const hasQuestionText = q.questionText && q.questionText.trim() !== '';
            const hasQuestion = q.question && q.question.trim() !== '';
            
            const currentQText = hasQuestionText ? q.questionText.trim() : '';
            const currentQuestionCol = hasQuestion ? q.question.trim() : '';
            
            // Sync is needed if the "question" column does not exactly match "question_text"
            const needsSync = hasQuestionText && (currentQuestionCol !== currentQText);
            
            if (needsSync || targetId) {
                const originalStatus = getAnswerStatus(q);
                // The "fixed" version will have the question text from questionText
                const fixedObj = { ...q, question: q.questionText };
                const fixedStatus = getAnswerStatus(fixedObj);

                candidates.push({
                    original: { ...q },
                    fixed: fixedObj,
                    originalAnswer: originalStatus,
                    fixedAnswer: fixedStatus,
                    reason: needsSync ? "Column mismatch" : "Targeted sync"
                });
            }
        }

        console.log(`✅ Found ${candidates.length} candidates for sync`);

        if (candidates.length === 0) {
            if (window.confirm("No sync issues detected automatically. Would you like to see the first 10 MCQs anyway for manual selection?")) {
                const sample = fullMCQs.slice(0, 10).map(q => ({
                    original: { ...q },
                    fixed: { ...q, question: q.questionText },
                    reason: "Manual inspection sample"
                }));
                setMcqSyncCandidates(sample);
                setShowMCQSyncModal(true);
            }
        } else {
            setMcqSyncCandidates(candidates);
            setShowMCQSyncModal(true);
        }

    } catch (error) {
        console.error("❌ Error scanning MCQs for sync:", error);
        alert("An error occurred while scanning.");
    } finally {
        setIsFixing(false);
    }
  };

  const applyMCQSync = async (batchLimit = null) => {
    const candidatesToSync = batchLimit ? mcqSyncCandidates.slice(0, batchLimit) : mcqSyncCandidates;
    const count = candidatesToSync.length;

    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to sync fields for ${count} questions? This will overwrite the "question" field with "question_text".`)) return;

    setIsFixing(true);
    console.log(`📤 Applying MCQ sync to ${count} questions...`);
    try {
        const updates = candidatesToSync.map(item => item.fixed);
        const result = await bulkUpdateQuestions(updates);
        console.log("📥 Sync result:", result);
        
        alert(`Successfully synced ${result.successCount} MCQs!${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}`);
        
        // Remove ONLY the synced items from the candidates list
        const syncedIds = new Set(candidatesToSync.map(item => item.original.id));
        setMcqSyncCandidates(prev => prev.filter(item => !syncedIds.has(item.original.id)));
        
        if (mcqSyncCandidates.length <= count) {
            setShowMCQSyncModal(false);
        }
        
        // Refresh full map with new data
        setFullQuestionsMap(prev => {
            const next = new Map(prev);
            candidatesToSync.forEach(item => {
                next.set(item.fixed.id, item.fixed);
            });
            return next;
        });

    } catch (error) {
        console.error("❌ Error applying MCQ sync:", error);
        alert("An error occurred while applying sync.");
    } finally {
        setIsFixing(false);
    }
  };

  const applyMCQSyncAllBatched = async () => {
    const totalCount = mcqSyncCandidates.length;
    if (totalCount === 0) return;
    
    if (!window.confirm(`Are you sure you want to automatically sync all ${totalCount} questions in batches of 100?`)) return;

    setIsAutoSyncing(true);
    setSyncProgress({ current: 0, total: totalCount });

    try {
        let currentCandidates = [...mcqSyncCandidates];
        let totalSuccess = 0;
        let totalFailed = 0;

        while (currentCandidates.length > 0) {
            const batch = currentCandidates.slice(0, 100);
            const updates = batch.map(item => item.fixed);
            
            console.log(`🚀 Auto-Syncing batch of ${batch.length} (Remaining: ${currentCandidates.length})...`);
            const result = await bulkUpdateQuestions(updates);
            
            totalSuccess += result.successCount;
            totalFailed += result.failedCount;

            // Remove synced items
            const syncedIds = new Set(batch.map(item => item.original.id));
            currentCandidates = currentCandidates.filter(item => !syncedIds.has(item.original.id));
            
            // Update UI state
            setMcqSyncCandidates([...currentCandidates]);
            setSyncProgress(prev => ({ ...prev, current: prev.current + batch.length }));

            // Refresh full map
            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                batch.forEach(item => {
                    next.set(item.fixed.id, item.fixed);
                });
                return next;
            });

            // Brief pause to allow UI to breathe
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        alert(`Auto-sync complete!\nTotal Success: ${totalSuccess}\nTotal Failed: ${totalFailed}`);
        setShowMCQSyncModal(false);

    } catch (error) {
        console.error("❌ Error during auto-sync:", error);
        alert("An error occurred during auto-sync. Progress saved up to last successful batch.");
    } finally {
        setIsAutoSyncing(false);
        setSyncProgress({ current: 0, total: 0 });
    }
  };

  const handleFindMCQsWithMergedOptions = async () => {
    setIsSearching(true);
    console.log("🚀 [MergedOptionsFix] Starting Scan...");
    try {
        const mcqs = currentVisibleQuestions.filter(q => q.type === 'mcq');
        
        if (mcqs.length === 0) {
            alert("No MCQs found in current view.");
            setIsSearching(false);
            return;
        }

        // 1. Identify which questions actually need fixing based on local data first
        const potentialIds = [];
        const nonMatchSamples = [];
        
        for (const q of mcqs) {
            const fullQ = fullQuestionsMap.get(q.id) || q;
            const fixed = detectAndFixMCQOptions(fullQ);
            
            if (fixed) {
                potentialIds.push(q.id);
            } else if (nonMatchSamples.length < 10) {
                nonMatchSamples.push({ id: q.id, text: (q.questionText || q.question || '').substring(0, 150) });
            }
        }

        if (potentialIds.length === 0) {
            console.log("❌ [MergedOptionsFix] No candidates found. Samples of checked text:");
            console.table(nonMatchSamples);
            alert("No MCQs with merged options were detected. Check console for samples of what was scanned.");
            setIsSearching(false);
            return;
        }

        console.log(`📊 [MergedOptionsFix] Potential candidates to fetch: ${potentialIds.length}`);

        // 2. Fetch full data ONLY for the potential candidates
        const fetchedMCQs = await fetchQuestionsByIds(potentialIds);

        const candidates = [];
        for (const q of fetchedMCQs) {
            const fixed = detectAndFixMCQOptions(q);
            if (fixed) {
                // IMPORTANT: If we detected merged options in the text, it's a candidate
                // even if the database 'options' count matches, because the text still needs cleaning.
                candidates.push({
                    original: q,
                    fixed: fixed
                });
            }
        }

        console.log(`✅ [MergedOptionsFix] Final candidates for modal: ${candidates.length}`);

        if (candidates.length === 0) {
            alert("No MCQs with fixable merged options found after verifying full data.");
        } else {
            setMcqOptionsFixCandidates(candidates);
            setShowMCQOptionsFixModal(true);
        }
    } catch (error) {
        console.error("❌ [MergedOptionsFix] Error during scan:", error);
        alert("An error occurred during scan.");
    } finally {
        setIsSearching(false);
    }
  };

  const applyMCQOptionsFix = async () => {
      if (mcqOptionsFixCandidates.length === 0) return;
      if (!window.confirm(`Fix options for all ${mcqOptionsFixCandidates.length} questions?`)) return;

      setIsFixing(true);
      try {
          const updates = mcqOptionsFixCandidates.map(c => c.fixed);
          const result = await bulkUpdateQuestions(updates);
          alert(`Successfully fixed options for ${result.successCount} questions!`);
          setShowMCQOptionsFixModal(false);
          setMcqOptionsFixCandidates([]);
      } catch (error) {
          console.error("Error applying MCQ options fix:", error);
          alert("Failed to apply fixes.");
      } finally {
          setIsFixing(false);
      }
  };

  const handleFindUnansweredMCQs = async () => {
    setIsSearching(true);
    try {
        // 1. Get all MCQs from current view
        const mcqs = currentVisibleQuestions.filter(q => q.type === 'mcq');
        
        if (mcqs.length === 0) {
            alert("No MCQs found in current view.");
            setIsSearching(false);
            return;
        }

        // 2. Fetch full data
        const idsToFetch = mcqs.map(m => m.id);
        const fetchedMCQs = await fetchQuestionsByIds(idsToFetch);

        // Merge with local state to get current flags
        const fullMCQs = fetchedMCQs.map(q => {
          const localQ = questions.find(lq => lq.id.toString() === q.id.toString());
          return localQ ? { ...q, isFlagged: localQ.isFlagged || q.isFlagged } : q;
        });

        // 3. Detect unanswered
        const found = fullMCQs.filter(q => {
            // Check 1: Is the explicit answer field empty/invalid?
            const ans = q.correctAnswer;
            const isAnswerMissing = !ans || 
                                    ans === 'N/A' || 
                                    ans === '(N/A)' ||
                                    ans === '(-)' || 
                                    ans.trim() === '';

            // Check 2: Are options missing?
            const areOptionsMissing = !q.options || q.options.length === 0;

            // If both are present, it's definitely NOT unanswered
            if (!isAnswerMissing && !areOptionsMissing) return false; 
            
            // However, we must ensure the answer isn't embedded in the text
            const text = (q.question || q.questionText || '').toString();
            const hasEmbeddedAnswer = text.includes('|Ans:') || 
                                      text.includes('|Ans :') ||
                                      text.includes('সঠিক:') ||
                                      text.includes('Correct:') ||
                                      text.includes('Ans:') ||
                                      text.includes('উত্তর:');

            if (hasEmbeddedAnswer) return false;

            return true;
        });

        if (found.length === 0) {
            alert("All MCQs in the current view appear to have answers (either in field or in text).");
        } else {
            setUnansweredMCQs(found.map(q => ({ ...q, isFlagged: q.isFlagged || false })));
            setShowUnansweredMCQModal(true);
        }

    } catch (error) {
        console.error("Error finding unanswered MCQs:", error);
        alert("An error occurred while scanning MCQs.");
    } finally {
        setIsSearching(false);
    }
  };

  const flagUnansweredMCQs = async () => {
      const unflagged = unansweredMCQs.filter(q => !q.isFlagged);
      if (unflagged.length === 0) {
          alert("All these questions are already flagged!");
          return;
      }

      if (!window.confirm(`This will flag all ${unflagged.length} remaining unanswered MCQs for review. Continue?`)) return;
      
      setIsFixing(true);
      try {
          const result = await bulkFlagQuestions(unflagged, true);
          alert(`Successfully flagged ${result.successCount} questions!`);
          
          // Update local state
          setUnansweredMCQs(prev => prev.map(q => ({ ...q, isFlagged: true })));
          
          // Optional: close if all flagged
          // setShowUnansweredMCQModal(false);
      } catch (error) {
          console.error("Error flagging questions:", error);
          alert("Failed to flag questions.");
      } finally {
          setIsFixing(false);
      }
  };

  const toggleSingleUnansweredFlag = async (question) => {
    try {
        const result = await bulkFlagQuestions([question], !question.isFlagged);
        if (result.successCount > 0) {
            setUnansweredMCQs(prev => prev.map(q => 
                q.id === question.id ? { ...q, isFlagged: !question.isFlagged } : q
            ));
        }
    } catch (error) {
        console.error("Error toggling flag:", error);
    }
  };

  const deleteUnansweredMCQs = async () => {
      if (!window.confirm(`⚠️ WARNING: This will PERMANENTLY DELETE ${unansweredMCQs.length} unanswered questions. This action CANNOT be undone. Are you sure?`)) return;
      
      setIsFixing(true);
      try {
          // Delete in batches
          const ids = unansweredMCQs.map(q => q.id);
          const BATCH_SIZE = 20;
          let deletedCount = 0;
          
          for (let i = 0; i < ids.length; i += BATCH_SIZE) {
              const batch = ids.slice(i, i + BATCH_SIZE);
              await Promise.all(batch.map(id => deleteQuestion(id)));
              deletedCount += batch.length;
          }
          
          alert(`Successfully deleted ${deletedCount} questions.`);
          setShowUnansweredMCQModal(false);
          setUnansweredMCQs([]);
      } catch (error) {
          console.error("Error deleting questions:", error);
          alert("An error occurred while deleting questions.");
      } finally {
          setIsFixing(false);
      }
  };

  const fixAllUnansweredOptions = async () => {
      const candidates = unansweredMCQs
          .map(q => detectAndFixMCQOptions(q))
          .filter(Boolean);

      if (candidates.length === 0) {
          alert("No questions could be automatically fixed.");
          return;
      }

      if (!window.confirm(`Found ${candidates.length} questions with fixable options. Update them all now?`)) return;

      setIsFixing(true);
      try {
          const result = await bulkUpdateQuestions(candidates);
          alert(`Successfully fixed options for ${result.successCount} questions!`);
          
          // Update local state for those fixed
          const fixedIds = new Set(candidates.map(c => c.id));
          setUnansweredMCQs(prev => prev.map(q => {
              const fixed = candidates.find(c => c.id === q.id);
              return fixed ? fixed : q;
          }));
      } catch (error) {
          console.error("Error fixing all options:", error);
          alert("Failed to fix options.");
      } finally {
          setIsFixing(false);
      }
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
    const originalsMap = new Map();
    const candidateGroups = [];

    setIsSearching(true);
    setDuplicateResultsFilters({ subject: '', chapter: '', type: '' });
    
    console.log(`[Duplicate Debug] Starting duplicate scan on ${questions.length} questions...`);

    // 1. Group ALL questions by a unique content key
    questions.forEach(q => {
      // Skip common placeholders
      const isPlaceholder = (text) => {
        const k = (text || '').trim().toLowerCase();
        return k === '' ||
               k === '[there is a picture]' || 
               k === '[ছবি আছে]' || 
               k === 'picture' || 
               k === 'image' || 
               k === 'ছবি' ||
               k.includes('[there is a picture for part');
      };

      const rawText = q.question || q.questionText || '';
      if (isPlaceholder(rawText)) return;

      // Create a robust normalization of the text
      // We strip the [suffix] for comparison if it exists
      const cleanText = rawText.replace(/\s*\[\d+\]$/, '').trim();
      const normalizedText = (cleanText || '').toString()
        .normalize('NFC')
        .replace(/[\s\u200B\u200C\u200D\u09BC]+/g, '')
        .toLowerCase();

      // Composite key for uniqueness: type + subject + normalized text
      const lookupKey = `${q.type || 'unknown'}:${(q.subject || 'none').trim().toLowerCase()}:${normalizedText}`;
      
      if (!originalsMap.has(lookupKey)) {
        originalsMap.set(lookupKey, { original: q, duplicates: [] });
      } else {
        originalsMap.get(lookupKey).duplicates.push(q);
      }
    });

    // 2. Identify groups with actual duplicates
    originalsMap.forEach((value, key) => {
      if (value.duplicates.length > 0) {
        candidateGroups.push(value);
      }
    });

    console.log(`[Duplicate Debug] Found ${candidateGroups.length} candidate duplicate groups.`);

    if (candidateGroups.length === 0) {
      setIsSearching(false);
      alert('No duplicate candidates found.');
      return;
    }

    // 3. Fetch full details for strict comparison
    const idsToFetch = new Set();
    candidateGroups.forEach(g => {
        if (g.original && g.original.id && !fullQuestionsMap.has(g.original.id.toString())) idsToFetch.add(g.original.id);
        if (g.duplicates) {
            g.duplicates.forEach(d => {
                if (d && d.id && !fullQuestionsMap.has(d.id.toString())) idsToFetch.add(d.id);
            });
        }
    });

    const verificationMap = new Map(fullQuestionsMap);

    if (idsToFetch.size > 0) {
        try {
            console.log(`[Duplicate Debug] Fetching ${idsToFetch.size} questions for strict check...`);
            const fetched = await fetchQuestionsByIds(Array.from(idsToFetch));
            fetched.forEach(q => {
                if (q && q.id) verificationMap.set(q.id.toString(), q);
            });
            
            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                fetched.forEach(q => {
                    if (q && q.id) next.set(q.id.toString(), q);
                });
                return next;
            });
        } catch (e) {
            console.error("[Duplicate Debug] Error fetching for duplicate check", e);
            setIsSearching(false);
            alert("Error verifying duplicates.");
            return;
        }
    }

    // 4. Strict Deep Equality Check
    const finalGroups = [];
    candidateGroups.forEach(group => {
        const originalFull = verificationMap.get(group.original.id.toString()) || group.original;
        const confirmedDuplicates = [];
        
        group.duplicates.forEach(dup => {
            const dupFull = verificationMap.get(dup.id.toString()) || dup;
            if (areQuestionsDeeplyEqual(originalFull, dupFull)) {
                confirmedDuplicates.push(dupFull);
            }
        });
        
        if (confirmedDuplicates.length > 0) {
            finalGroups.push({
                original: originalFull,
                duplicates: confirmedDuplicates
            });
        }
    });
    
    console.log(`[Duplicate Debug] Final confirmed groups: ${finalGroups.length}`);

    if (finalGroups.length === 0) {
        setIsSearching(false);
        alert("No exact duplicates confirmed after deep inspection.");
        return;
    }

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
    // Collect all duplicate IDs from the CURRENTLY FILTERED groups
    const allDuplicateIds = displayDuplicateGroups.flatMap(group => group.duplicates.map(d => d.id));
    
    if (allDuplicateIds.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ALL ${allDuplicateIds.length} visible duplicates?`)) {
      try {
        // Delete in batches to avoid overwhelming the server
        const BATCH_SIZE = 20;
        for (let i = 0; i < allDuplicateIds.length; i += BATCH_SIZE) {
          const batch = allDuplicateIds.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(id => deleteQuestion(id)));
        }
        
        // Remove the deleted IDs from the main duplicateGroups state
        const deletedIdSet = new Set(allDuplicateIds);
        setDuplicateGroups(prev => 
          prev.map(group => ({
            ...group,
            duplicates: group.duplicates.filter(d => !deletedIdSet.has(d.id))
          })).filter(group => group.duplicates.length > 0)
        );

        if (allDuplicateIds.length === duplicateGroups.flatMap(g => g.duplicates).length) {
          setShowDuplicateModal(false);
        }
        
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
    console.log(`[BulkEdit Debug] Initializing bulk edit for ${selectedQuestions.length} selected IDs.`);
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to edit.');
      return;
    }

    // Ensure we have full data for selected questions to prevent overwriting with defaults
    const missingIds = selectedQuestions.filter(id => id && !fullQuestionsMap.has(id.toString()));
    let fetchedQuestions = [];
    
    if (missingIds.length > 0) {
        console.log(`[BulkEdit Debug] Fetching full data for ${missingIds.length} missing questions.`);
        try {
            fetchedQuestions = await fetchQuestionsByIds(missingIds);
            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                fetchedQuestions.forEach(q => {
                    if (q && q.id) next.set(q.id.toString(), q);
                });
                return next;
            });
        } catch (e) {
            console.error("[BulkEdit Debug] Error fetching for bulk edit", e);
            alert("Error preparing questions for edit.");
            return;
        }
    }

    // Get the selected question objects
    const selectedQuestionObjects = selectedQuestions.map(id => {
        if (!id) return null;
        const idStr = id.toString();
        // Check local fetched first, then fullQuestionsMap, then questions array
        return (
            fetchedQuestions.find(q => q && q.id && q.id.toString() === idStr) ||
            fullQuestionsMap.get(idStr) || 
            questions.find(q => q && q.id && q.id.toString() === idStr)
        );
    }).filter(Boolean);
    
    console.log(`[BulkEdit Debug] Prepared ${selectedQuestionObjects.length} objects for update.`);

    // Prepare updates
    const updates = selectedQuestionObjects.map(question => {
        const updatedQuestion = { ...question };
        
        if (bulkMetadata.subject) updatedQuestion.subject = bulkMetadata.subject;
        if (bulkMetadata.chapter) updatedQuestion.chapter = bulkMetadata.chapter;
        if (bulkMetadata.lesson) updatedQuestion.lesson = bulkMetadata.lesson;
        if (bulkMetadata.board) updatedQuestion.board = bulkMetadata.board;
        
        return updatedQuestion;
    });

    try {
        console.log(`[BulkEdit Debug] Sending ${updates.length} updates to bulkUpdateQuestions.`);
        const result = await bulkUpdateQuestions(updates);
        
        // Reset and close
        setBulkMetadata({ subject: '', chapter: '', lesson: '', board: '' });
        setShowBulkMetadataEditor(false);
        setSelectedQuestions([]);
        setSelectionMode(false);
        
        alert(`✅ Metadata updated for ${result.successCount} question(s)!${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}`);
        
        // Refresh full map with new data
        setFullQuestionsMap(prev => {
            const next = new Map(prev);
            updates.forEach(q => next.set(q.id.toString(), q));
            return next;
        });
        
    } catch (error) {
        console.error('[BulkEdit Debug] Error updating metadata:', error);
        alert('An error occurred while updating metadata.');
    }
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

  const { bulkVerifyQuestions, bulkReviewQueue } = useQuestions();

  const bulkVerify = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to verify.');
      return;
    }
    
    try {
      const result = await bulkVerifyQuestions(selectedQuestions, true);
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`✅ Verified ${result.successCount} question(s)!`);
    } catch (error) {
      console.error('Error verifying questions:', error);
      alert('Error verifying questions. Please try again.');
    }
  };

  const bulkUnverify = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to unverify.');
      return;
    }
    
    try {
      const result = await bulkVerifyQuestions(selectedQuestions, false);
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`❌ Unverified ${result.successCount} question(s)!`);
    } catch (error) {
      console.error('Error unverifying questions:', error);
      alert('Error unverifying questions. Please try again.');
    }
  };

  const bulkQueue = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to add to queue.');
      return;
    }
    
    try {
      const result = await bulkReviewQueue(selectedQuestions, true);
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`📋 Added ${result.successCount} question(s) to review queue!`);
    } catch (error) {
      console.error('Error adding to queue:', error);
      alert('Error adding to queue. Please try again.');
    }
  };

  const bulkDequeue = async () => {
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question to remove from queue.');
      return;
    }
    
    try {
      const result = await bulkReviewQueue(selectedQuestions, false);
      setSelectedQuestions([]);
      setSelectionMode(false);
      alert(`✓ Removed ${result.successCount} question(s) from review queue!`);
    } catch (error) {
      console.error('Error removing from queue:', error);
      alert('Error removing from queue. Please try again.');
    }
  };

  const handleSelectAllQuestionsInCategory = useCallback(async (category, value, event) => {
    console.log(`[Selection Debug] Triggered selection for ${category}: "${value}"`);
    let categoriesToProcess = [{ type: category, key: value }];

    // Comprehensive normalization for robust matching
    const robustNormalize = (str) => (str || '').toString()
        .normalize('NFC')
        .replace(/[\s\u200B\u200C\u200D\u09BC]+/g, '') // Remove all spaces, invisible chars, and Bengali Nukta
        .toLowerCase();

    const normalizedTargetValue = robustNormalize(value);

    // Handle Range Selection with Shift Key
    if (event && event.shiftKey && lastSelectedCategory && lastSelectedCategory.type === category) {
      const allValues = [...new Set(questions
        .map(q => q[category])
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
      
      const startIdx = allValues.map(robustNormalize).indexOf(robustNormalize(lastSelectedCategory.key));
      const endIdx = allValues.map(robustNormalize).indexOf(normalizedTargetValue);

      if (startIdx !== -1 && endIdx !== -1) {
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);
        const rangeValues = allValues.slice(minIdx, maxIdx + 1);
        
        categoriesToProcess = rangeValues.map(v => ({ type: category, key: v }));
      }
    }

    setLastSelectedCategory({ type: category, key: value });

    // Determine expected totals from hierarchy
    let totalExpected = 0;
    if (hierarchy && hierarchy.length > 0) {
        categoriesToProcess.forEach(cat => {
            const normKey = robustNormalize(cat.key);
            if (cat.type === 'subject') {
                const node = hierarchy.find(h => robustNormalize(h.name) === normKey);
                if (node) {
                    // Correctly sum chapter totals if subject total is missing/0
                    totalExpected += node.total || (node.chapters || []).reduce((sum, c) => sum + (c.total || 0), 0);
                } else {
                    console.log(`[Selection Debug] Subject "${cat.key}" (${normKey}) not found in hierarchy. Available subjects:`, 
                        hierarchy.map(h => `${h.name} -> ${robustNormalize(h.name)}`).join(', ')
                    );
                }
            } else if (cat.type === 'chapter') {
                let found = false;
                hierarchy.forEach(s => {
                    const chap = s.chapters?.find(c => robustNormalize(c.name) === normKey);
                    if (chap) {
                        totalExpected += chap.total || 0;
                        found = true;
                    }
                });
                if (!found) {
                    console.log(`[Selection Debug] Chapter "${cat.key}" (${normKey}) not found in any subject in hierarchy.`);
                }
            }
        });
    }

    console.log(`[Selection Debug] Category: ${category}, Value: ${value}, Expected from Hierarchy: ${totalExpected}`);

    const getLocalMatches = (qs, cat, val, list) => qs.filter(q => {
        if (!q) return false;
        if (cat === 'type' && val === 'Unspecified') {
            return !q.type || q.type === 'other' || q.type === 'Unspecified';
        }
        const qVal = robustNormalize(q[cat]);
        const match = list.some(c => qVal === robustNormalize(c.key));
        return match;
    });

    let currentMatches = getLocalMatches(questions, category, value, categoriesToProcess);
    console.log(`[Selection Debug] Found ${currentMatches.length} matches in local state.`);
    if (currentMatches.length > 0) {
        console.log(`[Selection Debug] Sample of matched questions (first 3):`, 
            currentMatches.slice(0, 3).map(q => ({ id: q.id, subject: q.subject, chapter: q.chapter, type: q.type }))
        );
    }
    
    // FETCH IF INCOMPLETE
    if (totalExpected > currentMatches.length + 2 && (category === 'subject' || category === 'chapter')) {
        console.log(`[Selection Debug] Triggering proactive fetch for incomplete category data...`);
        setFetchStatus(`Downloading ${totalExpected} questions...`);
        
        try {
            const allNewQuestionsRaw = [];
            for (const cat of categoriesToProcess) {
                const response = await questionApi.fetchQuestions({ 
                    [cat.type]: cat.key, 
                    limit: 5000 
                });
                const batch = Array.isArray(response) ? response : (response.data || []);
                allNewQuestionsRaw.push(...batch);
            }

            if (allNewQuestionsRaw.length > 0) {
                const mapped = allNewQuestionsRaw.map(mapDatabaseToApp);
                console.log(`[Selection Debug] Fetched ${mapped.length} additional questions.`);

                setQuestions(prev => {
                    const existingIds = new Set(prev.filter(p => p && p.id).map(p => p.id.toString()));
                    const uniqueNew = mapped.filter(m => m && m.id && !existingIds.has(m.id.toString()));
                    return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
                });

                // Update local matches directly from fetched data + current state
                const combinedIds = new Set(questions.filter(q => q && q.id).map(q => q.id.toString()));
                const combinedArray = [...questions.filter(q => q)];
                mapped.forEach(m => {
                    if (!combinedIds.has(m.id.toString())) {
                        combinedArray.push(m);
                        combinedIds.add(m.id.toString());
                    }
                });
                currentMatches = getLocalMatches(combinedArray, category, value, categoriesToProcess);
                console.log(`[Selection Debug] After fetch, matches increased to ${currentMatches.length}.`);
            }
        } catch (e) {
            console.error("[Selection Debug] Selection sync failed", e);
        } finally {
            setFetchStatus('');
        }
    }

    const allMatchingIds = currentMatches.map(q => q.id).filter(id => id !== undefined && id !== null);
    console.log(`[Selection Debug] Final ID list for selection has ${allMatchingIds.length} items.`);

    const isAlreadySelected = selectedCategories.some(cat => 
        cat.type === category && robustNormalize(cat.key) === normalizedTargetValue
    );

    if (categoriesToProcess.length === 1 && isAlreadySelected) {
      console.log(`[Selection Debug] Deselecting category.`);
      setSelectedQuestions(prev => prev.filter(id => !allMatchingIds.includes(id)));
      setSelectedCategories(prev => prev.filter(cat => 
        !(cat.type === category && robustNormalize(cat.key) === normalizedTargetValue)
      ));
    } else {
      console.log(`[Selection Debug] Adding category to selection.`);
      if (!selectionMode) setSelectionMode(true);
      setSelectedQuestions(prev => {
          const next = [...new Set([...prev, ...allMatchingIds])];
          console.log(`[Selection Debug] New selectedQuestions length: ${next.length}`);
          return next;
      });
      setSelectedCategories(prev => {
        const newCats = [...prev];
        categoriesToProcess.forEach(newCat => {
          if (!newCats.some(c => c.type === newCat.type && robustNormalize(c.key) === robustNormalize(newCat.key))) {
            newCats.push(newCat);
          }
        });
        return newCats;
      });
    }
  }, [questions, hierarchy, selectedCategories, selectionMode, lastSelectedCategory, setQuestions]);

  const handleSearch = useCallback(async (view = 'single') => {
    setIsSearching(true);
    
    let filtersToUse = currentFilters;
    if (view === 'left') filtersToUse = { ...currentFilters, ...leftFilters };
    if (view === 'right') filtersToUse = { ...currentFilters, ...rightFilters };
    
    try {
        const response = await questionApi.fetchQuestions({ 
            subject: filtersToUse.subject,
            chapter: filtersToUse.chapter,
            type: filtersToUse.type,
            board: filtersToUse.board,
            language: filtersToUse.language,
            limit: 5000 
        });
        const rawResults = Array.isArray(response) ? response : (response.data || []);
        
        if (rawResults.length > 0) {
            const mapped = rawResults.map(mapDatabaseToApp);

            setQuestions(prev => {
                const existing = new Set(prev.filter(p => p && p.id).map(p => p.id.toString()));
                const uniqueNew = mapped.filter(m => m && m.id && !existing.has(m.id.toString()));
                return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
            });

            setFullQuestionsMap(prev => {
                const next = new Map(prev);
                mapped.forEach(q => {
                    if (q && q.id) {
                        next.set(q.id.toString(), q);
                    }
                });
                return next;
            });
        }
    } catch (error) {
        console.error("Error pre-fetching for search:", error);
    }
    
    setHasSearched(true);
    setIsSearching(false);
  }, [currentFilters, leftFilters, rightFilters, setQuestions]);

  const handleFetchMore = async () => {
    setIsFetchingMore(true);
    setFetchStatus('Fetching...');
    try {
      const added = await fetchMoreQuestions();
      if (added > 0) {
        setFetchStatus(`Successfully added ${added} questions!`);
      } else {
        setFetchStatus('No more questions found.');
      }
      setTimeout(() => setFetchStatus(''), 3000);
    } catch (error) {
      setFetchStatus('Error fetching questions.');
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleFetchAll = async () => {
    if (!window.confirm("This will keep fetching questions until the entire database is downloaded. Continue?")) return;
    
    setIsFetchingAll(true);
    setFetchStatus('Starting full fetch...');
    try {
      const totalAdded = await fetchAllRemaining((progress) => {
        setFetchStatus(`Downloaded ${progress} more... (Total: ${questions.length + progress})`);
      });
      setFetchStatus(`Successfully finished! Added ${totalAdded} total questions.`);
      setTimeout(() => setFetchStatus(''), 5000);
    } catch (error) {
      setFetchStatus('Error during full fetch.');
    } finally {
      setIsFetchingAll(false);
    }
  };

  const handleSyncAllMetadata = async () => {
    if (!hierarchy || hierarchy.length === 0) {
        alert("Hierarchy not loaded yet. Please wait.");
        return;
    }
    
    if (!window.confirm("This will identify and download all missing question types for ALL chapters to make your statistics 100% accurate. This may take a minute. Continue?")) return;

    setIsSyncingMetadata(true);
    setFetchStatus('Identifying missing data...');
    
    try {
        const tasks = [];
        hierarchy.forEach(sub => {
            const subName = (sub.name || '').trim();
            sub.chapters?.forEach(chap => {
                const chapName = (chap.name || '').trim();
                const expected = chap.total || 0;
                const local = questions.filter(q => 
                    (q.subject || '').trim() === subName && 
                    (q.chapter || '').trim() === chapName
                ).length;
                
                if (local < expected - 2) { // Use small threshold for minor sync diffs
                    tasks.push({ subject: subName, chapter: chapName, expected, local });
                }
            });
        });
        
        if (tasks.length === 0) {
            alert("✅ All statistics are already 100% accurate!");
            setIsSyncingMetadata(false);
            setFetchStatus('');
            return;
        }
        
        console.log(`[Deep Sync] 🚀 Syncing ${tasks.length} chapters...`);
        setFetchStatus(`Syncing ${tasks.length} chapters...`);
        
        // Execute in parallel chunks
        const CHUNK_SIZE = 3;
        for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
            const chunk = tasks.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async task => {
                try {
                    const response = await questionApi.fetchQuestions({
                        subject: task.subject,
                        chapter: task.chapter,
                        limit: 5000 
                    });
                    const rawData = Array.isArray(response) ? response : (response.data || []);
                    
                    if (rawData.length > 0) {
                        const mapped = rawData.map(q => ({
                            id: q.id,
                            type: q.type,
                            subject: q.subject,
                            chapter: q.chapter,
                            lesson: q.lesson,
                            board: q.board,
                            language: q.language,
                            question: q.question,
                            questionText: q.question_text,
                            options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                            correctAnswer: q.correct_answer,
                            answer: q.answer,
                            parts: typeof q.parts === 'string' ? JSON.parse(q.parts) : q.parts,
                            image: q.image,
                            answerimage1: q.answerimage1,
                            answerimage2: q.answerimage2,
                            answerimage3: q.answerimage3,
                            answerimage4: q.answerimage4,
                            explanation: q.explanation,
                            tags: typeof q.tags === 'string' ? JSON.parse(q.tags) : q.tags,
                            isFlagged: q.is_flagged,
                            isVerified: q.is_verified,
                            inReviewQueue: q.in_review_queue
                        }));

                        setQuestions(prev => {
                            const existing = new Set(prev.filter(p => p && p.id).map(p => p.id.toString()));
                            const uniqueNew = mapped.filter(m => m && m.id && !existing.has(m.id.toString()));
                            if (uniqueNew.length === 0) return prev;
                            return [...prev, ...uniqueNew];
                        });
                    }
                } catch (err) {
                    console.error(`Failed to sync ${task.subject}/${task.chapter}:`, err);
                }
            }));
            setFetchStatus(`Synced ${Math.min(i + CHUNK_SIZE, tasks.length)} / ${tasks.length} chapters...`);
        }
        
        alert("✅ Deep Statistics Sync complete! All counts should now be accurate.");
    } catch (error) {
        console.error('Error during metadata sync:', error);
        alert('An error occurred during sync.');
    } finally {
        setIsSyncingMetadata(false);
        setFetchStatus('');
    }
  };

  const renderQuestionList = (qList, viewName = 'single') => {
    const displayList = qList.slice(0, visibleCount);
    const hasMore = qList.length > visibleCount;

    return (
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
            <>
              {displayList.map(question => {
                const fullQ = fullQuestionsMap.get(question.id);
                const displayQ = (fullQ && fullQ.isFlagged !== question.isFlagged) 
                    ? { ...fullQ, isFlagged: question.isFlagged } 
                    : (fullQ || question);

                return (
                  <QuestionCard 
                    key={question.id} 
                    question={displayQ}
                    selectionMode={selectionMode}
                    isSelected={selectedSet.has(question.id)}
                    onToggleSelect={stableToggleQuestionSelection}
                  />
                );
              })}
              
              {hasMore && (
                <div style={{ textAlign: 'center', padding: '20px', gridColumn: '1 / -1' }}>
                  <button 
                    onClick={() => setVisibleCount(prev => prev + 50)}
                    style={{
                      padding: '10px 30px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    ⏬ Show More Questions ({qList.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
        )}
    </div>
  )};

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
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '25px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px', color: '#444' }}>
                  Subject:
                  {uniqueSubjects.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#888', marginLeft: '8px' }}>
                      ({uniqueSubjects.length} existing values available)
                    </span>
                  )}
                </label>
                <input
                  list="subjects-list"
                  type="text"
                  placeholder="Type new subject or select existing..."
                  value={bulkMetadata.subject}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, subject: e.target.value }))}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <datalist id="subjects-list">
                  {uniqueSubjects.map((subject, idx) => (
                    <option key={idx} value={subject} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px', color: '#444' }}>
                  Chapter:
                  {uniqueChapters.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#888', marginLeft: '8px' }}>
                      ({uniqueChapters.length} existing values available)
                    </span>
                  )}
                </label>
                <input
                  list="chapters-list"
                  type="text"
                  placeholder="Type new chapter or select existing..."
                  value={bulkMetadata.chapter}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, chapter: e.target.value }))}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <datalist id="chapters-list">
                  {uniqueChapters.map((chapter, idx) => (
                    <option key={idx} value={chapter} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px', color: '#444' }}>
                  Lesson:
                  {uniqueLessons.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#888', marginLeft: '8px' }}>
                      ({uniqueLessons.length} existing values available)
                    </span>
                  )}
                </label>
                <input
                  list="lessons-list"
                  type="text"
                  placeholder="Type new lesson or select existing..."
                  value={bulkMetadata.lesson}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, lesson: e.target.value }))}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <datalist id="lessons-list">
                  {uniqueLessons.map((lesson, idx) => (
                    <option key={idx} value={lesson} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '14px', fontWeight: '600', display: 'block', marginBottom: '8px', color: '#444' }}>
                  Board:
                  {uniqueBoards.length > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#888', marginLeft: '8px' }}>
                      ({uniqueBoards.length} existing values available)
                    </span>
                  )}
                </label>
                <input
                  list="boards-list"
                  type="text"
                  placeholder="Type new board or select existing..."
                  value={bulkMetadata.board}
                  onChange={(e) => setBulkMetadata(prev => ({ ...prev, board: e.target.value }))}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', boxSizing: 'border-box' }}
                />
                <datalist id="boards-list">
                  {uniqueBoards.map((board, idx) => (
                    <option key={idx} value={board} />
                  ))}
                </datalist>
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
      {showDuplicateModal && (() => {
        // Derive filter options from ALL duplicate groups found
        const availableSubjects = [...new Set(duplicateGroups.map(g => g.original.subject).filter(Boolean))].sort();
        const availableChapters = [...new Set(duplicateGroups
          .filter(g => !duplicateResultsFilters.subject || g.original.subject === duplicateResultsFilters.subject)
          .map(g => g.original.chapter).filter(Boolean))].sort();
        const availableTypes = [...new Set(duplicateGroups.map(g => g.original.type).filter(Boolean))].sort();

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
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
              maxWidth: '1200px',
              width: '95%',
              maxHeight: '95vh',
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
                    🗑 Delete ALL {displayDuplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)} Duplicates (Filtered)
                  </button>
                  <button
                    onClick={() => setShowDuplicateModal(false)}
                    style={{
                      backgroundColor: '#6c757d', color: 'white', border: 'none',
                      padding: '8px 16px', borderRadius: '4px', cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Filtering Controls */}
              <div style={{ 
                display: 'flex', gap: '15px', padding: '15px', backgroundColor: '#f8f9fa', 
                borderRadius: '8px', marginBottom: '20px', alignItems: 'center', border: '1px solid #dee2e6' 
              }}>
                <span style={{ fontWeight: 'bold', color: '#495057' }}>Filter Results:</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                  <label style={{ fontSize: '0.8em', color: '#6c757d' }}>Subject</label>
                  <select 
                    value={duplicateResultsFilters.subject}
                    onChange={(e) => setDuplicateResultsFilters(prev => ({ ...prev, subject: e.target.value, chapter: '' }))}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ced4da' }}
                  >
                    <option value="">All Subjects</option>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                  <label style={{ fontSize: '0.8em', color: '#6c757d' }}>Chapter</label>
                  <select 
                    value={duplicateResultsFilters.chapter}
                    onChange={(e) => setDuplicateResultsFilters(prev => ({ ...prev, chapter: e.target.value }))}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ced4da' }}
                  >
                    <option value="">All Chapters</option>
                    {availableChapters.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '120px' }}>
                  <label style={{ fontSize: '0.8em', color: '#6c757d' }}>Type</label>
                  <select 
                    value={duplicateResultsFilters.type}
                    onChange={(e) => setDuplicateResultsFilters(prev => ({ ...prev, type: e.target.value }))}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ced4da' }}
                  >
                    <option value="">All Types</option>
                    {availableTypes.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                  </select>
                </div>

                <button 
                  onClick={() => setDuplicateResultsFilters({ subject: '', chapter: '', type: '' })}
                  style={{ 
                    marginTop: '15px', padding: '6px 12px', background: 'none', border: '1px solid #6c757d', 
                    borderRadius: '4px', cursor: 'pointer', color: '#6c757d', fontSize: '0.9em'
                  }}
                >
                  Clear
                </button>
              </div>

              <p style={{ color: '#666', marginBottom: '20px' }}>
                Showing <strong>{displayDuplicateGroups.reduce((acc, g) => acc + g.duplicates.length, 0)}</strong> duplicates across <strong>{displayDuplicateGroups.length}</strong> unique questions.
                {duplicateGroups.length > displayDuplicateGroups.length && (
                  <span style={{ marginLeft: '10px' }}>(Total found in scan: {duplicateGroups.length} groups)</span>
                )}
              </p>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {displayDuplicateGroups.map((group, idx) => (
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
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* SQ Fix Confirmation Modal */}
                {showSQFixModal && (
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
                                      <h3 style={{ margin: 0, color: '#e67e22' }}>🛠 Fix Corrupted SQs</h3>
                                      <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                          onClick={applySQFixes}
                                          style={{
                                            backgroundColor: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            padding: '8px 16px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold'
                                          }}
                                        >
                                          ✅ Fix All ({sqFixCandidates.length})
                                        </button>
                                        <button
                                          onClick={() => setShowSQFixModal(false)}
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
                                      Found <strong>{sqFixCandidates.length}</strong> SQ questions with corrupted text (e.g. embedded answers and board names).
                                      Review the changes below before applying.
                                    </p>
                        
                                    <div style={{ flex: 1, overflowY: 'auto' }}>
                                      {sqFixCandidates.map((item, idx) => (
                                        <div key={idx} style={{ 
                                          border: '1px solid #ddd', 
                                          borderRadius: '8px', 
                                          marginBottom: '20px',
                                          overflow: 'hidden',
                                          backgroundColor: '#fdfdfd'
                                        }}>
                                          <div style={{ 
                                            padding: '10px 15px', 
                                            backgroundColor: '#eee', 
                                            borderBottom: '1px solid #ddd',
                                            fontWeight: 'bold',
                                            fontSize: '0.9em'
                                          }}>
                                            Question ID: {item.original.id}
                                          </div>
                                          
                                          <div style={{ display: 'flex', minHeight: '150px' }}>
                                            {/* Before */}
                                            <div style={{ flex: 1, padding: '15px', borderRight: '1px solid #eee' }}>
                                              <strong style={{ display: 'block', color: '#c0392b', marginBottom: '5px' }}>Before (Corrupted):</strong>
                                              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>
                                                {item.original.question || item.original.questionText}
                                              </div>
                                              <div style={{ marginTop: '5px', fontSize: '11px', color: '#999' }}>Current Board: {item.original.board}</div>
                                              <div style={{ marginTop: '5px', fontSize: '11px', color: '#999' }}>Current Answer: {item.original.answer}</div>
                                            </div>
                        
                                            {/* After */}
                                            <div style={{ flex: 1, padding: '15px', backgroundColor: '#e8f8f5' }}>
                                              <strong style={{ display: 'block', color: '#27ae60', marginBottom: '5px' }}>After (Fixed):</strong>
                                              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>
                                                {item.fixed.question}
                                              </div>
                                              <div style={{ marginTop: '10px', fontSize: '12px' }}>
                                                 <strong>Extracted Answer:</strong> {item.fixed.answer}
                                              </div>
                                              <div style={{ marginTop: '5px', fontSize: '12px' }}>
                                                 <strong>Extracted Board:</strong> {item.fixed.board}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                        
                              {/* CQ Fix Confirmation Modal */}
                              {showCQFixModal && (
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
              <h3 style={{ margin: 0, color: '#e67e22' }}>🛠 Fix Corrupted CQs</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={applyCQFixes}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✅ Fix All ({cqFixCandidates.length})
                </button>
                <button
                  onClick={() => setShowCQFixModal(false)}
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
              Found <strong>{cqFixCandidates.length}</strong> questions with corrupted text (e.g. redundant parts in stimulus).
              Review the changes below before applying.
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cqFixCandidates.map((item, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  overflow: 'hidden',
                  backgroundColor: '#fdfdfd'
                }}>
                  <div style={{ 
                    padding: '10px 15px', 
                    backgroundColor: '#eee', 
                    borderBottom: '1px solid #ddd',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
                  }}>
                    Question ID: {item.original.id}
                  </div>
                  
                  <div style={{ display: 'flex', minHeight: '150px' }}>
                    {/* Before */}
                    <div style={{ flex: 1, padding: '15px', borderRight: '1px solid #eee' }}>
                      <strong style={{ display: 'block', color: '#c0392b', marginBottom: '5px' }}>Before (Corrupted):</strong>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>
                        {item.original.stimulus || item.original.question || item.original.questionText}
                      </div>
                    </div>

                    {/* After */}
                    <div style={{ flex: 1, padding: '15px', backgroundColor: '#e8f8f5' }}>
                      <strong style={{ display: 'block', color: '#27ae60', marginBottom: '5px' }}>After (Fixed):</strong>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>
                        {item.fixed.stimulus || item.fixed.question || item.fixed.questionText}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MCQ Fix Confirmation Modal */}
      {showMCQFixModal && (
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
              <h3 style={{ margin: 0, color: '#e67e22' }}>🛠 Fix Corrupted MCQs</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={applyMCQFixes}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✅ Fix All ({mcqFixCandidates.length})
                </button>
                <button
                  onClick={() => setShowMCQFixModal(false)}
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
              Found <strong>{mcqFixCandidates.length}</strong> questions with corrupted MCQ formatting.
              Review the changes below before applying.
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mcqFixCandidates.map((item, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  overflow: 'hidden',
                  backgroundColor: '#fdfdfd'
                }}>
                  <div style={{ 
                    padding: '10px 15px', 
                    backgroundColor: '#eee', 
                    borderBottom: '1px solid #ddd',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
                  }}>
                    Question ID: {item.original.id}
                  </div>
                  
                  <div style={{ display: 'flex', minHeight: '150px' }}>
                    {/* Before */}
                    <div style={{ flex: 1, padding: '15px', borderRight: '1px solid #eee' }}>
                      <strong style={{ display: 'block', color: '#c0392b', marginBottom: '5px' }}>Before (Corrupted):</strong>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>
                        {item.original.question || item.original.questionText}
                      </div>
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#999' }}>
                        <em>Options: {item.original.options?.length || 0} found</em>
                      </div>
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#999' }}>
                         <em>Board: {item.original.board || 'None'}</em>
                      </div>
                    </div>

                    {/* After */}
                    <div style={{ flex: 1, padding: '15px', backgroundColor: '#e8f8f5' }}>
                      <strong style={{ display: 'block', color: '#27ae60', marginBottom: '5px' }}>After (Fixed):</strong>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>
                        {item.fixed.question}
                      </div>
                      <div style={{ marginTop: '10px' }}>
                         <strong>Extracted Options:</strong>
                         <ul style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '12px' }}>
                            {item.fixed.options.map((opt, i) => (
                                <li key={i}><strong>{opt.label}:</strong> {opt.text}</li>
                            ))}
                         </ul>
                         <div style={{ fontSize: '12px' }}><strong>Correct Answer:</strong> {item.fixed.correctAnswer}</div>
                         <div style={{ marginTop: '5px', fontSize: '12px', color: item.fixed.board ? '#333' : '#e67e22' }}>
                             <strong>Board:</strong> {item.fixed.board || <em>(Cleared)</em>}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MCQ Field Sync Modal */}
      {showMCQSyncModal && (
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
          {/* ... existing MCQ modal content ... */}
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
              <h3 style={{ margin: 0, color: '#3498db' }}>🔄 Sync MCQ Question Fields</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={applyMCQSyncAllBatched}
                  disabled={isAutoSyncing || isFixing}
                  style={{
                    backgroundColor: '#e67e22',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: (isAutoSyncing || isFixing) ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {isAutoSyncing ? '🚀 Auto-Syncing...' : '🚀 Auto-Sync All (100/batch)'}
                </button>
                <button
                  onClick={() => applyMCQSync()}
                  disabled={isAutoSyncing || isFixing}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: (isAutoSyncing || isFixing) ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✅ Sync All ({mcqSyncCandidates.length})
                </button>
                <button
                  onClick={() => setShowMCQSyncModal(false)}
                  disabled={isAutoSyncing}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: isAutoSyncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {isAutoSyncing && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                        <span>Progress: {syncProgress.current} / {syncProgress.total}</span>
                        <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ 
                            width: `${(syncProgress.current / syncProgress.total) * 100}%`, 
                            height: '100%', 
                            backgroundColor: '#3498db',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            <p style={{ color: '#666', marginBottom: '20px' }}>
              Found <strong>{mcqSyncCandidates.length}</strong> MCQs with both <code>question_text</code> and <code>question</code> fields set.
              This will overwrite the <code>question</code> field with content from <code>question_text</code>.
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mcqSyncCandidates.map((item, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  overflow: 'hidden',
                  backgroundColor: '#fdfdfd'
                }}>
                  <div style={{ 
                    padding: '10px 15px', 
                    backgroundColor: '#eee', 
                    borderBottom: '1px solid #ddd',
                    fontWeight: 'bold',
                    fontSize: '0.9em',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Question ID: {item.original.id}</span>
                    <button
                      onClick={async () => {
                        setIsFixing(true);
                        try {
                          console.log(`📤 Applying MCQ sync to single question ID ${item.fixed.id}...`);
                          const result = await bulkUpdateQuestions([item.fixed]);
                          console.log("📥 Sync result:", result);
                          
                          if (result.successCount > 0) {
                            alert(`Successfully synced MCQ ID ${item.fixed.id}!`);
                            // Remove from candidates
                            setMcqSyncCandidates(prev => prev.filter(c => c.original.id !== item.original.id));
                            
                            // Refresh full map
                            setFullQuestionsMap(prev => {
                                const next = new Map(prev);
                                next.set(item.fixed.id, item.fixed);
                                return next;
                            });
                          } else {
                            alert("Sync failed for this question.");
                          }
                        } catch (err) {
                          console.error("Error syncing question:", err);
                          alert("Error syncing question.");
                        } finally {
                          setIsFixing(false);
                        }
                      }}
                      disabled={isFixing}
                      style={{
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {isFixing ? 'Syncing...' : 'Sync This Question'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', minHeight: '100px' }}>
                    {/* Before (Current Question Column) */}
                    <div style={{ flex: 1, padding: '15px', borderRight: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: '#c0392b' }}>Current "question":</strong>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: item.originalAnswer.hasAnswer ? '#e8f8f5' : '#f9ebea',
                            color: item.originalAnswer.hasAnswer ? '#27ae60' : '#c0392b',
                            fontWeight: 'bold'
                        }}>
                           {item.originalAnswer.hasAnswer ? `✓ Ans (${item.originalAnswer.source})` : '✗ No Ans'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>
                        {item.original.question}
                      </div>
                    </div>

                    {/* After (Current Question Text Column) */}
                    <div style={{ flex: 1, padding: '15px', backgroundColor: '#e8f8f5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: '#27ae60' }}>New "question":</strong>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: item.fixedAnswer.hasAnswer ? '#e8f8f5' : '#f9ebea',
                            color: item.fixedAnswer.hasAnswer ? '#27ae60' : '#c0392b',
                            fontWeight: 'bold'
                        }}>
                           {item.fixedAnswer.hasAnswer ? `✓ Ans (${item.fixedAnswer.source})` : '✗ No Ans'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>
                        {item.original.questionText}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SQ Field Sync Modal */}
      {showSQSyncModal && (
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
          {/* ... Content previously added for SQ ... */}
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
              <h3 style={{ margin: 0, color: '#9b59b6' }}>🔄 Sync SQ Question Fields</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={applySQSyncAllBatched}
                  disabled={isAutoSyncing || isFixing}
                  style={{
                    backgroundColor: '#e67e22',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: (isAutoSyncing || isFixing) ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {isAutoSyncing ? '🚀 Auto-Syncing...' : '🚀 Auto-Sync All (100/batch)'}
                </button>
                <button
                  onClick={() => applySQSync()}
                  disabled={isAutoSyncing || isFixing}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: (isAutoSyncing || isFixing) ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✅ Sync All ({sqSyncCandidates.length})
                </button>
                <button
                  onClick={() => setShowSQSyncModal(false)}
                  disabled={isAutoSyncing}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: isAutoSyncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {isAutoSyncing && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                        <span>Progress: {syncProgress.current} / {syncProgress.total}</span>
                        <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ 
                            width: `${(syncProgress.current / syncProgress.total) * 100}%`, 
                            height: '100%', 
                            backgroundColor: '#9b59b6',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            <p style={{ color: '#666', marginBottom: '20px' }}>
              Found <strong>{sqSyncCandidates.length}</strong> Short Questions where <code>question</code> column does not match <code>question_text</code>.
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sqSyncCandidates.map((item, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  overflow: 'hidden',
                  backgroundColor: '#fdfdfd'
                }}>
                  <div style={{ 
                    padding: '10px 15px', 
                    backgroundColor: '#eee', 
                    borderBottom: '1px solid #ddd',
                    fontWeight: 'bold',
                    fontSize: '0.9em',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Question ID: {item.original.id}</span>
                    <button
                      onClick={async () => {
                        setIsFixing(true);
                        try {
                          const result = await bulkUpdateQuestions([item.fixed]);
                          if (result.successCount > 0) {
                            alert(`Synced SQ ID ${item.fixed.id}!`);
                            setSqSyncCandidates(prev => prev.filter(c => c.original.id !== item.original.id));
                            setFullQuestionsMap(prev => {
                                const next = new Map(prev);
                                next.set(item.fixed.id, item.fixed);
                                return next;
                            });
                          }
                        } catch (err) {
                          console.error(err);
                          alert("Error syncing SQ.");
                        } finally {
                          setIsFixing(false);
                        }
                      }}
                      disabled={isFixing}
                      style={{
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {isFixing ? 'Syncing...' : 'Sync This SQ'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', minHeight: '100px' }}>
                    <div style={{ flex: 1, padding: '15px', borderRight: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: '#c0392b' }}>Current "question":</strong>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: item.originalAnswer.hasAnswer ? '#e8f8f5' : '#f9ebea',
                            color: item.originalAnswer.hasAnswer ? '#27ae60' : '#c0392b',
                            fontWeight: 'bold'
                        }}>
                           {item.originalAnswer.hasAnswer ? `✓ Ans (${item.originalAnswer.source})` : '✗ No Ans'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>
                        {item.original.question}
                      </div>
                    </div>

                    <div style={{ flex: 1, padding: '15px', backgroundColor: '#f5eef8' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: '#8e44ad' }}>New "question":</strong>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: item.fixedAnswer.hasAnswer ? '#e8f8f5' : '#f9ebea',
                            color: item.fixedAnswer.hasAnswer ? '#27ae60' : '#c0392b',
                            fontWeight: 'bold'
                        }}>
                           {item.fixedAnswer.hasAnswer ? `✓ Ans (${item.fixedAnswer.source})` : '✗ No Ans'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>
                        {item.original.questionText}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CQ Field Sync Modal */}
      {showCQSyncModal && (
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
              <h3 style={{ margin: 0, color: '#e74c3c' }}>🔄 Sync CQ Question Fields</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={applyCQSyncAllBatched}
                  disabled={isAutoSyncing || isFixing}
                  style={{
                    backgroundColor: '#e67e22',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: (isAutoSyncing || isFixing) ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {isAutoSyncing ? '🚀 Auto-Syncing...' : '🚀 Auto-Sync All (100/batch)'}
                </button>
                <button
                  onClick={() => applyCQSync()}
                  disabled={isAutoSyncing || isFixing}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: (isAutoSyncing || isFixing) ? 'wait' : 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ✅ Sync All ({cqSyncCandidates.length})
                </button>
                <button
                  onClick={() => setShowCQSyncModal(false)}
                  disabled={isAutoSyncing}
                  style={{
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: isAutoSyncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {isAutoSyncing && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                        <span>Progress: {syncProgress.current} / {syncProgress.total}</span>
                        <span>{Math.round((syncProgress.current / syncProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ width: '100%', height: '10px', backgroundColor: '#eee', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ 
                            width: `${(syncProgress.current / syncProgress.total) * 100}%`, 
                            height: '100%', 
                            backgroundColor: '#e74c3c',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            <p style={{ color: '#666', marginBottom: '20px' }}>
              Found <strong>{cqSyncCandidates.length}</strong> Creative Questions where <code>question</code> column does not match <code>question_text</code>.
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cqSyncCandidates.map((item, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  borderRadius: '8px', 
                  marginBottom: '20px',
                  overflow: 'hidden',
                  backgroundColor: '#fdfdfd'
                }}>
                  <div style={{ 
                    padding: '10px 15px', 
                    backgroundColor: '#eee', 
                    borderBottom: '1px solid #ddd',
                    fontWeight: 'bold',
                    fontSize: '0.9em',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Question ID: {item.original.id}</span>
                    <button
                      onClick={async () => {
                        setIsFixing(true);
                        try {
                          const result = await bulkUpdateQuestions([item.fixed]);
                          if (result.successCount > 0) {
                            alert(`Synced CQ ID ${item.fixed.id}!`);
                            setCqSyncCandidates(prev => prev.filter(c => c.original.id !== item.original.id));
                            setFullQuestionsMap(prev => {
                                const next = new Map(prev);
                                next.set(item.fixed.id, item.fixed);
                                return next;
                            });
                          }
                        } catch (err) {
                          console.error(err);
                          alert("Error syncing CQ.");
                        } finally {
                          setIsFixing(false);
                        }
                      }}
                      disabled={isFixing}
                      style={{
                        backgroundColor: '#3498db',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      {isFixing ? 'Syncing...' : 'Sync This CQ'}
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', minHeight: '100px' }}>
                    <div style={{ flex: 1, padding: '15px', borderRight: '1px solid #eee' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: '#c0392b' }}>Current "question":</strong>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: item.originalAnswer.hasAnswer ? '#e8f8f5' : '#f9ebea',
                            color: item.originalAnswer.hasAnswer ? '#27ae60' : '#c0392b',
                            fontWeight: 'bold'
                        }}>
                           {item.originalAnswer.hasAnswer ? `✓ Ans (${item.originalAnswer.source})` : '✗ No Ans'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>
                        {item.original.question}
                      </div>
                    </div>

                    <div style={{ flex: 1, padding: '15px', backgroundColor: '#fdedec' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                        <strong style={{ color: '#e74c3c' }}>New "question":</strong>
                        <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px', 
                            backgroundColor: item.fixedAnswer.hasAnswer ? '#e8f8f5' : '#f9ebea',
                            color: item.fixedAnswer.hasAnswer ? '#27ae60' : '#c0392b',
                            fontWeight: 'bold'
                        }}>
                           {item.fixedAnswer.hasAnswer ? `✓ Ans (${item.fixedAnswer.source})` : '✗ No Ans'}
                        </span>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>
                        {item.original.questionText}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unanswered MCQ Detector Modal */}
      {showUnansweredMCQModal && (
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
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#c0392b' }}>❓ Unanswered MCQs Found</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={fixAllUnansweredOptions}
                  disabled={isFixing}
                  style={{
                    backgroundColor: '#2ecc71',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🛠 Fix Options
                </button>
                <button
                  onClick={flagUnansweredMCQs}
                  disabled={isFixing}
                  style={{
                    backgroundColor: '#e67e22',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🚩 Flag All ({unansweredMCQs.length})
                </button>
                <button
                  onClick={deleteUnansweredMCQs}
                  disabled={isFixing}
                  style={{
                    backgroundColor: '#c0392b',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🗑 Delete All
                </button>
                <button
                  onClick={() => setShowUnansweredMCQModal(false)}
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
              These <strong>{unansweredMCQs.length}</strong> MCQs have no answer in the database field AND no embedded answer found in the question text.
            </p>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {unansweredMCQs.map((q, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #eee', 
                  borderRadius: '12px', 
                  marginBottom: '15px',
                  padding: '20px',
                  backgroundColor: q.isFlagged ? '#f8f9fa' : '#fffaf0',
                  opacity: q.isFlagged ? 0.7 : 1,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '20px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ 
                            fontSize: '0.75em', 
                            padding: '2px 8px', 
                            borderRadius: '10px', 
                            backgroundColor: '#3498db', 
                            color: 'white',
                            fontWeight: 'bold'
                        }}>
                            ID: {q.id}
                        </span>
                        {q.board && (
                            <span style={{ fontSize: '0.75em', color: '#666' }}>{q.board}</span>
                        )}
                        {q.isFlagged && (
                            <span style={{ fontSize: '0.75em', color: '#e67e22', fontWeight: 'bold' }}>🚩 FLAGGED</span>
                        )}
                    </div>
                    
                    <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '12px', 
                        fontSize: '1.05em',
                        color: q.isFlagged ? '#888' : '#2c3e50',
                        textDecoration: q.isFlagged ? 'line-through' : 'none'
                    }}>
                        {q.questionText || q.question}
                    </div>
                    
                    <div style={{ fontSize: '0.9em', color: '#666' }}>
                        {q.options && q.options.length > 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {q.options.map((opt, i) => (
                                    <div key={i} style={{ padding: '4px 8px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}>
                                        <strong>{opt.label}:</strong> {opt.text}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: '#c0392b', fontStyle: 'italic', backgroundColor: '#f9ebea', padding: '8px', borderRadius: '4px' }}>
                                ⚠️ No options available for this question
                            </div>
                        )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
                    <button
                        onClick={async () => {
                            const fixed = detectAndFixMCQOptions(q);
                            if (fixed) {
                                if (window.confirm('Fixed options detected. Update this question?')) {
                                    await updateQuestion(fixed);
                                    setUnansweredMCQs(prev => prev.map(item => item.id === q.id ? fixed : item));
                                }
                            } else {
                                alert('Could not automatically fix options for this question.');
                            }
                        }}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: '#2ecc71',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.9em',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        🛠 Fix Options
                    </button>
                    <button
                        onClick={() => toggleSingleUnansweredFlag(q)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: q.isFlagged ? '#95a5a6' : '#e67e22',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.9em',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {q.isFlagged ? '✓ Unflag' : '🚩 Flag Now'}
                    </button>
                    
                    <button
                        onClick={async () => {
                            if (window.confirm('Delete this broken question?')) {
                                await deleteQuestion(q.id);
                                setUnansweredMCQs(prev => prev.filter(item => item.id !== q.id));
                            }
                        }}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: '1px solid #fab1a0',
                            backgroundColor: 'white',
                            color: '#d63031',
                            cursor: 'pointer',
                            fontSize: '0.9em',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
            onClick={handleFixCorruptedMCQs}
            disabled={isFixing}
            style={{
              backgroundColor: '#e67e22',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isFixing ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isFixing ? '🛠 Fixing...' : '🛠 Fix Corrupted MCQs'}
          </button>

          <button
            onClick={() => handleSyncMCQFields(null)}
            disabled={isFixing}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isFixing ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isFixing ? '🔄 Syncing...' : '🔄 Sync MCQ Fields'}
          </button>

          <button
            onClick={handleSyncSQFields}
            disabled={isFixing}
            style={{
              backgroundColor: '#9b59b6',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isFixing ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isFixing ? '🔄 Syncing...' : '🔄 Sync SQ Fields'}
          </button>

          <button
            onClick={handleSyncCQFields}
            disabled={isFixing}
            style={{
              backgroundColor: '#e74c3c',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isFixing ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isFixing ? '🔄 Syncing...' : '🔄 Sync CQ Fields'}
          </button>

                          <button 
                            onClick={handleNormalizeCQImages}
                            disabled={isFixing}
                            style={{ backgroundColor: '#20c997' }}
                            title="Move images from parts array to dedicated columns"
                          >
                            {isFixing ? 'Processing...' : '🖼️ Normalize CQ Images'}
                          </button>
                          <button 
                            onClick={handleScanCorruptedCQs}
                            disabled={isFixing}            style={{
              backgroundColor: '#d35400',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isFixing ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isFixing ? '🛠 Fixing...' : '🛠 Fix Corrupted CQs'}
          </button>

          <button
            onClick={handleFixCorruptedSQs}
            disabled={isFixing}
            style={{
              backgroundColor: '#e67e22',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isFixing ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isFixing ? '🛠 Fixing...' : '🛠 Fix Corrupted SQs'}
          </button>

          <button
            onClick={handleFindMCQsWithMergedOptions}
            disabled={isSearching}
            style={{
              backgroundColor: '#27ae60',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isSearching ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isSearching ? '⏳ Scanning...' : '🛠 Auto-Fix Merged Options'}
          </button>

          <button
            onClick={handleFindUnansweredMCQs}
            disabled={isSearching}
            style={{
              backgroundColor: '#c0392b',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: isSearching ? 'wait' : 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            {isSearching ? '⏳ Scanning...' : '🚩 Auto-Flag Unanswered MCQs'}
          </button>

          <button
            onClick={() => {
              setBulkFixType('mcq');
              setShowBulkFixModal(true);
            }}
            style={{
              backgroundColor: '#e67e22',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            🚩 Bulk Fix Flagged
          </button>

          <button
            onClick={() => {
              setReviewQueueType('mcq');
              setShowReviewQueueModal(true);
            }}
            style={{
              backgroundColor: '#3498db',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              marginRight: '10px'
            }}
          >
            📋 Review Queue
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
                onClick={bulkVerify}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#2ecc71' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✅ Verify ({selectedQuestions.length})
              </button>

              <button 
                onClick={bulkUnverify}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#f39c12' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ❌ Unverify ({selectedQuestions.length})
              </button>

              <button 
                onClick={bulkQueue}
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
                📋 Queue ({selectedQuestions.length})
              </button>

              <button 
                onClick={bulkDequeue}
                disabled={selectedQuestions.length === 0}
                style={{
                  backgroundColor: selectedQuestions.length > 0 ? '#5dade2' : '#ccc',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: selectedQuestions.length > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                ✓ De-queue ({selectedQuestions.length})
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
            <div style={{marginBottom: '15px', marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center'}}>
                {fetchStatus && <span style={{fontSize: '12px', color: '#666'}}>{fetchStatus}</span>}
                <button 
                    onClick={handleSyncAllMetadata}
                    disabled={isSyncingMetadata || isFetchingAll || isFetchingMore}
                    style={{
                        padding: '10px 20px', 
                        backgroundColor: '#9b59b6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: (isSyncingMetadata || isFetchingAll || isFetchingMore) ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    {isSyncingMetadata ? '🔄 Syncing Stats...' : '🔄 Deep Sync Stats'}
                </button>
                <button 
                    onClick={handleFetchAll}
                    disabled={isFetchingAll || isFetchingMore}
                    style={{
                        padding: '10px 20px', 
                        backgroundColor: '#e67e22', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: (isFetchingAll || isFetchingMore) ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    {isFetchingAll ? '⏳ Fetching All...' : '📥 Fetch All (Remaining)'}
                </button>
                <button 
                    onClick={handleFetchMore}
                    disabled={isFetchingAll || isFetchingMore}
                    style={{
                        padding: '10px 20px', 
                        backgroundColor: '#27ae60', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px',
                        cursor: (isFetchingAll || isFetchingMore) ? 'wait' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                    }}
                >
                    {isFetchingMore ? '⏳ Fetching...' : '➕ Fetch More (500)'}
                </button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h3 style={{ margin: 0 }}>Statistics Breakdown</h3>
                    <button 
                      onClick={() => {
                        if (window.confirm('This will clear your local question cache and reload from the server. Use this if you see deleted chapters or stale data. Continue?')) {
                            clearCache();
                            window.location.reload();
                        }
                      }}
                      style={{
                        padding: '5px 10px',
                        fontSize: '11px',
                        backgroundColor: '#f8d7da',
                        color: '#721c24',
                        border: '1px solid #f5c6cb',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      🗑️ Clear Stale Cache
                    </button>
                </div>
                <button 
                  onClick={() => setShowStats(!showStats)}
                  style={{
                    padding: '5px 10px',
                    fontSize: '12px',
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {showStats ? 'Hide Stats' : 'Show Stats'}
                </button>
            </div>
            {showStats && (
              <Statistics 
                  questions={filteredQuestionsSingle} 
                  filters={currentFilters}
                  onFilterSelect={(key, value) => {
                      const updates = { [key]: value };
                      if (key === 'subject') {
                          updates.chapter = '';
                          updates.lesson = '';
                      } else if (key === 'chapter') {
                          updates.lesson = '';
                      }
                      setFilters(updates);
                  }}
                  onSelectAll={handleSelectAllQuestionsInCategory}
                  selectedCategories={selectedCategories}
              />
            )}
            {renderQuestionList(filteredQuestionsSingle)}
          </>
      ) : (
          <div style={{ display: 'flex', gap: '20px', width: '100%' }}>
              {/* Left Pane */}
              <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
                  <h3 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Left View</h3>
                  <SearchFilters 
                    filters={leftFilters} 
                    onFilterChange={(newFilters) => {
                        setLeftFilters(prev => {
                            const updated = { ...prev, ...newFilters };
                            if (newFilters.subject) {
                                updated.chapter = '';
                                updated.lesson = '';
                            } else if (newFilters.chapter) {
                                updated.lesson = '';
                            }
                            return updated;
                        });
                    }} 
                  />
                  <div style={{marginBottom: '10px', marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                     <button 
                        onClick={handleFetchAll}
                        disabled={isFetchingAll || isFetchingMore}
                        style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#e67e22',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}
                     >
                        {isFetchingAll ? '...' : '📥 Fetch All'}
                     </button>
                     <button 
                        onClick={handleFetchMore}
                        disabled={isFetchingAll || isFetchingMore}
                        style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#27ae60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}
                     >
                        {isFetchingMore ? '...' : '➕ Fetch More'}
                     </button>
                     <button 
                        onClick={() => handleSearch('left')}
                        disabled={isSearching}
                        style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}
                     >
                        {isSearching ? '...' : '🔍 Search Left'}
                     </button>
                  </div>
                  <Statistics 
                    questions={filteredQuestionsLeft} 
                    filters={leftFilters}
                    onFilterSelect={(key, value) => {
                        console.log(`[SplitView Debug] Left Filter Select: ${key} = ${value}`);
                        setLeftFilters(prev => {
                            const updated = { ...prev, [key]: value };
                            if (key === 'subject') {
                                updated.chapter = '';
                                updated.lesson = '';
                            } else if (key === 'chapter') {
                                updated.lesson = '';
                            }
                            return updated;
                        });
                    }}
                    onSelectAll={handleSelectAllQuestionsInCategory}
                    selectedCategories={selectedCategories}
                  />
                  {renderQuestionList(filteredQuestionsLeft, 'left')}
              </div>
              
              {/* Right Pane */}
              <div style={{ flex: 1, border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
                  <h3 style={{marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Right View</h3>
                   <SearchFilters 
                    filters={rightFilters} 
                    onFilterChange={(newFilters) => {
                        setRightFilters(prev => {
                            const updated = { ...prev, ...newFilters };
                            if (newFilters.subject) {
                                updated.chapter = '';
                                updated.lesson = '';
                            } else if (newFilters.chapter) {
                                updated.lesson = '';
                            }
                            return updated;
                        });
                    }} 
                  />
                  <div style={{marginBottom: '10px', marginTop: '10px', display: 'flex', gap: '5px', flexWrap: 'wrap'}}>
                     <button 
                        onClick={handleFetchAll}
                        disabled={isFetchingAll || isFetchingMore}
                        style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#e67e22',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}
                     >
                        {isFetchingAll ? '...' : '📥 Fetch All'}
                     </button>
                     <button 
                        onClick={handleFetchMore}
                        disabled={isFetchingAll || isFetchingMore}
                        style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#27ae60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}
                     >
                        {isFetchingMore ? '...' : '➕ Fetch More'}
                     </button>
                     <button 
                        onClick={() => handleSearch('right')}
                        disabled={isSearching}
                        style={{
                            flex: 1,
                            padding: '8px',
                            backgroundColor: '#3498db',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '11px'
                        }}
                     >
                        {isSearching ? '...' : '🔍 Search Right'}
                     </button>
                  </div>
                  <Statistics 
                    questions={filteredQuestionsRight} 
                    filters={rightFilters}
                    onFilterSelect={(key, value) => {
                        console.log(`[SplitView Debug] Right Filter Select: ${key} = ${value}`);
                        setRightFilters(prev => {
                            const updated = { ...prev, [key]: value };
                            if (key === 'subject') {
                                updated.chapter = '';
                                updated.lesson = '';
                            } else if (key === 'chapter') {
                                updated.lesson = '';
                            }
                            return updated;
                        });
                    }}
                    onSelectAll={handleSelectAllQuestionsInCategory}
                    selectedCategories={selectedCategories}
                  />
                  {renderQuestionList(filteredQuestionsRight, 'right')}
              </div>
          </div>
      )}
      
    </div>
      {/* Bulk Fix Flagged Questions Modal */}
      {showMigrationModal && (
        <div className="password-overlay" style={{ zIndex: 1100 }}>
          <div className="password-prompt" style={{ width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', textAlign: 'left' }}>
            <h2 style={{ color: '#20c997', marginBottom: '20px' }}>🖼️ Image Normalization Preview</h2>
            <p>The following {migrationCandidates.length} questions have images stored in the <strong>Parts Array</strong> but not in the <strong>Dedicated Columns</strong>. Normalizing them will move these images to the columns for better external app support.</p>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>ID / Board</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Migration Mapping</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {migrationCandidates.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>
                      <strong style={{ color: '#007bff' }}>{item.question.id}</strong><br/>
                      <span style={{ fontSize: '11px', color: '#666' }}>{item.question.board}</span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {item.changes.map((c, cIdx) => (
                        <div key={cIdx} style={{ marginBottom: '5px', fontSize: '13px' }}>
                          Part <strong>{c.part}</strong> ➔ Column <strong>{c.targetColumn}</strong>
                        </div>
                      ))}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        {item.changes.map((c, cIdx) => (
                          <div key={cIdx} style={{ textAlign: 'center' }}>
                             <img src={c.imageUrl} alt="preview" style={{ width: '40px', height: '40px', objectFit: 'contain', border: '1px solid #ddd' }} />
                             <div style={{ fontSize: '9px' }}>{c.part}</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '30px', display: 'flex', gap: '10px', justifyContent: 'flex-end', position: 'sticky', bottom: 0, backgroundColor: 'white', padding: '15px 0' }}>
              <button onClick={() => setShowMigrationModal(false)} style={{ backgroundColor: '#6c757d' }}>Cancel</button>
              <button 
                onClick={applyMigration} 
                disabled={isFixing}
                style={{ backgroundColor: '#20c997', fontWeight: 'bold' }}
              >
                {isFixing ? 'Applying...' : `🚀 Apply Migration to ${migrationCandidates.length} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkFixModal && (
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
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#e67e22' }}>🚩 Bulk Fix Flagged Questions</h2>
              <button 
                onClick={() => setShowBulkFixModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {['mcq', 'cq', 'sq'].map(type => {
                const count = questions.filter(q => q.isFlagged && q.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setBulkFixType(type);
                      setBulkFixInputText('');
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid',
                      borderColor: bulkFixType === type ? '#e67e22' : '#eee',
                      backgroundColor: bulkFixType === type ? '#fff3e0' : 'white',
                      color: bulkFixType === type ? '#e67e22' : '#666',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {type.toUpperCase()} ({count})
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: 0 }}>
              {/* Left Side: Instructions & Preview/Action */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #eee' }}>
                  <h4 style={{ marginTop: 0 }}>Step 1: Export Flagged</h4>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    Copy all currently flagged <strong>{bulkFixType.toUpperCase()}</strong> questions. 
                    They will be formatted so you can easily improve them in an editor.
                  </p>
                  <button
                    onClick={() => {
                      const text = generateBulkFixText(bulkFixType);
                      navigator.clipboard.writeText(text);
                      alert('📋 Copied to clipboard! Improve them and paste in Step 2.');
                    }}
                    disabled={questions.filter(q => q.isFlagged && q.type === bulkFixType).length === 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📋 Copy Flagged {bulkFixType.toUpperCase()}
                  </button>
                </div>

                <div style={{ backgroundColor: '#fff3e0', padding: '15px', borderRadius: '8px', flex: 1, border: '1px solid #ffe0b2' }}>
                  <h4 style={{ marginTop: 0 }}>Step 2: Replace & Sync</h4>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    Paste the <strong>IMPROVED</strong> questions here. The system will parse them and update the flagged questions in the <strong>SAME ORDER</strong>.
                  </p>
                  <textarea
                    value={bulkFixInputText}
                    onChange={(e) => setBulkFixInputText(e.target.value)}
                    placeholder={`Paste improved ${bulkFixType.toUpperCase()} here...`}
                    style={{
                      width: '100%',
                      flex: 1,
                      minHeight: '200px',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #ffe0b2',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              {/* Right Side: Current Content Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 15px', backgroundColor: '#eee', fontWeight: 'bold', fontSize: '14px' }}>
                  Current Flagged Content Preview
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px', backgroundColor: '#fafafa' }}>
                  {questions.filter(q => q.isFlagged && q.type === bulkFixType).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>No flagged questions of this type.</div>
                  ) : (
                    questions.filter(q => q.isFlagged && q.type === bulkFixType).map((q, i) => (
                      <div key={q.id} style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px', fontSize: '12px' }}>
                        <strong>#{i+1} (ID: {q.id})</strong>
                        <div style={{ color: '#666', marginTop: '5px', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {q.questionText || q.question}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowBulkFixModal(false)}
                style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkReplace}
                disabled={isFixing || !bulkFixInputText.trim()}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#e67e22',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: (isFixing || !bulkFixInputText.trim()) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px rgba(230, 126, 34, 0.2)'
                }}
              >
                {isFixing ? '⏳ Syncing Changes...' : `🚀 Replace All Flagged ${bulkFixType.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Queue Modal */}
      {showReviewQueueModal && (
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
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#3498db' }}>📋 Review & Verify Queue</h2>
              <button 
                onClick={() => setShowReviewQueueModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {['mcq', 'cq', 'sq'].map(type => {
                const count = questions.filter(q => q.inReviewQueue && q.type === type).length;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setReviewQueueType(type);
                      setReviewQueueInputText('');
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '2px solid',
                      borderColor: reviewQueueType === type ? '#3498db' : '#eee',
                      backgroundColor: reviewQueueType === type ? '#ebf5fb' : 'white',
                      color: reviewQueueType === type ? '#3498db' : '#666',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    {type.toUpperCase()} ({count})
                  </button>
                );
              })}
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', minHeight: 0 }}>
              {/* Left Side: Instructions & Paste Area */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #eee' }}>
                  <h4 style={{ marginTop: 0 }}>Step 1: Export Queue</h4>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    Copy all queued <strong>{reviewQueueType.toUpperCase()}</strong> questions. 
                    Format them in an external editor, then paste back in Step 2.
                  </p>
                  <button
                    onClick={() => {
                      const text = generateReviewQueueText(reviewQueueType);
                      navigator.clipboard.writeText(text);
                      alert('📋 Copied to clipboard! Verify content and paste in Step 2.');
                    }}
                    disabled={questions.filter(q => q.inReviewQueue && q.type === reviewQueueType).length === 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📋 Copy Queued {reviewQueueType.toUpperCase()}
                  </button>
                </div>

                <div style={{ backgroundColor: '#ebf5fb', padding: '15px', borderRadius: '8px', flex: 1, border: '1px solid #d6eaf8' }}>
                  <h4 style={{ marginTop: 0 }}>Step 2: Paste & Verify</h4>
                  <p style={{ fontSize: '13px', color: '#666' }}>
                    Paste the <strong>VERIFIED</strong> content here. This will update the questions AND mark them as verified.
                  </p>
                  <textarea
                    value={reviewQueueInputText}
                    onChange={(e) => setReviewQueueInputText(e.target.value)}
                    placeholder={`Paste verified ${reviewQueueType.toUpperCase()} here...`}
                    style={{
                      width: '100%',
                      flex: 1,
                      minHeight: '200px',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid #d6eaf8',
                      fontFamily: 'monospace',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              {/* Right Side: Current Queue Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #eee', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 15px', backgroundColor: '#eee', fontWeight: 'bold', fontSize: '14px' }}>
                  Current Queue Preview
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '15px', backgroundColor: '#fafafa' }}>
                  {questions.filter(q => q.inReviewQueue && q.type === reviewQueueType).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', marginTop: '50px' }}>No queued questions of this type.</div>
                  ) : (
                    questions.filter(q => q.inReviewQueue && q.type === reviewQueueType).map((q, i) => (
                      <div key={q.id} style={{ marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px', fontSize: '12px' }}>
                        <strong>#{i+1} (ID: {q.id})</strong>
                        <div style={{ color: '#666', marginTop: '5px', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {q.questionText || q.question}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowReviewQueueModal(false)}
                style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleReviewQueueApply}
                disabled={isFixing || !reviewQueueInputText.trim()}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#3498db',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: (isFixing || !reviewQueueInputText.trim()) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px rgba(52, 152, 219, 0.2)'
                }}
              >
                {isFixing ? '⏳ Processing...' : `🚀 Apply & Verify All ${reviewQueueType.toUpperCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCQ Options Fix Modal (Merged Options) */}
      {showMCQOptionsFixModal && (
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
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#27ae60' }}>🛠 MCQ Merged Options Fixer</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={applyMCQOptionsFix}
                  disabled={isFixing || mcqOptionsFixCandidates.length === 0}
                  style={{
                    backgroundColor: '#27ae60',
                    color: 'white',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {isFixing ? 'Processing...' : `✅ Fix All ${mcqOptionsFixCandidates.length} Questions`}
                </button>
                <button 
                  onClick={() => setShowMCQOptionsFixModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}
                >✕</button>
              </div>
            </div>

            <p style={{ color: '#666', marginBottom: '20px' }}>
              Found <strong>{mcqOptionsFixCandidates.length}</strong> MCQs where options appear to be merged into the question text.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', padding: '5px' }}>
              {mcqOptionsFixCandidates.map((item, idx) => (
                <div key={item.original.id} style={{ 
                  border: '1px solid #eee', 
                  borderRadius: '10px', 
                  padding: '20px', 
                  marginBottom: '20px',
                  backgroundColor: '#fdfdfd'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>#{idx + 1} | ID: {item.original.id}</span>
                    <button 
                      onClick={() => {
                        setMcqOptionsFixCandidates(prev => prev.filter(c => c.original.id !== item.original.id));
                      }}
                      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
                    >Skip</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ padding: '15px', backgroundColor: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
                      <div style={{ fontWeight: 'bold', color: '#c53030', marginBottom: '10px', fontSize: '13px' }}>ORIGINAL</div>
                      <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{item.original.questionText || item.original.question}</div>
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                        Options: {(item.original.options || []).length}
                      </div>
                    </div>

                    <div style={{ padding: '15px', backgroundColor: '#f0fff4', borderRadius: '8px', border: '1px solid #9ae6b4' }}>
                      <div style={{ fontWeight: 'bold', color: '#2f855a', marginBottom: '10px', fontSize: '13px' }}>FIXED</div>
                      <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{item.fixed.questionText}</div>
                      <div style={{ marginTop: '15px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px' }}>EXTRACTED OPTIONS:</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                          {item.fixed.options.map((opt, i) => (
                            <div key={i} style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '4px' }}>
                              <strong>{opt.label}:</strong> {opt.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}