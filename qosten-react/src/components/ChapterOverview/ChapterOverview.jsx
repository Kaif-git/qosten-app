import React, { useState, useEffect } from 'react';
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
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

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
      } else {
        setSelectedOverview(null);
      }
    } catch (err) {
      console.error('Error fetching overviews:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected overview(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('chapter_overviews')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      alert(`✅ Successfully deleted ${selectedIds.length} overview(s).`);
      setSelectedIds([]);
      setIsManageMode(false);
      await fetchOverviews();
    } catch (err) {
      console.error('Error deleting overviews:', err);
      alert('❌ Failed to delete overviews: ' + err.message);
    } finally {
      setDeleting(false);
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '15px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ 
            fontWeight: '600', 
            color: '#2c3e50'
          }}>
            Select Chapter:
          </label>
          {!isManageMode && (
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
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setIsManageMode(!isManageMode);
              if (!isManageMode) setSelectedIds([]);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: isManageMode ? '#95a5a6' : '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {isManageMode ? 'Exit Manage Mode' : 'Batch Manage'}
          </button>

          {isManageMode && selectedIds.length > 0 && (
            <button
              onClick={handleBatchDelete}
              disabled={deleting}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              {deleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
            </button>
          )}
        </div>
      </div>

      {isManageMode ? (
        <div style={{ 
          backgroundColor: '#f8f9fa', 
          padding: '20px', 
          borderRadius: '8px', 
          border: '1px solid #ddd',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#2c3e50' }}>Select Overviews to Delete:</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {overviews.map(overview => (
              <label 
                key={overview.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: 'white',
                  borderRadius: '6px',
                  border: `2px solid ${selectedIds.includes(overview.id) ? '#e74c3c' : '#eee'}`,
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(overview.id)}
                  onChange={() => handleToggleSelect(overview.id)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontWeight: '500' }}>{overview.name}</span>
              </label>
            ))}
          </div>
          {overviews.length === 0 && <p>No overviews found.</p>}
        </div>
      ) : selectedOverview && (
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
