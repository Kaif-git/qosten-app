import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { aiService } from '../services/aiService';
import { aiUsageService } from '../services/aiUsageService';
import { questionApi } from '../services/questionApi';
import { useQuestions, mapDatabaseToApp } from './QuestionContext';
import { supabase } from '../services/supabaseClient';

const AIContext = createContext();

// Robust ID generator to prevent React key collisions
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.floor(Math.random() * 1000)}`;

export function AIProvider({ children }) {
  const { updateQuestion, bulkUpdateQuestions, questions } = useQuestions();
  
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

  // Auto LaTeX Processing
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [autoProcessStats, setAutoProcessStats] = useState({
    totalProcessed: 0,
    totalBatches: 0,
    status: 'idle',
    lastProcessedAt: null,
    currentSubject: ''
  });
  const [autoSubjectFilter, setAutoSubjectFilter] = useState(() => {
    const saved = localStorage.getItem('qosten_auto_subject_filter');
    return saved ? JSON.parse(saved) : [];
  });
  const [autoChapterFilter, setAutoChapterFilter] = useState(() => {
    const saved = localStorage.getItem('qosten_auto_chapter_filter');
    return saved ? JSON.parse(saved) : [];
  });
  const [autoTypeFilter, setAutoTypeFilter] = useState(() => {
    const saved = localStorage.getItem('qosten_auto_type_filter');
    return saved ? JSON.parse(saved) : [];
  });
  const autoSubjectFilterRef = useRef(autoSubjectFilter);
  const autoChapterFilterRef = useRef(autoChapterFilter);
  const autoTypeFilterRef = useRef(autoTypeFilter);

  const autoProcessControlRef = useRef(null);
  const processedIdsRef = useRef(new Set());

  useEffect(() => {
    autoSubjectFilterRef.current = autoSubjectFilter;
    localStorage.setItem('qosten_auto_subject_filter', JSON.stringify(autoSubjectFilter));
  }, [autoSubjectFilter]);

  useEffect(() => {
    autoChapterFilterRef.current = autoChapterFilter;
    localStorage.setItem('qosten_auto_chapter_filter', JSON.stringify(autoChapterFilter));
  }, [autoChapterFilter]);

  useEffect(() => {
    autoTypeFilterRef.current = autoTypeFilter;
    localStorage.setItem('qosten_auto_type_filter', JSON.stringify(autoTypeFilter));
  }, [autoTypeFilter]);

  const startAutoProcessing = useCallback(async () => {
    if (isAutoProcessing) return;
    setIsAutoProcessing(true);
    autoProcessControlRef.current = { stop: false };
    setAutoProcessStats(prev => ({ ...prev, status: 'starting' }));
    addLog('🤖 Auto LaTeX Processing started. Fetching subject hierarchy...', 'start');

    // Fetch hierarchy to get actual subject names from API
    let subjectNames = [];
    try {
      const hierarchy = await questionApi.fetchHierarchy();
      console.log('📋 [AutoLaTeX] Hierarchy fetched:', hierarchy?.length, 'subjects');
      if (hierarchy && hierarchy.length > 0) {
        // Prioritize Bangla subjects (contain 'bangla' or 'বাংলা'), then rest
        const banglaSubjects = hierarchy.filter(h =>
          /bangla|বাংলা/i.test(h.name)
        ).map(h => h.name);
        const otherSubjects = hierarchy.filter(h =>
          !/bangla|বাংলা/i.test(h.name)
        ).map(h => h.name);
        subjectNames = [...banglaSubjects, ...otherSubjects];
        console.log('📋 [AutoLaTeX] Subject order:', subjectNames);
      } else {
        // Fallback: just use all subjects from questions
        const response = await questionApi.fetchQuestions({ limit: 1, page: 0 });
        const sample = Array.isArray(response) ? response : (response.data || []);
        if (sample.length > 0) {
          const mapped = sample.map(mapDatabaseToApp);
          const subjects = [...new Set(mapped.map(q => q.subject).filter(Boolean))];
          subjectNames = subjects.sort();
        }
      }
    } catch (err) {
      console.warn('⚠️ [AutoLaTeX] Failed to fetch hierarchy:', err);
    }

    if (subjectNames.length === 0) {
      addLog('❌ Could not load subject list. Check API connection.', 'error');
      setIsAutoProcessing(false);
      autoProcessControlRef.current = null;
      return;
    }

    addLog(`📚 Loaded ${subjectNames.length} subjects. Bangla subjects prioritized.`, 'info');

    const fetchLatexQuestions = async (count = 10) => {
      const found = [];
      console.log(`📊 [AutoLaTeX] Scanning ${questions?.length || 0} loaded questions for LaTeX issues...`);

      if (!questions || questions.length === 0) {
        console.warn('⚠️ [AutoLaTeX] No questions loaded in context. User must load questions first.');
        return found;
      }

      // Build subject priority map from hierarchy
      const subjectPriority = new Map();
      subjectNames.forEach((name, idx) => subjectPriority.set(name.toLowerCase(), idx));

      // Filter questions with LaTeX issues, sorted by subject priority
      const candidates = questions.filter(q => {
        const qId = q.id?.toString();
        if (!qId || processedIdsRef.current.has(qId)) return false;
        if (!aiService.hasLatexIssues(q)) return false;
        
        // Subject Filter
        const sFilter = autoSubjectFilterRef.current;
        if (sFilter.length > 0 && !sFilter.some(s => q.subject?.toLowerCase() === s.toLowerCase())) return false;
        
        // Chapter Filter
        const cFilter = autoChapterFilterRef.current;
        if (cFilter.length > 0 && !cFilter.some(c => q.chapter?.toLowerCase() === c.toLowerCase())) return false;
        
        // Type Filter
        const tFilter = autoTypeFilterRef.current;
        if (tFilter.length > 0 && !tFilter.some(t => q.type?.toLowerCase() === t.toLowerCase())) return false;
        
        return true;
      });

      console.log(`🔍 [AutoLaTeX] ${candidates.length} unprocessed questions have LaTeX issues.`);

      // Sort: Bangla subjects first (by hierarchy order), then rest
      candidates.sort((a, b) => {
        const pa = subjectPriority.get(a.subject?.toLowerCase()) ?? 999;
        const pb = subjectPriority.get(b.subject?.toLowerCase()) ?? 999;
        return pa - pb;
      });

      for (const q of candidates) {
        if (found.length >= count || autoProcessControlRef.current?.stop) break;
        const qId = q.id.toString();
        found.push(q);
        processedIdsRef.current.add(qId);
        setAutoProcessStats(prev => ({ ...prev, currentSubject: q.subject }));
        console.log(`✅ [AutoLaTeX] Queued Q#${qId} (${q.subject})`);
      }

      console.log(`📊 [AutoLaTeX] fetchLatexQuestions: found ${found.length} questions.`);
      return found;
    };

    try {
      console.log('🚀 [AutoLaTeX] Entering main processing loop...');
      while (!autoProcessControlRef.current?.stop) {
        setAutoProcessStats(prev => ({ ...prev, status: 'fetching' }));
        addLog('🔍 Fetching questions with LaTeX issues...', 'info');
        console.log(`📋 [AutoLaTeX] Processed IDs so far: ${processedIdsRef.current.size}`);

        const latexQuestions = await fetchLatexQuestions(10);
        console.log(`📦 [AutoLaTeX] fetchLatexQuestions returned ${latexQuestions.length} questions`);

        if (latexQuestions.length === 0) {
          console.log('⏳ [AutoLaTeX] No questions found. Checking processedIds size:', processedIdsRef.current.size);
          addLog('⏳ No new questions with LaTeX issues found. Waiting 30s...', 'warning');
          setAutoProcessStats(prev => ({ ...prev, status: 'waiting' }));
          await new Promise(resolve => setTimeout(resolve, 30000));
          continue;
        }

        addLog(`📦 Processing ${latexQuestions.length} questions individually with parallel workers...`, 'info');
        setAutoProcessStats(prev => ({ ...prev, status: 'processing' }));

        const errors = [];
        let completedCount = 0;

        // Fetch available API keys for 1:1 task-to-key assignment
        let availableKeys = [];
        try {
          availableKeys = await aiUsageService.getAllAvailableKeys();
        } catch (err) {
          console.warn('Failed to fetch available keys, defaulting to concurrency of 1:', err);
        }

        const effectiveConcurrency = Math.min(
          availableKeys.length || 1,
          latexQuestions.length
        );
        addLog(`🔑 ${availableKeys.length} API keys available — processing up to ${effectiveConcurrency} in parallel (1 task per key)`, 'info');

        const processOneQuestion = async (q, assignedKey) => {
          const MAX_LATEX_RETRIES = 3;

          const attemptFix = async (questionData, attempt = 0) => {
            const qId = questionData.id?.toString();
            const groupId = `auto-q${qId}`;

            if (attempt === 0) {
              addLog(`🔄 [Q#${qId}] Starting...`, 'info', groupId);
            } else {
              addLog(`🔄 [Q#${qId}] Retry ${attempt + 1}/${MAX_LATEX_RETRIES} — LaTeX issues detected after previous fix...`, 'info', groupId);
            }

            const sq = { id: questionData.id, type: questionData.type, questionText: questionData.questionText || questionData.question || '' };
            if (questionData.explanation) sq.explanation = questionData.explanation;
            if (questionData.answer) sq.answer = questionData.answer;
            if (questionData.options?.length) sq.options = questionData.options.map(o => ({ ...o }));
            if (questionData.parts?.length) sq.parts = questionData.parts.map(p => ({ letter: p.letter, text: p.text, answer: p.answer }));

            const instruction = attempt === 0
              ? 'ONLY fix LaTeX issues. Prioritize fixing LaTeX delimiters, escape sequences, and Bengali LaTeX content. Fix mismatched \\(...\\) delimiters, bare math patterns, and double-backslash leaks.'
              : `Previous AI fix did NOT fully resolve LaTeX issues. Try harder. Focus on: fixing mismatched \\(...\\) delimiters, wrapping bare math with \\(...\\), removing double-backslash leaks, and fixing display math (\\[...\\] or $$). INSPECT EVERY FIELD. The current content still has LaTeX bugs.`;

            try {
              const results = [];
              await aiService.improveQuestions(
                [sq],
                'fix_latex',
                instruction,
                (delta) => { if (delta.trim()) addLog(delta, 'ai-stream', groupId); },
                (status) => { addLog(`[Q#${qId}] ${status}`, status.includes('❌') ? 'error' : 'info', groupId); },
                (result) => { results.push(result); },
                attempt > 0 ? null : assignedKey
              );

              const r = results[0] || {};
              const updatedObj = { ...questionData };
              if (r.questionText) updatedObj.questionText = r.questionText;
              if (r.explanation) updatedObj.explanation = r.explanation;
              if (r.answer) updatedObj.answer = r.answer;
              if (r.options) {
                updatedObj.options = (questionData.options || []).map(opt => {
                  const fixed = r.options.find(fo => fo.label === opt.label);
                  return fixed ? { ...opt, ...fixed } : opt;
                });
              }
              if (r.parts) {
                updatedObj.parts = (questionData.parts || []).map(p => {
                  const fixed = r.parts.find(fp => fp.letter === p.letter);
                  return fixed ? { ...p, ...fixed } : p;
                });
              }

              // Check if LaTeX issues still remain
              if (aiService.hasLatexIssues(updatedObj) && attempt < MAX_LATEX_RETRIES - 1) {
                addLog(`⚠️ [Q#${qId}] LaTeX issues persist after AI fix. Re-processing...`, 'warning', groupId);
                return await attemptFix(updatedObj, attempt + 1);
              }

              if (aiService.hasLatexIssues(updatedObj)) {
                addLog(`⚠️ [Q#${qId}] LaTeX issues still present after ${MAX_LATEX_RETRIES} attempts. Saving as-is.`, 'warning', groupId);
              } else if (attempt > 0) {
                addLog(`✅ [Q#${qId}] LaTeX resolved after ${attempt + 1} attempts. Saving...`, 'success', groupId);
              }

              await updateQuestion(updatedObj);

              setHistory(prev => [{
                id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                task: 'fix_latex (Auto)',
                questionId: qId,
                before: q,
                after: updatedObj
              }, ...prev].slice(0, 100));

              completedCount++;
              addLog(`✅ [Q#${qId}] Done (${completedCount}/${latexQuestions.length})${attempt > 0 ? ` after ${attempt + 1} attempts` : ''}`, 'success', groupId);
              setAutoProcessStats(prev => ({ ...prev, totalProcessed: prev.totalProcessed + 1 }));
            } catch (aiErr) {
              addLog(`❌ [Q#${qId}] AI failed: ${aiErr.message}`, 'error', groupId);
              errors.push(aiErr.message);
            }
          };

          await attemptFix(q);
        };

        // Process in parallel — assign 1 distinct key per question
        for (let i = 0; i < latexQuestions.length; i += effectiveConcurrency) {
          if (autoProcessControlRef.current?.stop) break;
          const chunk = latexQuestions.slice(i, i + effectiveConcurrency);
          const keysSlice = availableKeys.slice(0, chunk.length);
          addLog(`⚡ Launching ${chunk.length} parallel workers with 1:1 key assignment...`, 'info');
          await Promise.all(chunk.map((q, idx) => processOneQuestion(q, keysSlice[idx] || null)));
        }

        setAutoProcessStats(prev => ({
          totalProcessed: prev.totalProcessed,
          totalBatches: prev.totalBatches + 1,
          status: 'idle',
          lastProcessedAt: new Date().toISOString(),
          currentSubject: ''
        }));
        addLog(`📊 Batch complete. Errors: ${errors.length}`, errors.length > 0 ? 'warning' : 'success');

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      addLog(`🚨 Auto-Processing error: ${err.message}`, 'error');
    } finally {
      setIsAutoProcessing(false);
      autoProcessControlRef.current = null;
      setAutoProcessStats(prev => ({ ...prev, status: 'idle', currentSubject: '' }));
      addLog('🛑 Auto LaTeX Processing stopped.', 'finish');
    }
  }, [isAutoProcessing, addLog, updateQuestion, questions]);

  const stopAutoProcessing = useCallback(() => {
    if (autoProcessControlRef.current) {
      autoProcessControlRef.current.stop = true;
      addLog('🛑 Stopping Auto LaTeX Processing...', 'warning');
    }
  }, [addLog]);

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
    isAutoProcessing,
    autoProcessStats,
    autoSubjectFilter,
    setAutoSubjectFilter,
    autoChapterFilter,
    setAutoChapterFilter,
    autoTypeFilter,
    setAutoTypeFilter,
    realtimeLogs,
    addToQueue,
    removeFromQueue,
    clearQueue,
    clearHistory,
    processBatch,
    handleApproveFix,
    addLog,
    startAutoProcessing,
    stopAutoProcessing
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
