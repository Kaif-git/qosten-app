import React, { useState, useEffect } from 'react';
import { videoApi } from '../../services/videoApi';
import { useQuestions } from '../../context/QuestionContext';
import FullQuestionContent from '../FullQuestionContent/FullQuestionContent';
import VideoLinkModal from '../VideoLinkModal/VideoLinkModal';
import './VideosView.css';

const VideosView = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { fetchQuestionsByIds } = useQuestions();
  const [questionsMap, setQuestionsMap] = useState({});
  const [expandedVideoId, setExpandedVideoId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedQuestionForEdit, setSelectedQuestionForEdit] = useState(null);

  const loadVideos = async () => {
    setLoading(true);
    try {
      const videoData = await videoApi.getAllVideoLinks(500);
      setVideos(videoData);
      
      // Fetch related question data to show context (subject, chapter, etc)
      const qIds = [...new Set(videoData.map(v => v.question_id))];
      if (qIds.length > 0) {
        const questions = await fetchQuestionsByIds(qIds);
        const qMap = {};
        questions.forEach(q => {
          qMap[q.id] = q;
        });
        setQuestionsMap(qMap);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, [fetchQuestionsByIds]);

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleExpand = (videoId) => {
    setExpandedVideoId(expandedVideoId === videoId ? null : videoId);
  };

  const handleEdit = (e, video, question) => {
    e.stopPropagation();
    setSelectedQuestionForEdit(question || { id: video.question_id, type: video.question_type });
    setShowEditModal(true);
  };

  const handleDelete = async (e, videoId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this video link?')) {
      try {
        await videoApi.deleteVideoLink(videoId);
        setVideos(prev => prev.filter(v => v.id !== videoId));
      } catch (error) {
        console.error('Error deleting video:', error);
        alert('Failed to delete video link');
      }
    }
  };

  if (loading) {
    return <div className="videos-view-loading">Loading video links...</div>;
  }

  return (
    <div className="videos-view-container">
      <div className="videos-header">
        <h2>📺 Video Solutions Library</h2>
        <p>Browse all questions that have linked video solutions.</p>
      </div>

      {videos.length === 0 ? (
        <div className="no-videos">No video links found.</div>
      ) : (
        <div className="videos-list">
          {videos.map((video) => {
            const question = questionsMap[video.question_id];
            const isExpanded = expandedVideoId === video.id;

            return (
              <div 
                key={video.id} 
                className={`video-item-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(video.id)}
              >
                <div className="video-item-header">
                  <div className="header-left">
                    <span className="video-icon">📺</span>
                    <div className="video-info">
                      <h3 className="video-item-title">{video.title || 'Untitled Solution'}</h3>
                      <div className="video-item-meta">
                        {question ? (
                          <span>{question.subject} • {question.chapter} • ID: {video.question_id}</span>
                        ) : (
                          <span>ID: {video.question_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="header-right">
                    <div className="video-item-time">
                      ⏱️ {formatTime(video.start_time)} {video.end_time ? `- ${formatTime(video.end_time)}` : ''}
                    </div>
                    <div className="header-actions">
                      <button 
                        className="btn-edit" 
                        onClick={(e) => handleEdit(e, video, question)}
                        title="Manage Links"
                      >
                        ✏️ Manage
                      </button>
                      <button 
                        className="btn-delete" 
                        onClick={(e) => handleDelete(e, video.id)}
                        title="Delete Link"
                      >
                        🗑️
                      </button>
                      <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="video-item-details" onClick={(e) => e.stopPropagation()}>
                    <div className="details-grid">
                      <div className="question-content-section">
                        <h4>Question Details</h4>
                        {question ? (
                          <FullQuestionContent question={question} />
                        ) : (
                          <p>Question data not found for ID: {video.question_id}</p>
                        )}
                      </div>
                      
                      <div className="video-link-section">
                        <h4>Video Information</h4>
                        <div className="video-info-card">
                          <p><strong>URL:</strong> <a href={video.youtube_url} target="_blank" rel="noopener noreferrer">{video.youtube_url}</a></p>
                          <p><strong>Question Type:</strong> {video.question_type?.toUpperCase()}</p>
                          <p><strong>Added:</strong> {new Date(video.created_at).toLocaleString()}</p>
                          
                          <div style={{ marginTop: '15px' }}>
                            <a 
                              href={video.youtube_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn-primary-link"
                            >
                              Open in YouTube ↗
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showEditModal && selectedQuestionForEdit && (
        <VideoLinkModal
          question={selectedQuestionForEdit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedQuestionForEdit(null);
          }}
          onUpdate={loadVideos}
        />
      )}
    </div>
  );
};

export default VideosView;
