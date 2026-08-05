import React, { useState, useEffect, useMemo } from 'react';
import { trackerApi } from '../../services/trackerApi';
import './DataTracker.css';

const DataTracker = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupedUsers, setGroupedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'timeline'

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all tracker entries
      const { data: trackers, error: trackerError } = await trackerApi.getAllTrackers();
      if (trackerError) throw trackerError;

      if (!trackers || trackers.length === 0) {
        setGroupedUsers([]);
        return;
      }

      // 2. Extract unique User IDs
      const uniqueUserIds = [...new Set(trackers.map(t => t.user_id).filter(Boolean))];

      // 3. Fetch User Profiles
      const { data: profiles, error: profileError } = await trackerApi.getUsersByIds(uniqueUserIds);
      if (profileError) throw profileError;

      // 4. Create User Map for quick lookup
      const userMap = (profiles || []).reduce((acc, user) => {
        acc[user.user_id] = user;
        return acc;
      }, {});

      // 5. Group Data by User
      const grouped = {};
      
      trackers.forEach(tracker => {
        const uid = tracker.user_id || 'unknown';
        if (!grouped[uid]) {
          grouped[uid] = {
            userId: uid,
            profile: userMap[uid] || { display_name: 'Unknown User', username: 'unknown', account_tier: 'free' },
            entries: [],
            lastActive: null,
            totalDays: 0,
            allActivities: []
          };
        }
        
        grouped[uid].entries.push(tracker);
        
        // Collect all activities
        if (tracker.activity_history && Array.isArray(tracker.activity_history)) {
          tracker.activity_history.forEach(act => {
            // Apply 6-hour offset adjustment to activity time
            let adjustedTime = act.time;
            if (act.time) {
              const d = new Date(act.time);
              d.setHours(d.getHours() - 6);
              adjustedTime = d.toISOString();
            }

            grouped[uid].allActivities.push({
              ...act,
              time: adjustedTime,
              date: tracker.date // Attach parent date context
            });
          });
        }
      });

      // 6. Process aggregates
      const processedUsers = Object.values(grouped).map(user => {
        // Sort entries by date desc
        user.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Calculate meta
        user.totalDays = user.entries.length;
        user.lastActive = user.entries[0]?.date;
        
        // Aggregate totals across all entries
        user.totalAttempts = user.entries.reduce((sum, e) => sum + (e.attempts_count || 0), 0);
        user.totalCorrect = user.entries.reduce((sum, e) => sum + (e.correct_attempts || 0), 0);
        user.totalMastered = user.entries.reduce((sum, e) => sum + (e.sq_cq_mastered || 0) + (e.flashcards_mastered || 0), 0);
        user.totalSubtopicsUnderstood = user.entries.reduce((sum, e) => sum + (e.subtopics_understood || 0), 0);
        user.totalAIRequests = user.entries.reduce((sum, e) => sum + (e.ai_requests || 0), 0);
        user.totalAIConversations = user.entries.reduce((sum, e) => sum + (e.ai_conversations || 0), 0);
        user.totalAITokens = user.entries.reduce((sum, e) => sum + (e.ai_tokens_estimated || 0), 0);
        user.overallAccuracy = user.totalAttempts > 0 
          ? Math.round((user.totalCorrect / user.totalAttempts) * 100) 
          : null;
        
        // Sort all activities by time desc
        user.allActivities.sort((a, b) => new Date(b.time) - new Date(a.time));

        return user;
      });

      // Sort users by last active date desc
      processedUsers.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));

      setGroupedUsers(processedUsers);
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Users
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return groupedUsers;
    const term = searchTerm.toLowerCase();
    return groupedUsers.filter(u => 
      u.profile.display_name?.toLowerCase().includes(term) ||
      u.profile.username?.toLowerCase().includes(term) ||
      u.userId.toLowerCase().includes(term)
    );
  }, [searchTerm, groupedUsers]);

  const toggleUser = (userId) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(userId);
      setActiveTab('stats');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMetricClass = (val, max) => {
    if (!max) return 'low';
    const pct = (val / max) * 100;
    if (pct >= 80) return 'high';
    if (pct >= 50) return 'medium';
    return 'low';
  };

  // Group timeline activities by date
  const getTimelineGroups = (activities) => {
    const groups = {};
    activities.forEach(act => {
      const dateKey = new Date(act.time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(act);
    });
    return Object.entries(groups);
  };

  return (
    <div className="data-tracker-container">
      <div className="tracker-header">
        <h2>👥 User Activity Insights</h2>
        <div className="controls-section">
          <input 
            type="text" 
            placeholder="Search users..." 
            className="search-bar"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="refresh-btn" onClick={fetchData} disabled={loading}>
            {loading ? '...' : '🔄 Refresh'}
          </button>
          <button 
            className="refresh-btn refresh-agg-btn" 
            onClick={async () => {
              setLoading(true);
              await trackerApi.refreshAllAggregations();
              await fetchData();
            }} 
            disabled={loading}
            title="Re-aggregate data from user_attempts, question_mastery, flashcards_mastery, user_subtopic_understood"
          >
            {loading ? '...' : '📊 Sync Aggregates'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading user data...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">No users found.</div>
      ) : (
        <div className="user-list">
          {filteredUsers.map(user => (
            <div key={user.userId} className={`user-card ${expandedUserId === user.userId ? 'expanded' : ''}`}>
              <div className="user-row-header" onClick={() => toggleUser(user.userId)}>
                <div className="user-identity">
                  <div className="avatar-large">
                    {user.profile.display_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="user-details">
                    <h3>{user.profile.display_name}</h3>
                    <div className="user-meta">
                      <span>@{user.profile.username}</span>
                      <span className={`tier-badge ${user.profile.account_tier}`}>
                        {user.profile.account_tier}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="stat-col">
                  <span className="stat-label">Total Days</span>
                  <span className="stat-value">{user.totalDays}</span>
                </div>
                
                <div className="stat-col">
                  <span className="stat-label">Last Active</span>
                  <span className="stat-value">{formatDate(user.lastActive)}</span>
                </div>

                <div className="stat-col">
                  <span className="stat-label">Activities</span>
                  <span className="stat-value">{user.allActivities.length}</span>
                </div>

                <div className="stat-col">
                  <span className="stat-label">Attempts</span>
                  <span className="stat-value">{user.totalAttempts}</span>
                </div>

                <div className="stat-col">
                  <span className="stat-label">Accuracy</span>
                  <span className={`stat-value ${user.overallAccuracy !== null ? (user.overallAccuracy >= 80 ? 'text-green' : user.overallAccuracy >= 50 ? 'text-yellow' : 'text-red') : ''}`}>
                    {user.overallAccuracy !== null ? `${user.overallAccuracy}%` : '—'}
                  </span>
                </div>

                <div className="stat-col">
                  <span className="stat-label">Mastered</span>
                  <span className="stat-value">{user.totalMastered}</span>
                </div>

                <div className="stat-col">
                  <span className="stat-label">AI Requests</span>
                  <span className="stat-value">{user.totalAIRequests}</span>
                </div>

                <div className="stat-col">
                  <span className="stat-label">AI Conversations</span>
                  <span className="stat-value">{user.totalAIConversations}</span>
                </div>

                <div className="expand-icon">▼</div>
              </div>

              {expandedUserId === user.userId && (
                <div className="user-expanded-content">
                  <div className="content-tabs">
                    <button 
                      className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                      onClick={() => setActiveTab('stats')}
                    >
                      📅 Daily Stats
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
                      onClick={() => setActiveTab('timeline')}
                    >
                      ⏱️ Activity Timeline
                    </button>
                  </div>

                  {activeTab === 'stats' ? (
                    <table className="nested-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Topic Progress</th>
                          <th>Flashcards</th>
                          <th>Math Problems</th>
                          <th>Attempts (MCQ/SQ/CQ)</th>
                          <th>SQ/CQ Mastery</th>
                          <th>Accuracy</th>
                          <th>AI Requests</th>
                          <th>AI Tokens</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {user.entries.map(entry => (
                          <tr key={entry.id}>
                            <td>{formatDate(entry.date)}</td>
                            <td>
                              <span className={`metric-badge ${getMetricClass(entry.subtopics_learned, entry.subtopics_planned)}`}>
                                {entry.subtopics_learned} / {entry.subtopics_planned}
                              </span>
                              {entry.subtopics_understood > 0 && (
                                <span style={{color:'#10b981', fontSize:'11px', marginLeft:'4px'}}>
                                  ✓{entry.subtopics_understood}
                                </span>
                              )}
                            </td>
                            <td>
                              {entry.flashcards_reviewed} reviewed 
                              <span style={{color:'#a0aec0', fontSize:'11px', marginLeft:'4px'}}>
                                ({entry.flashcards_in_queue} q)
                              </span>
                              {entry.flashcards_mastered > 0 && (
                                <span style={{color:'#10b981', fontSize:'11px', marginLeft:'4px'}}>
                                  ★{entry.flashcards_mastered}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`metric-badge ${getMetricClass(entry.math_problems_done, entry.math_problems_planned)}`}>
                                {entry.math_problems_done} / {entry.math_problems_planned}
                              </span>
                            </td>
                            <td>
                              <span style={{fontSize:'13px'}}>
                                {entry.attempts_count || 0} total
                              </span>
                              {entry.attempts_count > 0 && (
                                <div style={{fontSize:'11px', color:'#a0aec0'}}>
                                  MCQ:{entry.mcq_attempts || 0} SQ:{entry.sq_attempts || 0} CQ:{entry.cq_attempts || 0}
                                </div>
                              )}
                            </td>
                            <td>
                              {entry.sq_cq_reviewed > 0 || entry.sq_cq_mastered > 0 ? (
                                <span style={{fontSize:'13px'}}>
                                  {entry.sq_cq_reviewed} rev / {entry.sq_cq_mastered} mastered
                                </span>
                              ) : (
                                <span style={{color:'#a0aec0', fontSize:'12px'}}>—</span>
                              )}
                            </td>
                            <td>
                              {entry.accuracy_pct != null ? (
                                <span className={`metric-badge ${entry.accuracy_pct >= 80 ? 'high' : entry.accuracy_pct >= 50 ? 'medium' : 'low'}`}>
                                  {entry.accuracy_pct}%
                                </span>
                              ) : (
                                <span style={{color:'#a0aec0', fontSize:'12px'}}>—</span>
                              )}
                            </td>
                            <td>
                              <span style={{fontSize:'13px'}}>{entry.ai_requests || 0}</span>
                            </td>
                            <td>
                              <span style={{fontSize:'13px', color:'#a0aec0'}}>
                                {entry.ai_tokens_estimated ? `${(entry.ai_tokens_estimated / 1000).toFixed(1)}k` : '—'}
                              </span>
                            </td>
                            <td>
                              {entry.daily_goals_completed ? (
                                <span style={{color:'#10b981', fontWeight:'bold'}}>✓ Complete</span>
                              ) : (
                                <span style={{color:'#f59e0b'}}>Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="timeline-container">
                      {user.allActivities.length === 0 ? (
                        <p style={{color:'#a0aec0', fontStyle:'italic'}}>No activity history recorded.</p>
                      ) : (
                        getTimelineGroups(user.allActivities).map(([date, items]) => (
                          <div key={date} className="timeline-group">
                            <div className="timeline-date">{date}</div>
                            <div className="timeline-items">
                              {items.map((act, idx) => (
                                <div key={idx} className="timeline-item">
                                  <div className="timeline-dot"></div>
                                  <div className="timeline-time">{formatTime(act.time)}</div>
                                  <div className="timeline-content">
                                    <div className="timeline-task-title">
                                      {act.task.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </div>
                                    {act.detail && (
                                      <div className="timeline-detail">
                                        {act.detail}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataTracker;
