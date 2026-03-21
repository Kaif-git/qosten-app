import React, { useState, useEffect, useCallback } from 'react';
import { videoApi } from '../../services/videoApi';

export default function VideoLinkModal({ question, onClose, onUpdate }) {
  const [videoLinks, setVideoLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New link form state
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoStart, setNewVideoStart] = useState('');
  const [newVideoEnd, setNewVideoEnd] = useState('');

  const fetchVideoLinks = useCallback(async () => {
    setLoading(true);
    try {
      const links = await videoApi.getVideoLinks(question.id);
      setVideoLinks(links || []);
    } catch (error) {
      console.error('Error fetching video links:', error);
    } finally {
      setLoading(false);
    }
  }, [question.id]);

  useEffect(() => {
    fetchVideoLinks();
  }, [fetchVideoLinks]);

  const handleAddVideo = async () => {
    if (!newVideoUrl) {
      alert('Please enter a YouTube URL');
      return;
    }

    if (!newVideoUrl.includes('youtube.com') && !newVideoUrl.includes('youtu.be')) {
      alert('Please enter a valid YouTube URL');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        question_id: question.id,
        youtube_url: newVideoUrl,
        title: newVideoTitle || null,
        start_time: parseInt(newVideoStart) || 0,
        end_time: parseInt(newVideoEnd) || null,
        question_type: question.type || 'mcq'
      };

      await videoApi.addVideoLink(payload);
      
      // Refresh links
      await fetchVideoLinks();
      
      // Reset form
      setNewVideoUrl('');
      setNewVideoTitle('');
      setNewVideoStart('');
      setNewVideoEnd('');
      
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding video link:', error);
      alert('Failed to add video link');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVideo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this video link?')) return;
    
    setSaving(true);
    try {
      await videoApi.deleteVideoLink(id);
      await fetchVideoLinks();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error deleting video link:', error);
      alert('Failed to delete video link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '25px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>📺 Video Links [ID: {question.id}]</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        {/* Form to add new link */}
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '25px',
          border: '1px solid #dee2e6'
        }}>
          <h3 style={{ marginTop: 0, fontSize: '1.1em' }}>Add New Link</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              type="text" 
              placeholder="YouTube URL (e.g., https://youtube.com/watch?v=...)" 
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <input 
              type="text" 
              placeholder="Title (Optional, e.g., 'Explanation by X')" 
              value={newVideoTitle}
              onChange={(e) => setNewVideoTitle(e.target.value)}
              style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            
            <div style={{ display: 'flex', gap: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>Start Time (seconds)</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={newVideoStart}
                  onChange={(e) => setNewVideoStart(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                  min="0"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>End Time (seconds, optional)</label>
                <input 
                  type="number" 
                  placeholder="End" 
                  value={newVideoEnd}
                  onChange={(e) => setNewVideoEnd(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                  min="0"
                />
              </div>
            </div>
            
            <button 
              onClick={handleAddVideo}
              disabled={saving || !newVideoUrl}
              style={{ 
                padding: '12px', 
                backgroundColor: '#28a745', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? 'Adding...' : 'Add Video Link'}
            </button>
          </div>
        </div>

        {/* List of existing links */}
        <div>
          <h3 style={{ fontSize: '1.1em' }}>Existing Links ({videoLinks.length})</h3>
          {loading ? (
            <p>Loading links...</p>
          ) : videoLinks.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No video links added yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {videoLinks.map((link) => (
                <div key={link.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  padding: '12px', 
                  backgroundColor: '#fff', 
                  border: '1px solid #eee',
                  borderRadius: '6px'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.title || 'Untitled Video'}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#007bff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={link.youtube_url} target="_blank" rel="noopener noreferrer">
                        {link.youtube_url}
                      </a>
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666', marginTop: '4px' }}>
                      Time: {link.start_time || 0}s {link.end_time ? `- ${link.end_time}s` : ''}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteVideo(link.id)}
                    disabled={saving}
                    style={{ 
                      padding: '6px 10px', 
                      backgroundColor: '#dc3545', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9em'
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
