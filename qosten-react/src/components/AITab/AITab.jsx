import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAI } from '../../context/AIContext';
import { useQuestions } from '../../context/QuestionContext';
import { aiService } from '../../services/aiService';
import FullQuestionContent from '../FullQuestionContent/FullQuestionContent';
import './AITab.css';

export default function AITab() {
  const navigate = useNavigate();
  const { 
    queue, 
    history, 
    isProcessing, 
    realtimeLogs, 
    processBatch, 
    removeFromQueue, 
    clearQueue, 
    clearHistory,
    handleApproveFix,
    addToQueue 
  } = useAI();
  const { deleteQuestion } = useQuestions();
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [expandedHistory, setExpandedHistory] = useState(new Set());
  const [selectedHistory, setSelectedHistory] = useState(new Set());
  const [lastHistoryIdx, setLastHistoryIdx] = useState(null);
  const [latexIssues, setLatexIssues] = useState(new Set());
  const logEndRef = useRef(null);
  const chatWindowRef = useRef(null);

  // Smart Auto-scroll for logs
  useEffect(() => {
    if (!chatWindowRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatWindowRef.current;
    // If user is within 150px of the bottom, allow auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    
    if (isNearBottom) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realtimeLogs]);

  const toggleTask = (id) => {
    const next = new Set(selectedTasks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTasks(next);
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === queue.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(queue.map(t => t.id)));
    }
  };

  const handleProcessSelected = async () => {
    const ids = Array.from(selectedTasks);
    if (ids.length === 0) return;
    const result = await processBatch(ids);
    if (result?.success) setSelectedTasks(new Set());
  };

  const toggleHistory = (id) => {
    const next = new Set(expandedHistory);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedHistory(next);
  };

  const handleHistorySelect = (e, entry, index) => {
    e.stopPropagation();
    const newSelected = new Set(selectedHistory);
    
    if (e.shiftKey && lastHistoryIdx !== null) {
      const start = Math.min(lastHistoryIdx, index);
      const end = Math.max(lastHistoryIdx, index);
      for (let i = start; i <= end; i++) {
        newSelected.add(history[i].id);
      }
    } else {
      if (newSelected.has(entry.id)) {
        newSelected.delete(entry.id);
      } else {
        newSelected.add(entry.id);
      }
      setLastHistoryIdx(index);
    }
    setSelectedHistory(newSelected);
  };

  const toggleSelectAllHistory = () => {
    if (selectedHistory.size === history.length) {
      setSelectedHistory(new Set());
    } else {
      setSelectedHistory(new Set(history.map(h => h.id)));
    }
  };

  const handleQueueSelectedHistory = () => {
    const selectedEntries = history.filter(h => selectedHistory.has(h.id));
    selectedEntries.forEach(entry => {
      if (typeof entry.after === 'object') {
        addToQueue(entry.after, 'questionText', entry.task);
      }
    });
    setSelectedHistory(new Set());
    alert(`Queued ${selectedEntries.length} questions again.`);
  };

  const handleCheckHistoryLatex = () => {
    console.log("🔍 [AITab] Starting LaTeX audit on history entries...");
    const issues = new Set();
    
    history.forEach(entry => {
      const q = entry.after;
      if (!q) return;

      const checkFields = [
        { name: 'questionText', value: q.questionText || q.question || q.stem },
        { name: 'explanation', value: q.explanation },
        { name: 'answer', value: q.answer },
        ...(q.options || []).map((o, i) => ({ name: `option_${i}`, value: o.text })),
        ...(q.parts || []).map(p => ([
          { name: `part_${p.letter}_text`, value: p.text },
          { name: `part_${p.letter}_answer`, value: p.answer }
        ])).flat()
      ].filter(f => f.value);

      let questionHasIssue = false;
      checkFields.forEach(f => {
        const hasIssue = aiService.validateLatex(f.value);
        if (hasIssue) {
          console.log(`⚠️ [LaTeX Audit] Q#${entry.questionId} - Issue found in field [${f.name}]:`);
          console.log(`   - Text: "${f.value}"`);
          questionHasIssue = true;
        }
      });

      if (questionHasIssue) {
        issues.add(entry.id);
      }
    });

    setLatexIssues(issues);
    if (issues.size > 0) {
      alert(`Found ${issues.size} items with potential LaTeX issues. Check console for details.`);
    } else {
      alert('No LaTeX issues found in recent history.');
    }
  };

  // Chatbot Aggregation: Combine ai-stream logs into coherent messages, grouped by groupId
  const renderChatLogs = () => {
    const elements = [];
    const chronologicalLogs = [...realtimeLogs].reverse();
    
    // Group all stream messages by their groupId
    const streamGroups = chronologicalLogs.reduce((acc, log) => {
      if (log.type === 'ai-stream' && log.groupId) {
        if (!acc[log.groupId]) acc[log.groupId] = "";
        acc[log.groupId] += log.message;
      }
      return acc;
    }, {});

    const renderedGroups = new Set();

    chronologicalLogs.forEach((log) => {
      if (log.type === 'debug') return;

      if (log.type === 'ai-stream') {
        if (log.groupId && !renderedGroups.has(log.groupId)) {
          // Render the ENTIRE group bubble at the first occurrence of any log from this group
          elements.push(
            <div key={`chat-${log.groupId}`} className="chat-msg ai">
              <div className="chat-avatar">🤖</div>
              <div className="chat-bubble">
                <div style={{ fontSize: '10px', color: '#6f42c1', marginBottom: '4px', fontWeight: 'bold' }}>
                  {log.groupId.split('-').pop().toUpperCase()} Stream
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '13px', fontFamily: 'monospace' }}>
                  {streamGroups[log.groupId]}
                </pre>
              </div>
            </div>
          );
          renderedGroups.add(log.groupId);
        }
      } else {
        elements.push(
          <div key={`msg-${log.id}`} className={`chat-status ${log.type}`}>
            <span className="status-dot"></span>
            {log.message}
          </div>
        );
      }
    });

    return elements;
  };

  return (
    <div className="ai-tab">
      <div className="ai-tab-header">
        <h2>🤖 AI Hub</h2>
        <p>Real-time processing and fact verification center.</p>
      </div>

      <div className="ai-tab-content">
        <div className="ai-main-column">
          {/* Queue Section */}
          <div className="ai-section queue">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={queue.length > 0 && selectedTasks.size === queue.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                />
                <h3>Pending Queue ({queue.length})</h3>
              </div>
              <div className="header-actions">
                <button className="secondary" onClick={clearQueue} disabled={queue.length === 0 || isProcessing}>Clear</button>
                <button className="primary" onClick={handleProcessSelected} disabled={selectedTasks.size === 0 || isProcessing}>
                  {isProcessing ? '🤖 Processing...' : `Improve Selected (${selectedTasks.size})`}
                </button>
              </div>
            </div>

            <div className="queue-list">
              {queue.length === 0 ? (
                <div className="empty-state">No pending tasks. Add questions from the Learn Centre.</div>
              ) : (
                queue.map(task => (
                  <div key={task.id} className={`task-item ${selectedTasks.has(task.id) ? 'selected' : ''} ${task.status}`} onClick={() => toggleTask(task.id)}>
                    <div className="task-checkbox"><input type="checkbox" checked={selectedTasks.has(task.id)} readOnly /></div>
                    <div className="task-info">
                      <div className="task-main">
                        <span className={`task-badge ${task.task}`}>{task.task.toUpperCase()}</span>
                        <span className="task-id">Q#{task.questionId}</span>
                        <span className="field-badge" style={{ 
                          fontSize: '10px', 
                          background: '#eee', 
                          padding: '2px 6px', 
                          borderRadius: '10px',
                          color: '#666',
                          fontWeight: 'bold',
                          marginLeft: '5px'
                        }}>
                          {task.field.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="task-preview">
                        <div className="original-text">
                          <strong>{task.field.includes('part') ? 'Part Text' : (task.field.includes('option') ? 'Option Text' : 'Target')}:</strong> {
                            task.field === 'questionText' || task.field === 'question' 
                              ? (task.question.questionText || task.question.question)
                              : task.field === 'explanation'
                                ? task.question.explanation
                                : task.field.startsWith('option_')
                                  ? (task.question.options?.[parseInt(task.field.split('_')[1])]?.text)
                                  : task.field.startsWith('part_')
                                    ? (task.question.parts?.find(p => p.letter === task.field.split('_')[1])?.text || 'Part data missing')
                                    : 'Field data preview unavailable'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New Chatbot Style Feedback */}
          <div className="ai-section chatbot-view">
            <div className="section-header">
              <h3>💬 Live AI Feedback</h3>
              {isProcessing && <div className="typing-indicator"><span></span><span></span><span></span></div>}
            </div>
            <div className="chat-window" ref={chatWindowRef}>
              {realtimeLogs.length === 0 ? (
                <div className="chat-empty">Start processing to see AI activity...</div>
              ) : (
                <>
                  {renderChatLogs()}
                  <div ref={logEndRef} />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="ai-sidebar">
          {/* History Section - Enhanced with Side-by-Side Diffs */}
          <div className="ai-section history">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={history.length > 0 && selectedHistory.size === history.length}
                  onChange={toggleSelectAllHistory}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <h3>Recent Activity</h3>
              </div>
              <div style={{ display: 'flex', gap: '5px' }}>
                <button 
                  className="secondary" 
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={handleCheckHistoryLatex}
                  disabled={history.length === 0}
                >
                  🔍 Check LaTeX
                </button>
                <button 
                  className="secondary" 
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={handleQueueSelectedHistory}
                  disabled={selectedHistory.size === 0}
                >
                  🔄 Queue Selected ({selectedHistory.size})
                </button>
                <button 
                  className="secondary" 
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                  onClick={clearHistory}
                  disabled={history.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty-state">No activity yet.</div>
              ) : (
                history.map((entry, index) => {
                  const isExpanded = expandedHistory.has(entry.id);
                  const isSelected = selectedHistory.has(entry.id);
                  const hasLatexIssue = latexIssues.has(entry.id);
                  return (
                    <div 
                      key={entry.id} 
                      className={`history-item ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''} ${hasLatexIssue ? 'has-issue' : ''}`} 
                      onClick={() => toggleHistory(entry.id)}
                    >
                      <div className="history-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={(e) => handleHistorySelect(e, entry, index)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="history-task">{entry.task.toUpperCase()}</span>
                          {hasLatexIssue && (
                            <span className="latex-issue-badge" title="Potential LaTeX issue detected">⚠️ LaTeX Issue</span>
                          )}
                        </div>
                        <span className="history-time">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="history-title-row">
                        <div className="history-q-id">Question #{entry.questionId}</div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button 
                            className="history-action-btn queue-again"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (typeof entry.after === 'object') {
                                addToQueue(entry.after, 'questionText', entry.task);
                                alert(`Queued Q#${entry.questionId} again for ${entry.task}`);
                              }
                            }}
                          >
                            🔄 Queue Again
                          </button>
                          <button 
                            className="history-action-btn view-bank"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/bank?id=${entry.questionId}`);
                            }}
                          >
                            👁️ Bank
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="history-diff">
                          {entry.after?.factCheckSummary && (
                            <div className="fact-check-summary">
                              <strong>Fact Check Result:</strong>
                              <p className={entry.after.isFactuallyCorrect ? 'correct' : 'incorrect'}>
                                {entry.after.factCheckSummary}
                              </p>
                            </div>
                          )}
                          <div className="diff-container">
                            <div className="diff-box before">
                              <label>ORIGINAL</label>
                              <div className="diff-content">
                                {typeof entry.before === 'object' ? (
                                  <FullQuestionContent question={entry.before} />
                                ) : (
                                  entry.before
                                )}
                              </div>
                            </div>
                            <div className="diff-box after">
                              <label>IMPROVED</label>
                              <div className="diff-content">
                                {typeof entry.after === 'object' ? (
                                  <FullQuestionContent question={entry.after} />
                                ) : (
                                  entry.after
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {!isExpanded && (
                        <div className="history-peek">Click to view improvements...</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
