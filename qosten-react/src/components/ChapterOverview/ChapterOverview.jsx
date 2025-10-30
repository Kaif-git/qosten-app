import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import MarkdownContent from '../MarkdownContent/MarkdownContent';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function ChapterOverview() {
  const [overviews, setOverviews] = useState([]);
  const [selectedOverview, setSelectedOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOverviews();
  }, []);

  const fetchOverviews = async () => {
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
        setSelectedOverview(data[0]);
      }
    } catch (err) {
      console.error('Error fetching overviews:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
            <h2 style={{ 
              color: '#2c3e50',
              marginTop: 0,
              marginBottom: '10px'
            }}>
              {selectedOverview.name}
            </h2>
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
