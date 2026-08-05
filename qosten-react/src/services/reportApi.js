import { supabase } from './supabaseClient';
import { questionApi } from './questionApi';

const cache = {
  reports: null,
  chats: null,
  users: null,
  incompleteSignups: null,
  flagged: null,
  metrics: {},
};

export const reportApi = {
  clearCache() {
    cache.reports = null;
    cache.chats = null;
    cache.users = null;
    cache.incompleteSignups = null;
    cache.flagged = null;
    cache.metrics = {};
    console.log('🧹 [reportApi] Cache cleared');
  },

  async fetchReports(useCache = true) {
    if (useCache && cache.reports) {
      console.log('📦 [reportApi] Returning cached reports');
      return cache.reports;
    }

    const { data: { user } } = await supabase.auth.getUser();
    console.log(`🔍 [reportApi] Current User: ${user?.id} (${user?.email})`);
    console.log('🔍 [reportApi] fetchReports: Starting fetch via RPC...');

    const { data: reports, error } = await supabase.rpc('fetch_all_reports');

    if (error) {
      console.error('❌ [reportApi] fetchReports error:', error);
      throw error;
    }

    console.log(`📊 [reportApi] fetchReports: Found ${reports?.length || 0} raw reports`);
    if (!reports || reports.length === 0) {
      console.warn('⚠️ [reportApi] fetchReports: No reports returned from database.');
      return [];
    }

    reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    console.log('📦 [reportApi] Raw first report sample:', reports[0]);
    console.log('📦 [reportApi] Available columns in first report:', Object.keys(reports[0]));

    const subtopicIds = [...new Set(reports.map(r => r.subtopic_id).filter(Boolean))];
    const questionIds = [...new Set(reports.map(r => r.question_id).filter(Boolean))];
    const labIds = [...new Set(reports.map(r => r.lab_problem_id).filter(Boolean))];
    const userIds = [...new Set(reports.map(r => r.user_id).filter(Boolean))];

    const [subtopicsRes, labsRes, usersRes] = await Promise.all([
      subtopicIds.length > 0 ? supabase.from('learn_subtopics').select('id, title, topic_id').in('id', subtopicIds) : { data: [] },
      labIds.length > 0 ? supabase.from('lab_problems').select('id, title:lesson, chapter, subject').in('id', labIds) : { data: [] },
      userIds.length > 0 ? supabase.from('user_profiles').select('user_id, display_name, username, account_tier, subscription_end_date').in('user_id', userIds) : { data: [] }
    ]);

    let questions = [];
    if (questionIds.length > 0) {
      try {
        const rawQuestions = await questionApi.fetchQuestionsByIds(questionIds);
        questions = rawQuestions.map(q => ({
          ...q,
          questionText: q.questionText || q.question || 'No question text',
          is_flagged: !!(q.is_flagged || q.isFlagged || q.flagged)
        }));
      } catch (err) {
        console.error('Error fetching questions from worker:', err);
      }
    }

    const topicIds = [...new Set([
      ...(subtopicsRes.data || []).map(s => s.topic_id),
      ...(questions || []).map(q => q.topic_id)
    ].filter(Boolean))];

    const { data: topics } = topicIds.length > 0
      ? await supabase.from('learn_topics').select('id, title, subject, chapter').in('id', topicIds)
      : { data: [] };

    const topicMap = (topics || []).reduce((acc, t) => ({ ...acc, [t.id]: t }), {});
    const subtopicMap = (subtopicsRes.data || []).reduce((acc, s) => ({ ...acc, [s.id]: { ...s, topic: topicMap[s.topic_id] } }), {});
    const questionMap = (questions || []).reduce((acc, q) => ({ ...acc, [q.id]: { ...q, topic: topicMap[q.topic_id] } }), {});
    const labMap = (labsRes.data || []).reduce((acc, l) => ({ ...acc, [l.id]: l }), {});
    const userMap = (usersRes.data || []).reduce((acc, u) => ({ ...acc, [u.user_id]: u }), {});

    const result = reports.map(report => ({
      ...report,
      subtopic: subtopicMap[report.subtopic_id],
      question: questionMap[report.question_id],
      lab_problem: labMap[report.lab_problem_id],
      user: userMap[report.user_id]
    }));

    cache.reports = result;
    return result;
  },

  async fetchChats(useCache = true) {
    if (useCache && cache.chats) {
      console.log('📦 [reportApi] Returning cached chats');
      return cache.chats;
    }

    console.log('🔍 [reportApi] fetchChats: Starting fetch via RPC...');
    const { data: chats, error } = await supabase.rpc('fetch_all_chats');

    if (error) {
      console.error('❌ [reportApi] fetchChats error:', error);
      throw error;
    }

    console.log(`📊 [reportApi] fetchChats: Found ${chats?.length || 0} raw chats`);
    if (!chats || chats.length === 0) {
      console.warn('⚠️ [reportApi] fetchChats: No chats returned from database.');
      return [];
    }

    chats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const userIds = [...new Set(chats.map(c => c.user_id).filter(Boolean))];
    const { data: users } = userIds.length > 0
      ? await supabase.from('user_profiles').select('user_id, display_name, username, account_tier, subscription_end_date').in('user_id', userIds)
      : { data: [] };

    const userMap = (users || []).reduce((acc, u) => ({ ...acc, [u.user_id]: u }), {});

    const result = chats.map(chat => ({
      ...chat,
      user: userMap[chat.user_id]
    }));

    cache.chats = result;
    return result;
  },

  async fetchUsers(useCache = true) {
    if (useCache && cache.users) {
      console.log('📦 [reportApi] Returning cached users');
      return cache.users;
    }

    console.log('🔍 [reportApi] fetchUsers: Starting fetch...');
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [reportApi] fetchUsers error:', error);
      throw error;
    }

    const currentUserProfile = data.find(u => u.user_id === user?.id);
    console.log(`📊 [reportApi] Current User Tier (DB): ${currentUserProfile?.account_tier || 'unknown'}`);
    console.log(`📊 [reportApi] fetchUsers: Found ${data?.length || 0} users`);

    cache.users = data;
    return data;
  },

  async fetchIncompleteSignups(useCache = true) {
    if (useCache && cache.incompleteSignups) {
      console.log('📦 [reportApi] Returning cached incomplete signups');
      return cache.incompleteSignups;
    }

    console.log('🔍 [reportApi] fetchIncompleteSignups: Starting fetch via RPC...');
    const { data, error } = await supabase.rpc('fetch_incomplete_users');

    if (error) {
      console.error('❌ [reportApi] fetchIncompleteSignups error:', error);
      throw error;
    }

    console.log(`📊 [reportApi] fetchIncompleteSignups: Found ${data?.length || 0} users`);

    cache.incompleteSignups = data;
    return data;
  },

  async sendChatReply(userId, message, senderId = null) {
    let finalSenderId = senderId;

    if (!finalSenderId) {
      const { data: { session } } = await supabase.auth.getSession();
      finalSenderId = session?.user?.id || userId;
    }

    const { data, error } = await supabase
      .rpc('send_dev_chat_message', {
        p_user_id: userId,
        p_message: message,
        p_sender_type: 'developer',
        p_sender_id: finalSenderId,
        p_is_read: false
      });

    if (error) throw error;
    return data?.[0];
  },

  async createNotification(userId, title, message, type = 'dev_chat', data = {}) {
    const { data: result, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title: title,
        message: message,
        type: type,
        data: data,
        read: false
      }])
      .select();
    if (error) throw error;
    return result[0];
  },

  async updateReport(id, updates) {
    try {
      const { error } = await supabase
        .from('user_reports')
        .update(updates)
        .eq('id', id);

      if (error) {
        if (error.message?.includes('column "status" does not exist') && updates.status) {
          const fallbackUpdates = { ...updates, report_status: updates.status };
          delete fallbackUpdates.status;
          const { error: error2 } = await supabase
            .from('user_reports')
            .update(fallbackUpdates)
            .eq('id', id);
          if (error2) throw error2;
          return true;
        }
        throw error;
      }
      return true;
    } catch (err) {
      console.error('Error in updateReport:', err);
      throw err;
    }
  },

  async flagContent(type, id, value = true, fullData = null) {
    if (type === 'subtopic') {
      return await supabase.from('learn_subtopics').update({ flagged: value }).eq('id', id);
    } else if (type === 'lab_problem') {
      return await supabase.from('lab_problems').update({ is_flagged: value }).eq('id', id);
    } else if (type === 'question') {
      try {
        let currentData = fullData;
        if (!currentData) {
          const fetched = await questionApi.fetchQuestionsByIds([id]);
          if (fetched && fetched.length > 0) {
            currentData = fetched[0];
          }
        }

        const intValue = value ? 1 : 0;
        const updates = currentData
          ? { ...currentData, is_flagged: intValue, isFlagged: intValue, flagged: intValue }
          : { is_flagged: intValue, isFlagged: intValue, flagged: intValue };
        if (!updates.id) updates.id = id;

        return await questionApi.updateQuestion(id, updates);
      } catch (err) {
        console.error('Error in flagContent for question:', err);
        throw err;
      }
    }
  },

  async deleteReport(id) {
    const { error } = await supabase.from('user_reports').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async fetchFlaggedContent(useCache = true) {
    if (useCache && cache.flagged) {
      console.log('📦 [reportApi] Returning cached flagged content');
      return cache.flagged;
    }

    const [subtopicsRes, labsRes, questionsData] = await Promise.all([
      supabase.from('learn_subtopics').select('*, topic:topic_id(title, subject, chapter)').eq('flagged', true),
      supabase.from('lab_problems').select('*, title:lesson').eq('is_flagged', true),
      questionApi.fetchFlaggedQuestions()
    ]);

    const result = {
      subtopics: subtopicsRes.data || [],
      labs: labsRes.data || [],
      questions: Array.isArray(questionsData) ? questionsData : (questionsData.data || [])
    };

    cache.flagged = result;
    return result;
  },

  async sendNotification(userId, { type, title, message, action_url = null, data = {} }) {
    const { data: result, error } = await supabase
      .rpc('send_notification', {
        p_user_id: userId,
        p_type: type || 'system',
        p_title: title,
        p_message: message,
        p_read: false,
        p_action_url: action_url,
        p_data: data
      });
    if (error) throw error;
    return result?.[0];
  },

  async updateUser(userId, updates) {
    const subscriptionFields = [
      'account_tier',
      'subscription_type',
      'subscription_start_date',
      'subscription_end_date',
      'questions_answered_today',
      'last_question_date',
      'trial_activated_at',
      'trial_end_date'
    ];

    const subUpdates = {};
    const profileUpdates = {};

    Object.keys(updates).forEach(key => {
      if (subscriptionFields.includes(key)) {
        subUpdates[key] = updates[key];
      } else {
        profileUpdates[key] = updates[key];
      }
    });

    try {
      const { data: success, error } = await supabase.rpc('update_user_admin', {
        target_user_id: userId,
        profile_updates: profileUpdates,
        subscription_updates: subUpdates
      });

      if (error) throw error;
      if (!success) throw new Error('Failed to update user via admin RPC');

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      return data;
    } catch (err) {
      console.error('Error in updateUser:', err);
      throw err;
    }
  },

  async fetchUserMetrics(userId, useCache = true) {
    if (useCache && cache.metrics[userId]) {
      console.log(`📦 [reportApi] Returning cached metrics for user ${userId}`);
      return cache.metrics[userId];
    }

    try {
      const [unified, streaks, studyPoints, mastery, flashcards] = await Promise.all([
        supabase.from('daily_guide_unified').select('*').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('simple_streaks').select('*').eq('user_id', userId).single(),
        supabase.from('study_point_tracking').select('*').eq('user_id', userId).order('activity_date', { ascending: false }),
        supabase.from('question_mastery').select('*').eq('user_id', userId),
        supabase.from('flashcards_mastery').select('*').eq('user_id', userId)
      ]);

      const result = {
        daily: unified.data || [],
        streaks: streaks.data || null,
        studyPoints: studyPoints.data || [],
        mastery: mastery.data || [],
        flashcards: flashcards.data || []
      };

      cache.metrics[userId] = result;
      return result;
    } catch (err) {
      console.error('❌ [reportApi] fetchUserMetrics error:', err);
      throw err;
    }
  },

  async fetchUserAIUsage(userId, date) {
    try {
      const dateStr = date || new Date().toISOString().split('T')[0];
      const [usageLogs, dailyQuota] = await Promise.all([
        supabase.rpc('fetch_user_ai_usage_logs', { p_user_id: userId, p_date: dateStr, p_limit: 100 }),
        supabase.from('user_ai_quotas').select('*').eq('user_id', userId).eq('date', dateStr).maybeSingle()
      ]);

      const logs = usageLogs.data?.logs || [];
      const requests = logs.length;
      const tokens = logs.reduce((s, l) => s + (l.tokens_total || 0), 0);
      const toolCalls = logs.reduce((s, l) => s + (l.tool_call_count || 0), 0);
      const cacheHits = logs.filter(l => l.cache_hit).length;

      const aiUsage = await supabase.rpc('fetch_user_ai_usage', { p_user_id: userId, p_date: dateStr });
      const convData = aiUsage.data || {};

      return {
        daily: { requests, tokens, toolCalls, cacheHits, logs, quota: dailyQuota.data || null },
        totalConversations: convData.conversations || 0,
        totalTokensAllTime: convData.totalTokensAllTime || 0,
      };
    } catch (err) {
      console.error('[reportApi] fetchUserAIUsage error:', err);
      throw err;
    }
  },

  async fetchUserAIConversations(userId, page = 0, pageSize = 50) {
    try {
      const { data, error } = await supabase.rpc('fetch_user_ai_conversations', {
        p_user_id: userId,
        p_page: page,
        p_page_size: pageSize,
      });

      if (error) throw error;
      const result = data || { conversations: [], total: 0 };

      return {
        conversations: result.conversations || [],
        total: result.total || 0,
        page,
        pageSize,
      };
    } catch (err) {
      console.error('[reportApi] fetchUserAIConversations error:', err);
      throw err;
    }
  },

  async fetchAllAIMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const quotaUsage = await supabase.from('user_ai_quotas').select('user_id, requests_used, requests_limit').eq('date', today);

      return {
        totalRequestsToday: quotaUsage.data?.reduce((s, q) => s + (q.requests_used || 0), 0) || 0,
        dailyActiveUsers: 0,
        quotaSnapshots: quotaUsage.data || [],
      };
    } catch (err) {
      console.error('[reportApi] fetchAllAIMetrics error:', err);
      throw err;
    }
  },

  async fetchAIChatSessions(page = 0, pageSize = 20) {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('session_id, created_at, role')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sessionMap = new Map();
      for (const row of data || []) {
        if (!sessionMap.has(row.session_id)) {
          sessionMap.set(row.session_id, {
            session_id: row.session_id,
            message_count: 0,
            last_message_at: row.created_at,
          });
        }
        const s = sessionMap.get(row.session_id);
        s.message_count++;
        if (new Date(row.created_at) > new Date(s.last_message_at)) {
          s.last_message_at = row.created_at;
        }
      }

      const allSessions = Array.from(sessionMap.values())
        .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

      const total = allSessions.length;
      const paginated = allSessions.slice(page * pageSize, (page + 1) * pageSize);

      return { sessions: paginated, total };
    } catch (err) {
      console.error('[reportApi] fetchAIChatSessions error:', err);
      throw err;
    }
  },

  async fetchAIChatMessages(sessionId) {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[reportApi] fetchAIChatMessages error:', err);
      throw err;
    }
  },

  async fetchRecentActivity(page = 0, pageSize = 20) {
    try {
      console.log(`🔍 [reportApi] fetchRecentActivity: Starting fetch via RPC (page ${page})...`);
      const { data: activities, error } = await supabase.rpc('fetch_recent_activity_unified', { 
        p_page: page, 
        p_page_size: pageSize 
      });

      if (error) throw error;
      if (!activities || activities.length === 0) return [];

      const userIds = [...new Set(activities.map(a => a.user_id).filter(Boolean))];
      const { data: users, error: userError } = userIds.length > 0
        ? await supabase.from('user_profiles').select('user_id, display_name, username').in('user_id', userIds)
        : { data: [] };

      if (userError) throw userError;

      const userMap = (users || []).reduce((acc, u) => ({ ...acc, [u.user_id]: u }), {});

      return activities.map(act => ({
        ...act,
        user_profiles: userMap[act.user_id] || null
      }));
    } catch (err) {
      console.error('❌ [reportApi] fetchRecentActivity error:', err);
      throw err;
    }
  }
};
