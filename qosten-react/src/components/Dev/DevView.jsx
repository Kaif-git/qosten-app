import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../../services/reportApi';
import './DevView.css';

export default function DevView() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('reports'); // 'reports', 'chats', 'users', 'flagged'
  const [reports, setReports] = useState([]);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [flagged, setFlagged] = useState({ subtopics: [], questions: [], labs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search/Filter states
  const [searchTerm, setSearchTerm] = useState(''); // Generic search for Users
  const [reportFilter, setReportFilter] = useState(''); // Specific ID filter for Reports
  const [sortConfig, setSortConfig] = useState({ key: 'days_left', direction: 'asc' });

  // Selection state
  const [selectedReportIds, setSelectedReportIds] = useState([]);

  // Interaction states
  const [replyingTo, setReplyingTo] = useState(null); // { type: 'chat'|'report', id, userId }
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingDetails, setViewingDetails] = useState(null); // { type, data }

  useEffect(() => {
    loadData();
  }, []);

  const navigateToContent = (type, data) => {
    if (type === 'subtopic') {
      const subject = data.topic?.subject || data.subject;
      const chapter = data.topic?.chapter || data.chapter;
      const topicId = data.topic_id || data.id;
      navigate(`/lessons-view?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}&topicId=${topicId}`);
    } else if (type === 'question') {
      navigate(`/bank?id=${data.id}`);
    } else if (type === 'lab_problem') {
      navigate(`/lab-view?id=${data.id}`);
    }
  };

  const loadData = async () => {
    try {
      console.log('🚀 [DevView] loadData: Starting data fetch...');
      setLoading(true);
      const [reportsData, chatsData, usersData, flaggedData] = await Promise.all([
        reportApi.fetchReports(),
        reportApi.fetchChats(),
        reportApi.fetchUsers(),
        reportApi.fetchFlaggedContent()
      ]);
      
      console.log('✅ [DevView] loadData results:', {
        reportsCount: reportsData?.length,
        chatsCount: chatsData?.length,
        usersCount: usersData?.length,
        flagged: flaggedData
      });

      const calculateDaysLeft = (u) => {
        let daysLeft = -999;
        if (u && u.account_tier === 'premium' && u.subscription_end_date) {
          const end = new Date(u.subscription_end_date);
          const now = new Date();
          const diffTime = end - now;
          daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        return daysLeft;
      };

      // Process reports/chats to include days_left in user objects
      const processedReports = (reportsData || []).map(r => ({
        ...r,
        user: r.user ? { ...r.user, days_left: calculateDaysLeft(r.user) } : null
      }));

      const processedChats = (chatsData || []).map(c => ({
        ...c,
        user: c.user ? { ...c.user, days_left: calculateDaysLeft(c.user) } : null
      }));

      // Pre-calculate days left for sorting in Users tab
      const processedUsers = (usersData || []).map(u => ({
        ...u,
        days_left: calculateDaysLeft(u)
      }));

      setReports(processedReports);
      setChats(processedChats);
      setUsers(processedUsers);
      setFlagged(flaggedData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    setIsSubmitting(true);
    try {
      if (replyingTo.type === 'chat') {
        await reportApi.sendChatReply(replyingTo.userId, replyText);
        await reportApi.sendNotification(replyingTo.userId, {
          type: 'system',
          title: '💬 New Message from Developer',
          message: replyText.substring(0, 100) + (replyText.length > 100 ? '...' : ''),
          action_url: '/(tabs)/chat'
        });
      } else {
        const reportRef = (replyingTo.id && typeof replyingTo.id === 'string') ? replyingTo.id.substring(0, 8) : 'unknown';
        const msg = `[RE: Report #${reportRef}] ${replyText}`;
        
        // 1. Send Chat Reply
        await reportApi.sendChatReply(replyingTo.userId, msg);
        
        // 2. Create Notification (Triggers Push via DB Trigger)
        await reportApi.sendNotification(replyingTo.userId, {
          type: 'report_reply',
          title: 'Support Update',
          message: `A developer has replied to your report #${reportRef}.`,
          data: { 
            screen: 'DevChat', 
            report_id: replyingTo.id,
            action: 'open_chat' 
          }
        });

        // 3. Status update removed as per request (only manual changes)
      }
      setReplyText('');
      setReplyingTo(null);
      
      // Local state update for reports status removed (stays as is)
      
      alert('Reply sent successfully!');
    } catch (err) {
      alert('Failed to send reply: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateReportStatus = async (id, status) => {
    try {
      if (status === 'resolved') {
        if (!window.confirm('Are you sure you want to resolve and DELETE this report?')) return;
        await reportApi.deleteReport(id);
        setReports(prev => prev.filter(r => r.id !== id));
      } else {
        await reportApi.updateReport(id, { status });
        setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleFlagToggle = async (type, id, currentValue, reportId) => {
    const action = currentValue ? 'unflag' : 'flag';
    if (!window.confirm(`Are you sure you want to ${action} this ${type}?`)) return;
    try {
      await reportApi.flagContent(type, id, !currentValue);
      const isNowFlagged = !currentValue;

      if (isNowFlagged && reportId) {
        await reportApi.updateReport(reportId, { status: 'open' });
      }

      // Update local reports state
      setReports(prev => prev.map(r => {
        const updated = { ...r };
        if (r.id === reportId && isNowFlagged) updated.status = 'open';
        
        if (type === 'subtopic' && r.subtopic_id === id && r.subtopic) {
          updated.subtopic = { ...r.subtopic, flagged: isNowFlagged };
        } else if (type === 'question' && r.question_id === id && r.question) {
          updated.question = { ...r.question, is_flagged: isNowFlagged };
        } else if (type === 'lab_problem' && r.lab_problem_id === id && r.lab_problem) {
          updated.lab_problem = { ...r.lab_problem, is_flagged: isNowFlagged };
        }
        return updated;
      }));

      // Update local flagged state
      setFlagged(prev => {
        const newState = { ...prev };
        if (isNowFlagged) {
          // This is tricky because we don't have the full object here to add to 'flagged' list
          // But usually we are unflagging FROM the flagged list, or flagging from reports.
          // For now, a partial refresh of flagged data might be needed or just tell user to refresh.
          // But let's at least handle the 'unflag' case which is common in the flagged tab.
          if (type === 'subtopics') newState.subtopics = prev.subtopics.filter(x => x.id !== id);
          if (type === 'questions') newState.questions = prev.questions.filter(x => x.id !== id);
          if (type === 'labs') newState.labs = prev.labs.filter(x => x.id !== id);
        } else {
           // Remove from flagged list if unflagged
           newState.subtopics = prev.subtopics.filter(x => x.id !== id);
           newState.questions = prev.questions.filter(x => x.id !== id);
           newState.labs = prev.labs.filter(x => x.id !== id);
        }
        return newState;
      });

      alert(`${type} has been ${isNowFlagged ? 'flagged' : 'unflagged'}.`);
    } catch (err) {
      alert(`Failed to ${action}: ` + err.message);
    }
  };

  const handleExtendSubscription = async (user) => {
    const daysStr = window.prompt(`Extend subscription for ${user.display_name} by how many days?`, "30");
    if (!daysStr) return;
    
    const days = parseInt(daysStr);
    if (isNaN(days)) {
      alert('Invalid number of days');
      return;
    }

    try {
      let baseDate = new Date();
      if (user.account_tier === 'premium' && user.subscription_end_date) {
        const currentEnd = new Date(user.subscription_end_date);
        if (currentEnd > baseDate) baseDate = currentEnd;
      }

      const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
      const updates = {
        account_tier: 'premium',
        subscription_end_date: newEnd.toISOString(),
        subscription_type: 'manual_extension'
      };
      
      await reportApi.updateUser(user.user_id, updates);
      
      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.user_id === user.user_id) {
          const diffTime = newEnd - new Date();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return { ...u, ...updates, days_left: daysLeft };
        }
        return u;
      }));

      alert(`Extended subscription for ${user.display_name} to ${newEnd.toLocaleDateString()}`);
    } catch (err) {
      alert('Failed to extend subscription: ' + err.message);
    }
  };

  const handleRemoveSubscription = async (user) => {
    if (!window.confirm(`Remove subscription/tier for ${user.display_name} and reset to FREE?`)) return;
    try {
      const updates = {
        account_tier: 'free',
        subscription_end_date: null,
        subscription_start_date: null,
        subscription_type: null
      };
      await reportApi.updateUser(user.user_id, updates);
      
      // Update local state
      setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, ...updates, days_left: -999 } : u));
      
      alert(`Reset ${user.display_name} to free tier.`);
    } catch (err) {
      alert('Failed to remove subscription: ' + err.message);
    }
  };

  const handleChangeTier = async (user) => {
    const tiers = ['free', 'premium', 'developer'];
    const currentIdx = tiers.indexOf(user.account_tier || 'free');
    const nextTier = tiers[(currentIdx + 1) % tiers.length];
    
    if (!window.confirm(`Change ${user.display_name}'s tier from ${user.account_tier} to ${nextTier}?`)) return;

    try {
      const updates = { account_tier: nextTier };
      let daysLeft = -999;

      if (nextTier === 'premium') {
        const oneMonth = new Date();
        oneMonth.setMonth(oneMonth.getMonth() + 1);
        updates.subscription_end_date = oneMonth.toISOString();
        updates.subscription_type = 'manual_promotion';
        
        const diffTime = oneMonth - new Date();
        daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      } else {
        updates.subscription_end_date = null;
        updates.subscription_type = null;
      }
      
      await reportApi.updateUser(user.user_id, updates);
      
      // Update local state
      setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, ...updates, days_left: daysLeft } : u));
      
      alert(`Changed ${user.display_name} to ${nextTier} tier.`);
    } catch (err) {
      alert('Failed to change tier: ' + err.message);
    }
  };

  const goToUser = (userId) => {
    setSearchTerm(userId);
    setActiveTab('users');
  };

  const goToReport = (reportId) => {
    setReportFilter(reportId);
    setActiveTab('reports');
  };

  const toggleSelectReport = (id) => {
    setSelectedReportIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (reportsToSelect) => {
    if (selectedReportIds.length === reportsToSelect.length) {
      setSelectedReportIds([]);
    } else {
      setSelectedReportIds(reportsToSelect.map(r => r.id));
    }
  };

  const handleBulkFlag = async () => {
    const selectedReports = reports.filter(r => selectedReportIds.includes(r.id));
    const targets = [];
    
    selectedReports.forEach(r => {
      if (r.subtopic_id) targets.push({ type: 'subtopic', id: r.subtopic_id, reportId: r.id });
      if (r.question_id) targets.push({ type: 'question', id: r.question_id, reportId: r.id });
      if (r.lab_problem_id) targets.push({ type: 'lab_problem', id: r.lab_problem_id, reportId: r.id });
    });

    if (targets.length === 0) {
      alert('No valid content found to flag in selected reports.');
      return;
    }

    if (!window.confirm(`Flag content for ${selectedReports.length} reports (${targets.length} items total)?`)) return;

    setIsSubmitting(true);
    try {
      await Promise.all(targets.map(t => reportApi.flagContent(t.type, t.id, true)));
      // Also update statuses of reports to 'open' if they were closed/resolved but now flagged
      await Promise.all(targets.map(t => reportApi.updateReport(t.reportId, { status: 'open' })));
      
      // Update local state
      const targetIds = new Set(targets.map(t => t.id));
      const reportIdsToOpen = new Set(targets.map(t => t.reportId));

      setReports(prev => prev.map(r => {
        let updated = { ...r };
        if (reportIdsToOpen.has(r.id)) updated.status = 'open';
        
        if (r.subtopic_id && targetIds.has(r.subtopic_id) && r.subtopic) {
          updated.subtopic = { ...r.subtopic, flagged: true };
        }
        if (r.question_id && targetIds.has(r.question_id) && r.question) {
          updated.question = { ...r.question, is_flagged: true };
        }
        if (r.lab_problem_id && targetIds.has(r.lab_problem_id) && r.lab_problem) {
          updated.lab_problem = { ...r.lab_problem, is_flagged: true };
        }
        return updated;
      }));

      alert(`Successfully flagged ${targets.length} items.`);
      setSelectedReportIds([]);
    } catch (err) {
      alert('Bulk flag failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkStatusUpdate = async (status) => {
    const isResolving = status === 'resolved';
    const confirmMsg = isResolving 
      ? `Are you sure you want to resolve and DELETE ${selectedReportIds.length} reports?`
      : `Update status to ${status} for ${selectedReportIds.length} reports?`;
      
    if (!window.confirm(confirmMsg)) return;
    
    setIsSubmitting(true);
    try {
      if (isResolving) {
        await Promise.all(selectedReportIds.map(id => reportApi.deleteReport(id)));
        const selectedSet = new Set(selectedReportIds);
        setReports(prev => prev.filter(r => !selectedSet.has(r.id)));
        alert(`Successfully resolved and deleted ${selectedReportIds.length} reports.`);
      } else {
        await Promise.all(selectedReportIds.map(id => reportApi.updateReport(id, { status })));
        const selectedSet = new Set(selectedReportIds);
        setReports(prev => prev.map(r => selectedSet.has(r.id) ? { ...r, status } : r));
        alert(`Updated ${selectedReportIds.length} reports to ${status}.`);
      }
      setSelectedReportIds([]);
    } catch (err) {
      alert('Bulk status update failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRewardPremium = async (targetReports, variant = 'en') => {
    const msgEn = "Thank You for using Edventure, we appreciate your feedback and as a Token of appreciation we have decided to extend/gift you with 2 days of Free Premium!";
    const msgBn = "Edventure ব্যবহার করার জন্য আপনাকে ধন্যবাদ, আপনার ফিডব্যাকের জন্য আমরা কৃতজ্ঞ। প্রশংসার নিদর্শন স্বরূপ আমরা আপনাকে ২ দিনের ফ্রি প্রিমিয়াম গিফট করছি!";
    const message = variant === 'bn' ? msgBn : msgEn;

    if (!window.confirm(`Reward 2 days premium to ${targetReports.length} reporters with ${variant === 'bn' ? 'Bangla' : 'English'} message?`)) return;

    setIsSubmitting(true);
    try {
      const updatedUserIds = new Set();

      for (const report of targetReports) {
        const user = report.user;
        if (!user || !user.user_id) {
          console.warn(`[DevView] No user data for report ${report.id}, skipping reward.`);
          continue;
        }

        // Calculate new end date (2 days)
        let baseDate = new Date();
        if (user.account_tier === 'premium' && user.subscription_end_date) {
          const currentEnd = new Date(user.subscription_end_date);
          if (currentEnd > baseDate) baseDate = currentEnd;
        }
        const newEnd = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);

        // Update User
        await reportApi.updateUser(user.user_id, {
          account_tier: 'premium',
          subscription_end_date: newEnd.toISOString(),
          subscription_type: 'reward_2d_gift'
        });

        // 1. Send Chat Reply
        const reportRef = (report.id && typeof report.id === 'string') ? report.id.substring(0, 8) : 'unknown';
        const fullMsg = `[RE: Report #${reportRef}] ${message}`;
        await reportApi.sendChatReply(user.user_id, fullMsg);

        // 2. Create Notification (Triggers Push via DB Trigger)
        try {
          await reportApi.sendNotification(user.user_id, {
            type: 'report_reply',
            title: variant === 'bn' ? '🎁 প্রিমিয়াম গিফট!' : '🎁 Premium Gift!',
            message: message,
            data: { 
              screen: 'DevChat', 
              report_id: report.id,
              action: 'open_chat'
            }
          });
        } catch (notifErr) {
          console.error('[DevView] Failed to send notification:', notifErr);
        }

        // 3. Status update/Delete removed (manual only)
        
        updatedUserIds.add(user.user_id);
      }
      
      // Update local state (no filtering)
      setUsers(prev => prev.map(u => updatedUserIds.has(u.user_id) ? { ...u, account_tier: 'premium' } : u));

      alert(`Successfully rewarded ${targetReports.length} reporters!`);
      setSelectedReportIds([]);
    } catch (err) {
      alert('Reward process failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const UserBadge = ({ user, userId }) => {
    const idSnippet = (userId && typeof userId === 'string') ? userId.substring(0, 8) : 'Anon';
    if (!user) return <code className="clickable-id" onClick={() => goToUser(userId)}>{idSnippet}...</code>;
    
    return (
      <div className="user-info-badge">
        <div className="user-badge-main clickable" onClick={() => goToUser(userId)} title="Click to search in Users tab">
          <span className="user-display-name">{user.display_name}</span>
          <span className="user-username">@{user.username}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span className={`tier-badge ${user.account_tier}`}>{user.account_tier}</span>
            {user.account_tier === 'premium' && (
              <span className={`days-left ${user.days_left < 3 ? 'urgent' : ''}`} style={{ fontSize: '0.75em', fontWeight: 'bold' }}>
                ({user.days_left > 0 ? `${user.days_left}d` : (user.days_left === 0 ? 'Today' : 'Expired')})
              </span>
            )}
          </div>
        </div>
        <button 
          className="open-dm-btn" 
          onClick={(e) => { e.stopPropagation(); setActiveTab('chats'); }}
          title="Open Direct Message History"
        >
          ✉️ DM
        </button>
      </div>
    );
  };

  const getRelatedReports = (type, contentId) => {
    if (!contentId || !reports) return [];
    
    const targetId = String(contentId).trim();
    return reports.filter(r => {
      // 1. Check direct ID column first
      if (type === 'subtopic' && r.subtopic_id && String(r.subtopic_id).trim() === targetId) return true;
      if (type === 'question' && r.question_id && String(r.question_id).trim() === targetId) return true;
      if (type === 'lab_problem' && r.lab_problem_id && String(r.lab_problem_id).trim() === targetId) return true;
      
      // 2. Fallback: Search in description/details if direct ID is missing
      // This helps with reports created before we added structured ID columns
      if (type === 'question' && (r.description || r.details)) {
        const text = (r.description || r.details).toLowerCase();
        // Look for "Question ID: 12345" or similar patterns
        if (text.includes(`question id: ${targetId.toLowerCase()}`) || 
            text.includes(`question_id: ${targetId.toLowerCase()}`) ||
            text.includes(`qid: ${targetId.toLowerCase()}`)) {
          return true;
        }
      }

      if (type === 'subtopic' && (r.description || r.details)) {
        const text = (r.description || r.details).toLowerCase();
        if (text.includes(`subtopic id: ${targetId.toLowerCase()}`) || 
            text.includes(`subtopic_id: ${targetId.toLowerCase()}`)) {
          return true;
        }
      }
      
      return false;
    });
  };

  const getSortedUsers = () => {
    const sortableUsers = [...users].filter(u => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      const uid = u.user_id || '';
      const dname = u.display_name || '';
      const uname = u.username || '';
      return uid.toLowerCase().includes(lowerSearch) || dname.toLowerCase().includes(lowerSearch) || uname.toLowerCase().includes(lowerSearch);
    });

    if (sortConfig.key) {
      sortableUsers.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) aVal = '';
        if (bVal === null || bVal === undefined) bVal = '';

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableUsers;
  };

  const filteredUsers = getSortedUsers();
  const filteredReports = reports.filter(r => !reportFilter || r.id.includes(reportFilter));

  const ContentDetailsModal = ({ type, data, onClose }) => {
    if (!data) return null;
    return (
      <div className="reply-overlay">
        <div className="reply-box content-details-box">
          <div className="modal-header">
            <h3>{type.toUpperCase()} Details</h3>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="details-content">
            {type === 'subtopic' && (
              <>
                <p><strong>Title:</strong> {data.title}</p>
                <p><strong>Topic:</strong> {data.topic?.title}</p>
                <div className="detail-section"><strong>Definition:</strong><p>{data.definition || 'N/A'}</p></div>
                <div className="detail-section"><strong>Explanation:</strong><p>{data.explanation || 'N/A'}</p></div>
              </>
            )}
            {type === 'question' && (
              <>
                <p><strong>Question:</strong> {data.question}</p>
                <div className="options-list">
                  <p>A: {data.option_a}</p>
                  <p>B: {data.option_b}</p>
                  <p>C: {data.option_c}</p>
                  <p>D: {data.option_d}</p>
                </div>
                <p><strong>Correct:</strong> {data.correct_answer}</p>
                <div className="detail-section"><strong>Explanation:</strong><p>{data.explanation || 'N/A'}</p></div>
              </>
            )}
            {type === 'lab_problem' && (
              <>
                <p><strong>Title:</strong> {data.title}</p>
                <p><strong>Context:</strong> {data.subject} - {data.chapter}</p>
                <div className="detail-section"><strong>Stem:</strong><p>{data.stem}</p></div>
                {data.parts && Object.keys(data.parts).length > 0 && (
                  <div className="detail-section">
                    <strong>Parts:</strong>
                    {Object.entries(data.parts).map(([k, v]) => <div key={k}><em>{k}:</em> {v}</div>)}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="reply-actions">
            <button className="confirm-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  };

  if (loading && !refreshing) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dev-view-container panel">
      <div className="header-row">
        <div className="title-area">
          <h2>Dev Dashboard</h2>
          <p className="subtitle">Monitoring system activity, reports and chats</p>
        </div>
        <div className="header-actions">
          {activeTab === 'users' && (
            <div className="search-container">
              <input 
                type="text" 
                placeholder="Search users..." 
                className="user-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && <button className="clear-search" onClick={() => setSearchTerm('')}>×</button>}
            </div>
          )}
          {activeTab === 'reports' && (
            <div className="search-container">
              <input 
                type="text" 
                placeholder="Filter by Report ID..." 
                className="user-search-input"
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value)}
              />
              {reportFilter && <button className="clear-search" onClick={() => setReportFilter('')}>×</button>}
            </div>
          )}
          <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      <div className="sub-tabs">
        <button className={`sub-tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          Reports ({reports.length})
        </button>
        <button className={`sub-tab ${activeTab === 'chats' ? 'active' : ''}`} onClick={() => setActiveTab('chats')}>
          Chats ({chats.length})
        </button>
        <button className={`sub-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          Users ({users.length})
        </button>
        <button className={`sub-tab ${activeTab === 'flagged' ? 'active' : ''}`} onClick={() => setActiveTab('flagged')}>
          🚩 Flagged ({flagged.subtopics.length + flagged.questions.length + flagged.labs.length})
        </button>
      </div>

      {error && <div className="error-message">Error: {error}</div>}

      {replyingTo && (
        <div className="reply-overlay">
          <div className="reply-box">
            <h3>Reply to {replyingTo.type === 'chat' ? 'Message' : 'Report'}</h3>
            <textarea 
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your message to the user..."
              rows={5}
            />
            <div className="reply-actions">
              <button className="confirm-btn" onClick={handleSendReply} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Reply'}
              </button>
              <button className="cancel-btn" onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {viewingDetails && (
        <ContentDetailsModal 
          type={viewingDetails.type} 
          data={viewingDetails.data} 
          onClose={() => setViewingDetails(null)} 
        />
      )}

      {activeTab === 'reports' && (
        <div className="reports-table-container">
          {filteredReports.length === 0 ? (
            <p className="no-data">No reports found.</p>
          ) : (
            <>
              <table className="reports-table">
                <thead>
                  <tr>
                    <th className="checkbox-cell">
                      <input 
                        type="checkbox" 
                        checked={selectedReportIds.length === filteredReports.length && filteredReports.length > 0}
                        onChange={() => toggleSelectAll(filteredReports)}
                      />
                    </th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>User</th>
                    <th>Reference & Actions</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th>Reply</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id} className={`report-row ${reportFilter && report.id.includes(reportFilter) ? 'highlighted-row' : ''} ${selectedReportIds.includes(report.id) ? 'selected-row' : ''}`}>
                      <td className="checkbox-cell">
                        <input 
                          type="checkbox" 
                          checked={selectedReportIds.includes(report.id)}
                          onChange={() => toggleSelectReport(report.id)}
                        />
                      </td>
                      <td className="date-cell">{new Date(report.created_at).toLocaleString()}</td>
                      <td className="type-cell">
                        <span className={`badge type-${report.report_type?.toLowerCase() || 'default'}`}>
                          {report.report_type || 'N/A'}
                        </span>
                      </td>
                      <td className="user-cell">
                        <UserBadge user={report.user} userId={report.user_id} />
                      </td>
                      <td className="reference-cell">
                        <div className="ref-and-flag">
                          {report.subtopic && (
                            <div className={`ref-item clickable ${report.subtopic.flagged ? 'flagged-content' : ''}`} onClick={() => navigateToContent('subtopic', report.subtopic)}>
                              <strong>Subtopic:</strong> {report.subtopic.title}
                              <button 
                                className={`flag-btn ${report.subtopic.flagged ? 'active' : ''}`} 
                                onClick={(e) => { e.stopPropagation(); handleFlagToggle('subtopic', report.subtopic_id, report.subtopic.flagged, report.id); }}
                              >
                                {report.subtopic.flagged ? '🏳️ Unflag' : '🚩 Flag'}
                              </button>
                            </div>
                          )}
                          {report.question && (
                            <div className={`ref-item clickable ${report.question.is_flagged ? 'flagged-content' : ''}`} onClick={() => navigateToContent('question', report.question)}>
                              <strong>Question:</strong> {report.question.question ? report.question.question.substring(0, 50) : 'No question text'}...
                              <button 
                                className={`flag-btn ${report.question.is_flagged ? 'active' : ''}`} 
                                onClick={(e) => { e.stopPropagation(); handleFlagToggle('question', report.question_id, report.question.is_flagged, report.id); }}
                              >
                                {report.question.is_flagged ? '🏳️ Unflag' : '🚩 Flag'}
                              </button>
                            </div>
                          )}
                          {report.lab_problem && (
                            <div className={`ref-item clickable ${report.lab_problem.is_flagged ? 'flagged-content' : ''}`} onClick={() => navigateToContent('lab_problem', report.lab_problem)}>
                              <strong>Lab:</strong> {report.lab_problem.title}
                              <button 
                                className={`flag-btn ${report.lab_problem.is_flagged ? 'active' : ''}`} 
                                onClick={(e) => { e.stopPropagation(); handleFlagToggle('lab_problem', report.lab_problem_id, report.lab_problem.is_flagged, report.id); }}
                              >
                                {report.lab_problem.is_flagged ? '🏳️ Unflag' : '🚩 Flag'}
                              </button>
                            </div>
                          )}
                          {!report.subtopic && !report.question && !report.lab_problem && <span className="no-ref">No direct ref</span>}
                        </div>
                      </td>
                      <td className="status-cell">
                        <select 
                          value={report.status || 'open'} 
                          className={`status-select ${report.status}`}
                          onChange={(e) => handleUpdateReportStatus(report.id, e.target.value)}
                        >
                          <option value="open">Open</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="description-cell">
                        <div className="description-text">{report.description || report.details}</div>
                      </td>
                      <td>
                        <div className="reply-actions-cell">
                          <button className="reply-icon-btn" onClick={() => setReplyingTo({ type: 'report', id: report.id, userId: report.user_id })}>💬 Reply</button>
                          <div className="reward-buttons">
                            <button className="reward-btn en" title="Reward 7D Premium (English Msg)" onClick={() => handleRewardPremium([report], 'en')}>🎁 EN</button>
                            <button className="reward-btn bn" title="Reward 7D Premium (Bangla Msg)" onClick={() => handleRewardPremium([report], 'bn')}>🎁 BN</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedReportIds.length > 0 && (
                <div className="bulk-actions-bar">
                  <div className="selection-info">
                    <strong>{selectedReportIds.length}</strong> reports selected
                  </div>
                  <div className="action-buttons">
                    <button className="bulk-btn reward" onClick={() => handleRewardPremium(reports.filter(r => selectedReportIds.includes(r.id)), 'en')} disabled={isSubmitting}>
                      🎁 Reward 7D (EN)
                    </button>
                    <button className="bulk-btn reward" onClick={() => handleRewardPremium(reports.filter(r => selectedReportIds.includes(r.id)), 'bn')} disabled={isSubmitting}>
                      🎁 Reward 7D (BN)
                    </button>
                    <button className="bulk-btn flag" onClick={handleBulkFlag} disabled={isSubmitting}>
                      🚩 Flag All
                    </button>
                    <button className="bulk-btn resolve" onClick={() => handleBulkStatusUpdate('resolved')} disabled={isSubmitting}>
                      ✓ Resolve
                    </button>
                    <button className="bulk-btn cancel" onClick={() => setSelectedReportIds([])} disabled={isSubmitting}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'chats' && (
        <div className="chats-table-container">
          {chats.length === 0 ? (
            <p className="no-data">No chats found.</p>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sender</th>
                  <th>User</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {chats.map((chat) => (
                  <tr key={chat.id} className={`report-row ${chat.sender_type === 'developer' ? 'admin-msg' : ''}`}>
                    <td className="date-cell">{new Date(chat.created_at).toLocaleString()}</td>
                    <td className="sender-cell">
                      <span className={`badge sender-${chat.sender_type?.toLowerCase() || 'default'}`}>
                        {chat.sender_type || 'User'}
                      </span>
                    </td>
                    <td className="user-cell">
                      <UserBadge user={chat.user} userId={chat.user_id} />
                    </td>
                    <td className="description-cell">
                      <div className="description-text">{chat.message}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${chat.is_read ? 'resolved' : 'pending'}`}>
                        {chat.is_read ? 'Read' : 'New'}
                      </span>
                    </td>
                    <td>
                      {chat.sender_type !== 'developer' && (
                        <button className="reply-icon-btn" onClick={() => setReplyingTo({ type: 'chat', id: chat.id, userId: chat.user_id })}>💬 Reply</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'flagged' && (
        <div className="flagged-view-container">
          <h3>Flagged Content</h3>
          
          <div className="flagged-section">
            <h4>Subtopics ({flagged.subtopics.length})</h4>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead><tr><th>Title</th><th>Context</th><th>Related Reports</th><th>Action</th></tr></thead>
                <tbody>
                  {flagged.subtopics.map(st => (
                    <tr key={st.id} className="report-row clickable" onClick={() => navigateToContent('subtopic', st)}>
                      <td>{st.title}</td>
                      <td>{st.topic?.subject} - {st.topic?.chapter}</td>
                      <td>
                        {getRelatedReports('subtopic', st.id).map(r => (
                          <div key={r.id} className="clickable-id" onClick={(e) => { e.stopPropagation(); goToReport(r.id); }}>
                            Report #{r.id.substring(0, 8)}
                          </div>
                        ))}
                      </td>
                      <td>
                        <button className="flag-btn active" onClick={(e) => { e.stopPropagation(); handleFlagToggle('subtopic', st.id, true); }}>🏳️ Unflag</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flagged-section">
            <h4>Questions ({flagged.questions.length})</h4>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead><tr><th>Question</th><th>Type</th><th>Related Reports</th><th>Action</th></tr></thead>
                <tbody>
                  {flagged.questions.map(q => (
                    <tr key={q.id} className="report-row clickable" onClick={() => navigateToContent('question', q)}>
                      <td title={q.question}>{q.question ? q.question.substring(0, 100) : 'No question text'}...</td>
                      <td>{q.type}</td>
                      <td>
                        {getRelatedReports('question', q.id).map(r => (
                          <div key={r.id} className="clickable-id" onClick={(e) => { e.stopPropagation(); goToReport(r.id); }}>
                            Report #{r.id.substring(0, 8)}
                          </div>
                        ))}
                      </td>
                      <td>
                        <button className="flag-btn active" onClick={(e) => { e.stopPropagation(); handleFlagToggle('question', q.id, true); }}>🏳️ Unflag</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flagged-section">
            <h4>Lab Problems ({flagged.labs.length})</h4>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead><tr><th>Title</th><th>Context</th><th>Related Reports</th><th>Action</th></tr></thead>
                <tbody>
                  {flagged.labs.map(l => (
                    <tr key={l.id} className="report-row clickable" onClick={() => navigateToContent('lab_problem', l)}>
                      <td>{l.title}</td>
                      <td>{l.subject} - {l.chapter}</td>
                      <td>
                        {getRelatedReports('lab_problem', l.id).map(r => (
                          <div key={r.id} className="clickable-id" onClick={(e) => { e.stopPropagation(); goToReport(r.id); }}>
                            Report #{r.id.substring(0, 8)}
                          </div>
                        ))}
                      </td>
                      <td>
                        <button className="flag-btn active" onClick={(e) => { e.stopPropagation(); handleFlagToggle('lab_problem', l.id, true); }}>🏳️ Unflag</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="users-table-container">
          {filteredUsers.length === 0 ? (
            <p className="no-data">No users found matching "{searchTerm}".</p>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => requestSort('display_name')}>User {sortConfig.key === 'display_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th>Role</th>
                  <th>School/Grade</th>
                  <th className="sortable" onClick={() => requestSort('days_left')}>Subscription {sortConfig.key === 'days_left' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="sortable" onClick={() => requestSort('last_seen_at')}>Last Seen {sortConfig.key === 'last_seen_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                  <th className="sortable" onClick={() => requestSort('created_at')}>Joined {sortConfig.key === 'created_at' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`report-row ${searchTerm === user.user_id ? 'highlighted-row' : ''}`}>
                    <td>
                      <div className="user-info-badge">
                        <span className="user-display-name">{user.display_name}</span>
                        <span className="user-username">@{user.username}</span>
                        <code style={{fontSize:'10px'}}>{user.user_id}</code>
                      </div>
                    </td>
                    <td><span className="badge">{user.user_role}</span></td>
                    <td>
                      <div className="ref-item">
                        <div>{user.school || 'No School'}</div>
                        <div className="ref-context">{user.grade_level} ({user.curriculum_version})</div>
                      </div>
                    </td>
                    <td>
                      <div className="sub-management-cell">
                        <span 
                          className={`tier-badge ${user.account_tier} clickable`} 
                          title="Click to cycle tier (Free -> Premium -> Dev)"
                          onClick={() => handleChangeTier(user)}
                        >
                          {user.account_tier}
                        </span>
                        <div className="days-row">
                          {user.account_tier === 'premium' ? (
                            <div className={`days-left ${user.days_left < 3 ? 'urgent' : ''}`}>
                              {user.days_left > 0 ? `${user.days_left}d left` : (user.days_left === 0 ? 'Today' : 'Expired')}
                            </div>
                          ) : (
                            <div className="ref-context">{user.account_tier === 'developer' ? 'Dev Access' : 'Free Tier'}</div>
                          )}
                          <div className="sub-action-btns">
                            <button 
                              className="extend-sub-btn" 
                              title="Extend/Grant Subscription"
                              onClick={() => handleExtendSubscription(user)}
                            >
                              +
                            </button>
                            {(user.account_tier !== 'free' || user.subscription_end_date) && (
                              <button 
                                className="remove-sub-btn" 
                                title="Remove Subscription/Reset to Free"
                                onClick={() => handleRemoveSubscription(user)}
                              >
                                -
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="date-cell" style={{fontSize:'11px'}}>
                      {user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="date-cell" style={{fontSize:'11px'}}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
