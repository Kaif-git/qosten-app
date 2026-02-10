import React, { useState, useEffect } from 'react';
import { lessonApi } from '../../services/lessonApi';
import './LessonsView.css';

export default function LessonsView() {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTopicId, setExpandedTopicId] = useState(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const data = await lessonApi.fetchLessons();
      setLessons(data);
    } catch (err) {
      console.error('Error loading lessons:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (id) => {
    setExpandedTopicId(expandedTopicId === id ? null : id);
  };

  if (loading) return <div className="loading">Loading lessons...</div>;
  if (error) return <div className="error-message">Error: {error}</div>;

  return (
    <div className="lessons-view-container panel">
      <div className="header-row">
        <h2>Lesson Library</h2>
        <button className="refresh-btn" onClick={loadLessons}>Refresh</button>
      </div>

      {lessons.length === 0 ? (
        <p>No lessons found. Go to the Import tab to add some!</p>
      ) : (
        <div className="lessons-list">
          {lessons.map((topic) => (
            <div key={topic.id} className={`topic-card ${expandedTopicId === topic.id ? 'expanded' : ''}`}>
              <div className="topic-header" onClick={() => toggleTopic(topic.id)}>
                <div className="topic-main-info">
                  <span className="subject-tag">{topic.subject}</span>
                  <span className="chapter-name">{topic.chapter}</span>
                  <h3 className="topic-title">{topic.title}</h3>
                </div>
                <div className="topic-meta">
                  <span>{topic.subtopics.length} Subtopics</span>
                  <span>{topic.questions.length} Questions</span>
                  <span className="expand-icon">{expandedTopicId === topic.id ? '−' : '+'}</span>
                </div>
              </div>

              {expandedTopicId === topic.id && (
                <div className="topic-content">
                  <section className="subtopics-section">
                    <h4>Study Content</h4>
                    {topic.subtopics.map((st) => (
                      <div key={st.id} className="subtopic-item">
                        <div className="subtopic-title-row">
                          <h5>{st.title}</h5>
                          <span className={`difficulty-badge ${st.difficulty?.toLowerCase()}`}>
                            {st.difficulty}
                          </span>
                        </div>
                        
                        <div className="content-grid">
                          <div className="content-block">
                            <label>Definition</label>
                            <p>{st.definition}</p>
                          </div>
                          <div className="content-block">
                            <label>Explanation</label>
                            <p>{st.explanation}</p>
                          </div>
                          {st.shortcut && (
                            <div className="content-block shortcut">
                              <label>Memory Shortcut</label>
                              <p>{st.shortcut}</p>
                            </div>
                          )}
                          {st.mistakes && (
                            <div className="content-block mistake">
                              <label>Common Mistakes</label>
                              <p>{st.mistakes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="questions-section">
                    <h4>Review Questions</h4>
                    <div className="questions-grid">
                      {topic.questions.map((q, idx) => (
                        <div key={q.id} className="lesson-question-card">
                          <div className="q-text"><strong>Q{idx + 1}:</strong> {q.question}</div>
                          <div className="a-text"><strong>A:</strong> {q.answer}</div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
