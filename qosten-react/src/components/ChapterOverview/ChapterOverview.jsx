import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabaseClient';
import MarkdownContent from '../MarkdownContent/MarkdownContent';
import './ChapterOverview.css';

export default function ChapterOverview() {
  const [overviews, setOverviews] = useState([]);
  const [selectedOverview, setSelectedOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchOverviews();
  }, []);

  const fetchOverviews = async (preserveSelectionId = null) => {
    try {
      setLoading(true);
      
      if (!supabase) {
        setError('Supabase is not configured');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('chapter_overviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOverviews(data || []);
      
      if (data && data.length > 0) {
        if (preserveSelectionId) {
          const preserved = data.find(o => o.id === preserveSelectionId);
          setSelectedOverview(preserved || data[0]);
        } else {
          setSelectedOverview(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching overviews:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    setEditingName(selectedOverview.name);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  const handleSaveName = async () => {
    if (!editingName.trim()) {
      alert('Name cannot be empty');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('chapter_overviews')
        .update({ name: editingName.trim() })
        .eq('id', selectedOverview.id);

      if (error) throw error;

      alert('✅ Chapter name updated successfully!');
      setIsEditingName(false);
      // Refresh list but keep the current one selected
      await fetchOverviews(selectedOverview.id);
    } catch (err) {
      console.error('Error updating name:', err);
      alert('❌ Failed to update name: ' + err.message);
    } finally {
      setSaving(false);
    }
  };


  const renderTopic = (topic, index) => {
    return (
      <div key={topic.id || index} style={{
        marginBottom: '30px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        borderLeft: '4px solid #3498db',
        overflow: 'auto',
        boxSizing: 'border-box'
      }}>
        <h3 style={{ 
          color: '#2c3e50', 
          marginTop: 0,
          marginBottom: '15px',
          fontSize: '1.3rem',
          fontWeight: '600'
        }}>
          {topic.id}: {topic.title}
        </h3>
        <MarkdownContent content={topic.content} />
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading overviews...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#e74c3c' }}>
        <p>Error loading overviews: {error}</p>
      </div>
    );
  }

  if (overviews.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No chapter overviews available yet.</p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Add overviews through the database to see them here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          fontWeight: '600', 
          marginRight: '10px',
          color: '#2c3e50'
        }}>
          Select Chapter:
        </label>
        <select
          value={selectedOverview?.id || ''}
          onChange={(e) => {
            const overview = overviews.find(o => o.id === e.target.value);
            setSelectedOverview(overview);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #ddd',
            fontSize: '1rem',
            minWidth: '300px'
          }}
        >
          {overviews.map(overview => (
            <option key={overview.id} value={overview.id}>
              {overview.name}
              {overview.subject && ` - ${overview.subject}`}
              {overview.grade_level && ` (${overview.grade_level})`}
            </option>
          ))}
        </select>
      </div>

      {selectedOverview && (
        <div>
          <div style={{ 
            marginBottom: '30px',
            paddingBottom: '20px',
            borderBottom: '2px solid #ecf0f1'
          }}>
            {isEditingName ? (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '2px solid #3498db',
                    flex: 1
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={saving}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h2 style={{ 
                  color: '#2c3e50',
                  marginTop: 0,
                  marginBottom: '10px'
                }}>
                  {selectedOverview.name}
                </h2>
                <button
                  onClick={handleStartEdit}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f1f3f5',
                    color: '#495057',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Edit Name
                </button>
              </div>
            )}
            
            {(selectedOverview.subject || selectedOverview.grade_level) && (
              <div style={{ color: '#7f8c8d', fontSize: '0.95rem' }}>
                {selectedOverview.subject && <span>{selectedOverview.subject}</span>}
                {selectedOverview.subject && selectedOverview.grade_level && <span> • </span>}
                {selectedOverview.grade_level && <span>{selectedOverview.grade_level}</span>}
              </div>
            )}
          </div>

          <div>
            {selectedOverview.overview_data?.topics?.map((topic, index) => 
              renderTopic(topic, index)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
