import React from 'react';
import { useQuestions } from '../../context/QuestionContext';
import Statistics from '../Statistics/Statistics';
import SearchFilters from '../SearchFilters/SearchFilters';
import QuestionCard from '../QuestionCard/QuestionCard';

export default function QuestionBank() {
  const { questions, currentFilters } = useQuestions();
  
  // Filter questions based on current filters
  const filteredQuestions = questions.filter(q => {
    const matchesSearchText = !currentFilters.searchText ||
      (q.question?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.questionText?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.answer?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.explanation?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) ||
      (q.parts?.some(p => (p.text?.toLowerCase().includes(currentFilters.searchText.toLowerCase())) || (p.answer?.toLowerCase().includes(currentFilters.searchText.toLowerCase())))) ||
      q.tags?.some(tag => tag.toLowerCase().includes(currentFilters.searchText.toLowerCase()));
    const matchesSubject = !currentFilters.subject || q.subject === currentFilters.subject;
    const matchesChapter = !currentFilters.chapter || q.chapter === currentFilters.chapter;
    const matchesLesson = !currentFilters.lesson || q.lesson === currentFilters.lesson;
    const matchesType = !currentFilters.type || q.type === currentFilters.type;
    const matchesBoard = !currentFilters.board || q.board === currentFilters.board;
    const matchesQuizzable = currentFilters.isQuizzable === '' || q.isQuizzable === (currentFilters.isQuizzable === 'true');
    const matchesLanguage = !currentFilters.language || q.language === currentFilters.language;
    return matchesSearchText && matchesSubject && matchesChapter && matchesLesson && matchesType && matchesBoard && matchesQuizzable && matchesLanguage;
  });

  return (
    <div className="panel">
      <h2>Question Bank</h2>
      <Statistics questions={filteredQuestions} />
      <SearchFilters />
      
      <div className="questionsContainer">
        {filteredQuestions.length === 0 ? (
          <p>No questions found matching your criteria.</p>
        ) : (
          filteredQuestions.map(question => (
            <QuestionCard key={question.id} question={question} />
          ))
        )}
      </div>
    </div>
  );
}
