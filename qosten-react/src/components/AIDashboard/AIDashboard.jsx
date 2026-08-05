import React, { useState, useEffect, useCallback } from 'react';
import { aiUsageService } from '../../services/aiUsageService';
import { reportApi } from '../../services/reportApi';
import './AIDashboard.css';

export function AIDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [keys, setKeys] = useState([]);
  const [logs, setLogs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [cacheStats, setCacheStats] = useState(null);
  const [errorStats, setErrorStats] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [analysisPeriod, setAnalysisPeriod] = useState(1);
  const [conversations, setConversations] = useState([]);
  const [conversationsTotal, setConversationsTotal] = useState(0);
  const [conversationsPage, setConversationsPage] = useState(0);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionMessages, setSessionMessages] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [newKey, setNewKey] = useState({
    keyName: '',
    apiKey: '',
    provider: 'google_genai',
    model: 'gemma-4-31b-it',
    dailyLimit: 1500,
    rpmLimit: 15,
    priority: 0,
    notes: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardStats, keyStats, usageLogs, batchData, cache, errors, errorLogsData] = await Promise.all([
        aiUsageService.getDashboardStats(),
        aiUsageService.loadKeys(),
        aiUsageService.getUsageLogs(50),
        aiUsageService.getBatches(20),
        aiUsageService.getCacheStats(),
        aiUsageService.getKeyErrorStats(7),
        aiUsageService.getKeyErrors(50)
      ]);

      setStats(dashboardStats);
      setKeys(keyStats);
      setLogs(usageLogs);
      setBatches(batchData);
      setCacheStats(cache);
      setErrorStats(errors);
      setErrorLogs(errorLogsData);
    } catch (err) {
      console.error('Error loading AI dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalysis = useCallback(async (period) => {
    try {
      const data = await aiUsageService.getUsageAnalysis(period);
      setAnalysis(data);
    } catch (err) {
      console.error('Error loading analysis:', err);
    }
  }, []);

  const loadConversations = useCallback(async (reset = false) => {
    const page = reset ? 0 : conversationsPage;
    setConversationsLoading(true);
    try {
      const result = await reportApi.fetchAIChatSessions(page, 20);
      if (reset) {
        setConversations(result.sessions);
        setConversationsPage(1);
      } else {
        setConversations(prev => [...prev, ...result.sessions]);
        setConversationsPage(prev => prev + 1);
      }
      setConversationsTotal(result.total);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setConversationsLoading(false);
    }
  }, [conversationsPage]);

  const loadSessionMessages = async (session) => {
    setSelectedSession(session);
    setMessagesLoading(true);
    try {
      const messages = await reportApi.fetchAIChatMessages(session.session_id);
      setSessionMessages(messages);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const closeSessionDetail = () => {
    setSelectedSession(null);
    setSessionMessages([]);
  };

  useEffect(() => {
    loadAnalysis(analysisPeriod);
  }, [analysisPeriod, loadAnalysis]);

  useEffect(() => {
    loadData();
    const unsubscribe = aiUsageService.subscribe((updatedKeys) => {
      setKeys(updatedKeys);
    });
    return () => unsubscribe();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'conversations' && conversations.length === 0) {
      loadConversations(true);
    }
  }, [activeTab, loadConversations, conversations.length]);

  const handleToggleKey = async (id, currentStatus) => {
    await aiUsageService.updateApiKey(id, { is_active: !currentStatus });
    loadData();
  };

  const handleDeleteKey = async (id) => {
    if (window.confirm('Are you sure you want to delete this key?')) {
      await aiUsageService.deleteApiKey(id);
      loadData();
    }
  };

  const handleEditKey = (key) => {
    setEditingKey(key);
    setNewKey({
      keyName: key.key_name,
      apiKey: key.api_key || '',
      provider: key.provider,
      model: key.model,
      dailyLimit: key.daily_limit,
      rpmLimit: key.rpm_limit,
      priority: key.priority,
      notes: key.notes || ''
    });
    setShowAddKeyModal(true);
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    
    if (editingKey) {
      const updates = {
        key_name: newKey.keyName,
        provider: newKey.provider,
        model: newKey.model,
        daily_limit: newKey.dailyLimit,
        rpm_limit: newKey.rpmLimit,
        priority: newKey.priority,
        notes: newKey.notes
      };
      if (newKey.apiKey) {
        updates.api_key = newKey.apiKey;
      }
      const result = await aiUsageService.updateApiKey(editingKey.id, updates);
      if (result.success) {
        closeModal();
        loadData();
      } else {
        alert('Failed to update key: ' + result.error);
      }
    } else {
      const result = await aiUsageService.addApiKey(newKey);
      if (result.success) {
        closeModal();
        loadData();
      } else {
        alert('Failed to add key: ' + result.error);
      }
    }
  };

  const closeModal = () => {
    setShowAddKeyModal(false);
    setEditingKey(null);
    setNewKey({
      keyName: '',
      apiKey: '',
      provider: 'google_genai',
      model: 'gemma-4-31b-it',
      dailyLimit: 1500,
      rpmLimit: 15,
      priority: 0,
      notes: ''
    });
  };

  const handleResetUsage = async () => {
    if (window.confirm('Reset daily usage for all keys?')) {
      await aiUsageService.resetDailyUsage();
      loadData();
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getUsageColor = (percentage) => {
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 70) return '#f59e0b';
    return '#22c55e';
  };

  if (loading) {
    return (
      <div className="ai-dashboard loading">
        <div className="spinner"></div>
        <p>Loading AI Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="ai-dashboard">
      <header className="dashboard-header">
        <h1>AI Dashboard</h1>
        <div className="header-actions">
          <button className="btn-refresh" onClick={loadData}>
            Refresh
          </button>
          <button className="btn-reset" onClick={handleResetUsage}>
            Reset Daily Usage
          </button>
        </div>
      </header>

      <nav className="dashboard-tabs">
        {['overview', 'keys', 'errors', 'logs', 'analysis', 'batches', 'cache', 'conversations'].map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'errors' && errorStats?.byKey?.length > 0 && (
              <span className="tab-badge">{errorStats.byKey.reduce((sum, k) => sum + k.errors_in_period, 0)}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="stats-grid">
              <div className="stat-card">
                 <h3>Total API Keys</h3>
                 <div className="stat-value">{stats?.totalKeys || keys.length}</div>
                 <div className="stat-subtitle">
                   {stats?.activeKeys || keys.filter(k => k.is_active).length} active
                 </div>
               </div>
               <div className="stat-card">
                 <h3>Errors Today</h3>
                 <div className="stat-value">{stats?.todayErrors || 0}</div>
                 <div className="stat-subtitle">
                   Failed requests
                 </div>
               </div>
              <div className="stat-card">
                 <h3>Requests Today</h3>
                 <div className="stat-value">{stats?.todayRequests || 0}</div>
                 <div className="stat-subtitle">
                   {stats?.todayTokens?.toLocaleString() || 0} tokens
                 </div>
               </div>
               <div className="stat-card">
                 <h3>All-Time Requests</h3>
                 <div className="stat-value">{stats?.totalRequests?.toLocaleString() || 0}</div>
                 <div className="stat-subtitle">
                   {stats?.totalTokens?.toLocaleString() || 0} tokens
                 </div>
               </div>
              <div className="stat-card">
                <h3>Daily Limit</h3>
                <div className="stat-value">{keys.reduce((sum, k) => sum + (k.daily_limit || 1500), 0).toLocaleString()}</div>
                <div className="stat-subtitle">
                  {keys.length} keys × 1500
                </div>
              </div>
            </div>

            <div className="keys-quick-view">
              <h2>Key Status</h2>
              <div className="keys-grid">
                {keys.map(key => (
                  <div key={key.id} className={`key-card ${key.is_active ? '' : 'inactive'}`}>
                    <div className="key-header">
                      <span className="key-name">{key.key_name}</span>
                      <span className={`status-badge ${key.is_active ? 'active' : 'inactive'}`}>
                        {key.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="key-usage">
                      <div className="usage-bar">
                        <div 
                          className="usage-fill" 
                          style={{ 
                            width: `${key.usage_percentage || 0}%`,
                            backgroundColor: getUsageColor(key.usage_percentage || 0)
                          }}
                        ></div>
                      </div>
                      <span className="usage-text">
                        {key.current_usage_today || 0} / {key.daily_limit || 1500}
                        ({key.usage_percentage?.toFixed(1) || 0}%)
                      </span>
                    </div>
                    <div className="key-meta">
                       <span>RPM: {key.current_rpm || 0}/{key.rpm_limit || 15}</span>
                       <span>Total: {key.total_requests?.toLocaleString() || 0}</span>
                     </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="limits-reminder">
              <h3>Google Gen AI Limits</h3>
              <ul>
                <li><strong>15 RPM</strong> - Requests per minute per key</li>
                <li><strong>1,500 RPD</strong> - Requests per day per key</li>
                <li><strong>Unlimited tokens</strong> - For Gemma models</li>
                <li><strong>All users are Premium</strong> - Unlimited AI access for now</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="keys-tab">
            <div className="tab-header">
              <h2>API Keys Management</h2>
              <button className="btn-add" onClick={() => setShowAddKeyModal(true)}>
                + Add New Key
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Usage Today</th>
                  <th>Remaining</th>
                  <th>RPM</th>
                  <th>Total</th>
                  <th>Errors</th>
                  <th>Last Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(key => (
                  <tr key={key.id} className={!key.is_active ? 'inactive-row' : ''}>
                    <td><strong>{key.key_name}</strong></td>
                    <td>{key.provider}</td>
                    <td><code>{key.model}</code></td>
                    <td>
                      <span className={`status-badge ${key.is_active ? 'active' : 'inactive'}`}>
                        {key.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="usage-cell">
                        <div className="mini-bar">
                          <div 
                            className="mini-fill" 
                            style={{ 
                              width: `${key.usage_percentage || 0}%`,
                              backgroundColor: getUsageColor(key.usage_percentage || 0)
                            }}
                          ></div>
                        </div>
                        {key.current_usage_today || 0}/{key.daily_limit || 1500}
                      </div>
                    </td>
                    <td>{key.remaining_today || 0}</td>
                     <td>{key.current_rpm || 0}/{key.rpm_limit || 15}</td>
                     <td>{key.total_requests?.toLocaleString() || 0}</td>
                    <td>
                      <span className={key.error_count > 0 ? 'error-count' : ''}>
                        {key.error_count || 0}
                      </span>
                      {key.last_error_type && (
                        <span className="error-type" title={key.last_error_at}>
                          {key.last_error_type}
                        </span>
                      )}
                    </td>
                    <td className="time-cell">{formatTime(key.last_used_at)}</td>
                    <td>
                       <div className="action-buttons">
                         <button 
                           className="btn-edit"
                           onClick={() => handleEditKey(key)}
                         >
                           Edit
                         </button>
                         <button 
                           className="btn-toggle"
                           onClick={() => handleToggleKey(key.id, key.is_active)}
                         >
                           {key.is_active ? 'Disable' : 'Enable'}
                         </button>
                         <button 
                           className="btn-delete"
                           onClick={() => handleDeleteKey(key.id)}
                         >
                           Delete
                         </button>
                       </div>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'errors' && (
          <div className="errors-tab">
            <h2>API Key Errors (Last 7 Days)</h2>
            
            {errorStats && (
              <div className="error-stats">
                <div className="stats-grid">
                  <div className="stat-card error">
                    <h3>Keys with Errors</h3>
                    <div className="stat-value">{errorStats.byKey?.filter(k => k.errors_in_period > 0).length || 0}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Total Errors</h3>
                    <div className="stat-value">{errorStats.byKey?.reduce((sum, k) => sum + k.errors_in_period, 0) || 0}</div>
                  </div>
                </div>

                {errorStats.byType?.length > 0 && (
                  <div className="error-breakdown">
                    <h3>Errors by Type</h3>
                    <div className="error-types">
                      {errorStats.byType.map(et => (
                        <div key={et.error_type} className="error-type-item">
                          <span className="error-type-name">{et.error_type}</span>
                          <span className="error-type-count">{et.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {errorStats.byKey?.filter(k => k.errors_in_period > 0).length > 0 && (
                  <div className="key-errors">
                    <h3>Keys with Most Errors</h3>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Key Name</th>
                          <th>Errors (7 days)</th>
                          <th>Total Errors</th>
                          <th>Last Error</th>
                          <th>Last Error Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errorStats.byKey
                          ?.filter(k => k.errors_in_period > 0)
                          .sort((a, b) => b.errors_in_period - a.errors_in_period)
                          .map(key => (
                            <tr key={key.id}>
                              <td><strong>{key.key_name}</strong></td>
                              <td className="error-count">{key.errors_in_period}</td>
                              <td>{key.error_count || 0}</td>
                              <td className="time-cell">{formatTime(key.last_error_at)}</td>
                              <td><code>{key.last_error_type || '-'}</code></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <h3>Recent Error Logs</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Key</th>
                  <th>Error Type</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Request</th>
                  <th>Retry</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.map(err => (
                  <tr key={err.id}>
                    <td className="time-cell">{formatTime(err.created_at)}</td>
                    <td>{err.key_name || err.api_key_id?.substring(0, 8) || '-'}</td>
                    <td><code className="error-type">{err.error_type}</code></td>
                    <td>{err.http_status || '-'}</td>
                    <td className="error-message">{err.error_message || '-'}</td>
                    <td>{err.request_type || '-'}</td>
                    <td>{err.retry_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="logs-tab">
            <h2>Usage Logs</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Key</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th>Tokens</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Question</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="time-cell">{formatTime(log.created_at)}</td>
                    <td>{log.api_key_id?.substring(0, 8) || '-'}</td>
                    <td><code>{log.request_type}</code></td>
                    <td>{log.model}</td>
                    <td>
                      {log.input_tokens || 0} in / {log.output_tokens || 0} out
                    </td>
                    <td>{formatDuration(log.response_time_ms)}</td>
                    <td>
                      <span className={`status-badge ${log.success ? 'success' : 'error'}`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td>{log.question_id || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="analysis-tab">
            <div className="tab-header">
              <h2>Usage Analysis</h2>
              <div className="period-filter">
                {[{ value: 1, label: '24 Hours' }, { value: 7, label: '7 Days' }, { value: 14, label: '14 Days' }, { value: 30, label: '30 Days' }].map(p => (
                  <button
                    key={p.value}
                    className={`period-btn ${analysisPeriod === p.value ? 'active' : ''}`}
                    onClick={() => setAnalysisPeriod(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {analysis ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <h3>Total Requests</h3>
                    <div className="stat-value">{analysis.summary?.totalRequests || 0}</div>
                  </div>
                  <div className="stat-card error">
                    <h3>Total Errors</h3>
                    <div className="stat-value">{analysis.summary?.totalErrors || 0}</div>
                  </div>
                  <div className="stat-card">
                    <h3>Overall Error Rate</h3>
                    <div className="stat-value">{analysis.summary?.overallErrorRate || 0}%</div>
                  </div>
                </div>

                <h3>Key Error Rates</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Key Name</th>
                      <th>Total Requests</th>
                      <th>Successful</th>
                      <th>Failed</th>
                      <th>Error Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.perKey?.map(key => (
                      <tr key={key.id}>
                        <td><strong>{key.key_name}</strong></td>
                        <td>{key.total_requests}</td>
                        <td>{key.successful}</td>
                        <td className={key.failed > 0 ? 'error-count' : ''}>{key.failed}</td>
                        <td>
                          <div className="mini-bar">
                            <div className="mini-fill" style={{ width: `${key.error_rate}%`, backgroundColor: key.error_rate > 50 ? '#ef4444' : key.error_rate > 25 ? '#f59e0b' : '#22c55e' }}></div>
                          </div>
                          <span>{key.error_rate}%</span>
                        </td>
                        <td>
                          <span className={`status-badge ${key.error_rate < 25 ? 'active' : 'inactive'}`}>
                            {key.error_rate < 25 ? 'Healthy' : key.error_rate < 50 ? 'Warning' : 'Critical'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h3>Daily Error Trend</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Total Requests</th>
                      <th>Errors</th>
                      <th>Error Rate</th>
                      <th>Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.dailyTrend?.map(day => {
                      const rate = day.total > 0 ? Math.round((day.errors / day.total) * 100) : 0;
                      return (
                        <tr key={day.day}>
                          <td>{day.day}</td>
                          <td>{day.total}</td>
                          <td className={day.errors > 0 ? 'error-count' : ''}>{day.errors}</td>
                          <td>{rate}%</td>
                          <td>
                            <div className="mini-bar">
                              <div className="mini-fill" style={{ width: `${rate}%`, backgroundColor: rate > 50 ? '#ef4444' : rate > 25 ? '#f59e0b' : '#22c55e' }}></div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <h3>Errors by Request Type</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Request Type</th>
                      <th>Total</th>
                      <th>Errors</th>
                      <th>Error Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.byRequestType?.map(type => (
                      <tr key={type.request_type}>
                        <td><code>{type.request_type}</code></td>
                        <td>{type.total}</td>
                        <td className={type.errors > 0 ? 'error-count' : ''}>{type.errors}</td>
                        <td>{type.total > 0 ? Math.round((type.errors / type.total) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>No analysis data available</p>
            )}
          </div>
        )}

        {activeTab === 'batches' && (
          <div className="batches-tab">
            <h2>Batch Processing History</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Success Rate</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id}>
                    <td className="time-cell">{formatTime(batch.created_at)}</td>
                    <td><strong>{batch.name || 'Unnamed'}</strong></td>
                    <td><code>{batch.task_type}</code></td>
                    <td>
                      <span className={`status-badge ${batch.status}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td>
                      {batch.processed_items || 0}/{batch.total_items || 0}
                    </td>
                    <td>
                      {batch.total_items > 0 
                        ? `${((batch.successful_items / batch.total_items) * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td>
                      {batch.started_at && batch.completed_at
                        ? formatDuration(new Date(batch.completed_at) - new Date(batch.started_at))
                        : batch.started_at ? 'Running...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cache' && (
          <div className="cache-tab">
            <h2>Cache Statistics</h2>
            {cacheStats ? (
              <>
                <div className="cache-summary">
                  <div className="stat-card">
                    <h3>Total Cached Items</h3>
                    <div className="stat-value">{cacheStats.totalCaches || 0}</div>
                  </div>
                </div>
                <h3>Top Cache Hits</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cache ID</th>
                      <th>Hits</th>
                      <th>Created</th>
                      <th>Last Hit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacheStats.topCaches?.map(cache => (
                      <tr key={cache.id}>
                        <td><code>{cache.id.substring(0, 8)}...</code></td>
                        <td><strong>{cache.hit_count}</strong></td>
                        <td className="time-cell">{formatTime(cache.created_at)}</td>
                        <td className="time-cell">{formatTime(cache.last_hit_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>No cache data available</p>
            )}
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="conversations-tab">
            {selectedSession ? (
              <div className="session-detail">
                <div className="session-detail-header">
                  <button className="btn-back" onClick={closeSessionDetail}>
                    ← Back to Sessions
                  </button>
                  <h3>User: {selectedSession.user_id?.slice(0, 16)}...</h3>
                  <span className="message-count">{selectedSession.message_count} requests</span>
                </div>
                <div className="messages-container">
                  {messagesLoading ? (
                    <div className="loading">Loading messages...</div>
                  ) : sessionMessages.length === 0 ? (
                    <p className="no-data">No usage logs found.</p>
                  ) : (
                    sessionMessages.map(log => (
                      <div key={log.id} className={`chat-message ${log.success ? 'success' : 'error'}`}>
                        <div className="message-role-badge">{log.success ? 'Request' : 'Failed'}</div>
                        <div className="message-content">
                          <strong>{log.request_type}</strong>
                          {log.question_id && <span className="message-question"> Q: {log.question_id}</span>}
                          {log.metadata?.prompt && (
                            <div className="message-prompt">Prompt: {log.metadata.prompt}</div>
                          )}
                          {log.metadata?.response && (
                            <div className="message-response">Response: {log.metadata.response}</div>
                          )}
                        </div>
                        <div className="message-meta">
                          <span className="message-time">{formatTime(log.created_at)}</span>
                          {log.model && <span className="message-model">{log.model}</span>}
                          {log.input_tokens != null && (
                            <span className="message-tokens">{log.input_tokens} in / {log.output_tokens || 0} out</span>
                          )}
                          {log.response_time_ms != null && (
                            <span>{log.response_time_ms}ms</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="tab-header">
                  <h2>AI Usage Sessions ({conversationsTotal})</h2>
                  <button
                    className="btn-refresh"
                    onClick={() => loadConversations(true)}
                    disabled={conversationsLoading}
                  >
                    {conversationsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                {conversations.length === 0 ? (
                  conversationsLoading ? (
                    <div className="loading">Loading sessions...</div>
                  ) : (
                    <p className="no-data">No usage data found. Try running some AI features first.</p>
                  )
                ) : (
                  <div className="conversations-list">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Requests</th>
                          <th>Last Active</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {conversations.map((session, i) => (
                          <tr key={session.session_id || i} className="clickable-row" onClick={() => loadSessionMessages(session)}>
                            <td><code>{session.user_id?.slice(0, 20)}...</code></td>
                            <td>{session.message_count}</td>
                            <td className="time-cell">{formatTime(session.last_message_at)}</td>
                            <td>
                              <button
                                className="btn-view"
                                onClick={(e) => { e.stopPropagation(); loadSessionMessages(session); }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {conversations.length < conversationsTotal && (
                      <button
                        className="btn-load-more"
                        onClick={() => loadConversations()}
                        disabled={conversationsLoading}
                        style={{ width: '100%', marginTop: 12, padding: 8, cursor: 'pointer' }}
                      >
                        {conversationsLoading ? 'Loading...' : `Load More (${conversations.length}/${conversationsTotal})`}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {showAddKeyModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingKey ? 'Edit API Key' : 'Add New API Key'}</h2>
            <form onSubmit={handleSaveKey}>
              <div className="form-group">
                <label>Key Name</label>
                <input
                  type="text"
                  value={newKey.keyName}
                  onChange={e => setNewKey({...newKey, keyName: e.target.value})}
                  placeholder="e.g., Production Key 1"
                  required
                />
              </div>
              <div className="form-group">
                <label>API Key {editingKey && '(leave blank to keep current)'}</label>
                <input
                  type="password"
                  value={newKey.apiKey}
                  onChange={e => setNewKey({...newKey, apiKey: e.target.value})}
                  placeholder={editingKey ? 'Enter new key or leave blank' : 'Enter API key'}
                  required={!editingKey}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Provider</label>
                  <select
                    value={newKey.provider}
                    onChange={e => setNewKey({...newKey, provider: e.target.value})}
                  >
                    <option value="google_genai">Google GenAI</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input
                    type="text"
                    value={newKey.model}
                    onChange={e => setNewKey({...newKey, model: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Daily Limit</label>
                  <input
                    type="number"
                    value={newKey.dailyLimit}
                    onChange={e => setNewKey({...newKey, dailyLimit: parseInt(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label>RPM Limit</label>
                  <input
                    type="number"
                    value={newKey.rpmLimit}
                    onChange={e => setNewKey({...newKey, rpmLimit: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Priority (higher = used first)</label>
                <input
                  type="number"
                  value={newKey.priority}
                  onChange={e => setNewKey({...newKey, priority: parseInt(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newKey.notes}
                  onChange={e => setNewKey({...newKey, notes: e.target.value})}
                  placeholder="Optional notes"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingKey ? 'Save Changes' : 'Add Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
