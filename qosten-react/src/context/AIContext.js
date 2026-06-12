import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { aiService } from '../services/aiService';
import { questionApi } from '../services/questionApi';
import { useQuestions, mapDatabaseToApp } from './QuestionContext';
import { supabase } from '../services/supabaseClient';

const AIContext = createContext();

// Robust ID generator to prevent React key collisions
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.floor(Math.random() * 1000)}`;

export function AIProvider({ children }) {
  const { updateQuestion, bulkUpdateQuestions } = useQuestions();
  
  const [queue, setQueue] = useState(() => {
    const saved = localStorage.getItem('qosten_ai_queue');
    const parsed = saved ? JSON.parse(saved) : [];
    // Migration: Convert legacy numeric IDs to new unique string IDs to fix React key collisions
    return parsed.map(item => ({
      ...item, 
      id: typeof item.id === 'number' ? generateUniqueId() : item.id
    }));
  });

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('qosten_ai_history');
    const parsed = saved ? JSON.parse(saved) : [];
    // Migration for history
    return parsed.map(item => ({
      ...item,
      id: typeof item.id === 'number' ? generateUniqueId() : item.id
    }));
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [realtimeLogs, setRealtimeLogs] = useState([]); // Array of { id, type, message, timestamp }

  // Persist queue and history
  useEffect(() => {
    try {
      localStorage.setItem('qosten_ai_queue', JSON.stringify(queue));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        console.error('❌ AI Queue: Storage limit exceeded.');
      }
    }
  }, [queue]);

  useEffect(() => {
    try {
      localStorage.setItem('qosten_ai_history', JSON.stringify(history));
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        console.error('❌ AI History: Storage limit exceeded.');
      }
    }
  }, [history]);

  const addLog = useCallback((message, type = 'info', groupId = null) => {
    setRealtimeLogs(prev => [{
      id: generateUniqueId(),
      type,
      message,
      groupId,
      timestamp: new Date().toISOString()
    }, ...prev].slice(0, 150)); 
  }, []);

  const addToQueue = useCallback((question, field, task, context = '') => {
    setQueue(prev => {
      const exists = prev.find(item => 
        item.questionId === question.id && 
        item.field === field && 
        item.task === task
      );
      if (exists) return prev;

      return [...prev, {
        id: generateUniqueId(),
        questionId: question.id,
        question: question,
        field,
        task,
        context,
        status: 'queued',
        timestamp: new Date().toISOString()
      }];
    });
  }, []);

  const removeFromQueue = useCallback((taskId) => {
    setQueue(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem('qosten_ai_history');
    } catch (e) {}
  }, []);

  const processBatch = useCallback(async (taskIds) => {
    if (taskIds.length === 0 || isProcessing) return;

    setIsProcessing(true);
    addLog(`🚀 Starting massive parallel processing for ${taskIds.length} tasks...`, 'start');
    
    const tasksToProcess = queue.filter(t => taskIds.includes(t.id));
    const taskGroups = tasksToProcess.reduce((groups, task) => {
      if (!groups[task.task]) groups[task.task] = [];
      groups[task.task].push(task);
      return groups;
    }, {});

    let totalImprovedCount = 0;
    const errors = [];

    try {
      for (const [taskType, groupTasks] of Object.entries(taskGroups)) {
        addLog(`📂 Processing group: ${taskType.toUpperCase()} (${groupTasks.length} tasks)`, 'info');
        
        // 1. Fetch FRESH FULL question data for all unique questions in this group
        const uniqueIds = Array.from(new Set(groupTasks.map(t => t.questionId)));
        addLog(`📡 Fetching full data for ${uniqueIds.length} questions...`, 'info');
        
        let freshQuestions = [];
        try {
          freshQuestions = await questionApi.fetchQuestionsByIds(uniqueIds);
          console.log(`📥 [AIContext] Fetched ${freshQuestions.length} full question objects for processing.`);
        } catch (fetchErr) {
          console.error('❌ [AIContext] Failed to fetch fresh questions:', fetchErr);
          addLog(`❌ Failed to fetch fresh data for batch. Aborting group.`, 'error');
          continue;
        }

        const uniqueQuestionsMap = new Map();
        freshQuestions.forEach(q => {
          // Use official mapper to ensure camelCase and consistent structure
          const mappedQ = mapDatabaseToApp(q);
          uniqueQuestionsMap.set(q.id.toString(), mappedQ);
        });

        const limits = { mcq: 1, cq: 1, sq: 1 };
        const chunks = [];
        
        // 2. SURGICAL PAYLOAD PREPARATION
        const surgicalQuestionsMap = new Map();
        uniqueQuestionsMap.forEach((q, qId) => {
          const tasksForThisQ = groupTasks.filter(t => t.questionId.toString() === qId.toString());
          const surgicalQ = { id: q.id, type: q.type };
          
          tasksForThisQ.forEach(t => {
            if (t.field === 'questionText' || t.field === 'question') {
              surgicalQ.questionText = q.questionText || q.question || q.question_text || '';
            } else if (t.field === 'explanation') {
              surgicalQ.explanation = q.explanation;
            } else if (t.field === 'answer') {
              surgicalQ.answer = q.answer;
            } else if (t.field.startsWith('option_')) {
              const idx = parseInt(t.field.split('_')[1]);
              if (!surgicalQ.options) surgicalQ.options = [];
              const opts = q.options || q.mcq_options;
              if (opts && opts[idx]) surgicalQ.options.push(opts[idx]);
            } else if (t.field.startsWith('part_')) {
              const parts = t.field.split('_');
              const letter = parts[1];
              const subField = parts[2];
              
              if (!surgicalQ.parts) surgicalQ.parts = [];
              const qParts = q.parts || q.cq_parts;
              
              if (!Array.isArray(qParts)) {
                console.warn(`⚠️ [AIContext] qParts is not an array for Q#${qId}. Type: ${typeof qParts}. Value:`, qParts);
                return;
              }

              const originalPart = qParts.find(p => p.letter === letter);
              if (originalPart) {
                let surgicalPart = surgicalQ.parts.find(p => p.letter === letter);
                if (!surgicalPart) {
                  surgicalPart = { letter: originalPart.letter };
                  surgicalQ.parts.push(surgicalPart);
                }
                if (subField === 'text') surgicalPart.text = originalPart.text;
                if (subField === 'answer') surgicalPart.answer = originalPart.answer;
              }
            }
          });
          surgicalQuestionsMap.set(qId, surgicalQ);
        });

        const questionsByType = { mcq: [], cq: [], sq: [] };
        surgicalQuestionsMap.forEach(sq => {
          const type = (sq.type || 'mcq').toLowerCase();
          if (questionsByType[type]) questionsByType[type].push(sq);
          else questionsByType.mcq.push(sq);
        });

        Object.keys(questionsByType).forEach(type => {
          const qs = questionsByType[type];
          for (let i = 0; i < qs.length; i += limits[type]) {
            chunks.push({ type, data: qs.slice(i, i + limits[type]) });
          }
        });

        addLog(`🧩 Group split into ${chunks.length} optimized surgical tasks.`, 'info');
        
        const packPromises = chunks.map(async (chunk, packIdx) => {
          const packId = `pack-${Date.now()}-${packIdx}`;
          addLog(`📡 Launching Parallel Pack ${packIdx+1}...`, 'process', packId);
          
          let packFullResponse = "";

          try {
            await aiService.improveQuestions(
              chunk.data, 
              taskType, 
              'ONLY fix the fields provided in the input objects. Do NOT add new fields. Maintain the exact same JSON structure.', 
              (delta) => {
                packFullResponse += delta;
                if (delta.trim().length > 0) addLog(delta, 'ai-stream', packId);
              },
              (status) => {
                const type = status.includes('❌') || status.includes('🚨') ? 'error' : (status.includes('🔄') ? 'warning' : 'info');
                addLog(`[Pack ${packIdx+1}] ${status}`, type, packId);
              },
              async (incrementalResult) => {
                const qId = incrementalResult.id.toString();
                // CRITICAL: Find original FULL object, not the surgical one
                const originalQ = uniqueQuestionsMap.get(qId) || chunk.data.find(q => q.id.toString() === qId);
                
                if (taskType === 'fact_check') {
                  setQueue(prev => prev.map(t => {
                    if (t.questionId.toString() === qId && t.task === 'fact_check') {
                      addLog(`🎯 Fact check complete for Q#${qId}`, 'info', packId);
                      return { 
                        ...t, 
                        status: 'needs_review', 
                        suggestedFix: incrementalResult,
                        factCheckSummary: incrementalResult.factCheckSummary,
                        isFactuallyCorrect: incrementalResult.isFactuallyCorrect
                      };
                    }
                    return t;
                  }));
                } else {
                  try {
                    // LATEX VERIFICATION on the returned fix
                    const checkFields = [
                      incrementalResult.questionText,
                      incrementalResult.explanation,
                      incrementalResult.answer,
                      ...(incrementalResult.options || []).map(o => o.text),
                      ...(incrementalResult.parts || []).map(p => p.text + p.answer)
                    ].filter(Boolean);

                    const hasLatexIssue = checkFields.some(f => aiService.validateLatex(f));

                    if (hasLatexIssue) {
                      addLog(`🟡 Q#${qId} fix has potential LaTeX issues. Review required.`, 'warning', packId);
                      setQueue(prev => prev.map(t => {
                        if (t.questionId.toString() === qId && t.task === taskType) {
                          return { 
                            ...t, 
                            status: 'needs_review', 
                            suggestedFix: { 
                              ...(originalQ || {}), 
                              ...incrementalResult, 
                              id: Number(qId) 
                            }
                          };
                        }
                        return t;
                      }));
                      return;
                    }

                    addLog(`💾 Saving improvements for Q#${qId}...`, 'info', packId);
                    
                    // SURGICAL MERGE: Combine fixed fields back into the full original object
                    // This prevents nullifying fields that weren't sent to AI
                    const updatedObj = { ...(originalQ || {}), id: Number(qId) };
                    
                    console.log(`🧩 [AIContext] Starting surgical merge for Q#${qId}`);
                    console.log(`   - Original fields:`, Object.keys(originalQ));
                    console.log(`   - AI Result fields:`, Object.keys(incrementalResult));

                    // 1. Identify which fields were actually in the surgical payload
                    const surgicalPayload = surgicalQuestionsMap.get(qId);
                    const requestedFields = Object.keys(surgicalPayload);

                    // 2. Surgical Merge: only overwrite if AI provided value AND we requested it
                    // OR if the AI provided a non-empty string for a field that should be there.
                    const mergeField = (aiKey, appKey) => {
                      if (incrementalResult[aiKey] !== undefined) {
                        const isRequested = requestedFields.includes(aiKey) || requestedFields.includes(appKey);
                        // Protection: don't overwrite with empty string unless it was a requested fix
                        if (incrementalResult[aiKey] !== '' || isRequested) {
                          console.log(`   - Merging ${appKey} (from AI "${aiKey}")`);
                          updatedObj[appKey] = incrementalResult[aiKey];
                          return true;
                        }
                      }
                      return false;
                    };

                    const stemChanged = mergeField('questionText', 'questionText') || 
                                       mergeField('question', 'questionText') ||
                                       mergeField('stem', 'questionText');
                    
                    if (stemChanged) {
                      updatedObj.question = updatedObj.questionText;
                      if (updatedObj.type === 'cq') updatedObj.stem = updatedObj.questionText;
                    }

                    mergeField('explanation', 'explanation');
                    mergeField('answer', 'answer');
                    
                    if (incrementalResult.options && Array.isArray(incrementalResult.options)) {
                      console.log(`   - Merging ${incrementalResult.options.length} options`);
                      updatedObj.options = originalQ.options.map(opt => {
                        const fixedOpt = incrementalResult.options.find(fo => fo.label === opt.label);
                        return fixedOpt ? { ...opt, ...fixedOpt } : opt;
                      });
                    }
                    
                    if (incrementalResult.parts && Array.isArray(incrementalResult.parts)) {
                      console.log(`   - Merging ${incrementalResult.parts.length} parts`);
                      updatedObj.parts = originalQ.parts.map(p => {
                        const fixedPart = incrementalResult.parts.find(fp => fp.letter === p.letter);
                        return fixedPart ? { ...p, ...fixedPart } : p;
                      });
                    }

                    console.log(`✅ [AIContext] Surgical merge complete for Q#${qId}. Final object:`, updatedObj);

                    const savedQ = await updateQuestion(updatedObj);
                    
                    if (savedQ) {
                      addLog(`✨ Q#${qId} saved successfully!`, 'success', packId);
                      totalImprovedCount++;
                      
                      const newHistoryEntry = {
                        id: Date.now() + Math.random(),
                        timestamp: new Date().toISOString(),
                        task: taskType,
                        questionId: qId,
                        before: uniqueQuestionsMap.get(qId) || originalQ,
                        after: savedQ
                      };
                      setHistory(prev => [newHistoryEntry, ...prev].slice(0, 100));
                      setQueue(prev => prev.filter(t => !(t.task === taskType && t.questionId.toString() === qId)));
                    }
                  } catch (updateErr) {
                    console.error(`❌ Save failed for Q#${qId}:`, updateErr);
                    addLog(`❌ Failed to save Q#${qId}: ${updateErr.message}`, 'error', packId);
                  }
                }
              },
              packIdx
            );
          } catch (chunkErr) {
            addLog(`❌ Pack ${packIdx+1} failed: ${chunkErr.message}`, 'error', packId);
            errors.push(`${taskType} Pack ${packIdx+1}: ${chunkErr.message}`);
          }
        });

        await Promise.all(packPromises);
        addLog(`✅ All parallel tasks for ${taskType.toUpperCase()} completed.`, 'success');
      }

      addLog(`🏁 Batch complete! Total improved: ${totalImprovedCount}`, 'finish');
      return { 
        success: errors.length === 0, 
        count: totalImprovedCount,
        errors: errors.length > 0 ? errors : null
      };

    } catch (error) {
      console.error('❌ AI Global batch processing failed:', error);
      addLog(`🚨 Critical Error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    } finally {
      setIsProcessing(false);
    }
  }, [queue, isProcessing, updateQuestion, addLog]);

  const handleApproveFix = useCallback(async (taskId) => {
    const task = queue.find(t => t.id === taskId);
    if (!task || !task.suggestedFix) return;

    try {
      await updateQuestion(task.suggestedFix);
      
      const newHistoryEntry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        task: `${task.task} (Approved)`,
        questionId: task.questionId,
        before: task.question,
        after: task.suggestedFix
      };
      setHistory(prev => [newHistoryEntry, ...prev].slice(0, 50));
      setQueue(prev => prev.filter(t => t.id !== taskId));
      addLog(`✅ Approved AI fix for Q#${task.questionId}`, 'success');
      return true;
    } catch (err) {
      console.error('❌ Error approving AI fix:', err);
      addLog(`❌ Failed to approve fix for Q#${task.questionId}`, 'error');
      return false;
    }
  }, [queue, updateQuestion, addLog]);

  const value = {
    queue,
    history,
    isProcessing,
    realtimeLogs,
    addToQueue,
    removeFromQueue,
    clearQueue,
    clearHistory,
    processBatch,
    handleApproveFix,
    addLog
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) throw new Error('useAI must be used within an AIProvider');
  return context;
}
