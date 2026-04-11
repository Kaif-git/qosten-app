import { supabase } from './supabaseClient';
import { questionApi } from './questionApi';

export const reportApi = {
  /**
   * Fetches all user reports from the user_reports table.
   * Links related content and user profile data.
   */
  async fetchReports() {
    const { data: { user } } = await supabase.auth.getUser();
    console.log(`🔍 [reportApi] Current User: ${user?.id} (${user?.email})`);
    console.log('🔍 [reportApi] fetchReports: Starting fetch via RPC...');
    
    // Use RPC to bypass RLS for admin dashboard
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

    // Sort manually since RPC might not guarantee order despite the function definition
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

    // Questions are from Worker API
    let questions = [];
    if (questionIds.length > 0) {
      try {
        const rawQuestions = await questionApi.fetchQuestionsByIds(questionIds);
        // Map raw questions if needed (similar to mapDatabaseToApp in QuestionContext)
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

    return reports.map(report => ({
      ...report,
      subtopic: subtopicMap[report.subtopic_id],
      question: questionMap[report.question_id],
      lab_problem: labMap[report.lab_problem_id],
      user: userMap[report.user_id]
    }));
  },

  async fetchChats() {
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

    // Sort manually since RPC might not guarantee order
    chats.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const userIds = [...new Set(chats.map(c => c.user_id).filter(Boolean))];
    const { data: users } = userIds.length > 0 
      ? await supabase.from('user_profiles').select('user_id, display_name, username, account_tier, subscription_end_date').in('user_id', userIds)
      : { data: [] };

    const userMap = (users || []).reduce((acc, u) => ({ ...acc, [u.user_id]: u }), {});

    return chats.map(chat => ({
      ...chat,
      user: userMap[chat.user_id]
    }));
  },

  async fetchUsers() {
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
    return data;
  },

  /**
   * Sends a reply to a chat.
   * Based on 3-step process: Chat Reply, Notification, Report Update.
   */
  async sendChatReply(userId, message, senderId = null) {
    let finalSenderId = senderId;
    
    // If no senderId provided, try to get from session
    if (!finalSenderId) {
      const { data: { session } } = await supabase.auth.getSession();
      finalSenderId = session?.user?.id || userId; // Fallback to userId if no session, but ideally should be dev id
    }

    const { data, error } = await supabase
      .from('dev_chats')
      .insert([{
        user_id: userId,
        message: message,
        sender_type: 'developer',
        sender_id: finalSenderId, 
        is_read: false
      }])
      .select();
    if (error) throw error;
    return data[0];
  },

  /**
   * Creates a notification for a user.
   */
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

  /**
   * Updates report status or internal notes.
   */
  async updateReport(id, updates) {
    try {
      const { error } = await supabase
        .from('user_reports')
        .update(updates)
        .eq('id', id);
      
      if (error) {
        // If 'status' column is missing, try 'report_status'
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

  /**
   * Flags content.
   * For questions, we fetch the current data first to avoid wiping it out via PUT,
   * and we use 1/0 for SQLite/D1 compatibility.
   */
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
        
        // If we have data, merge it and send full object. 
        // If not, we still send a partial, but at least use 1/0.
        const intValue = value ? 1 : 0;
        const updates = currentData 
          ? { ...currentData, is_flagged: intValue, isFlagged: intValue, flagged: intValue }
          : { is_flagged: intValue, isFlagged: intValue, flagged: intValue };
        
        // Ensure ID is included in the body for the PUT request
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

  /**
   * Fetches all flagged content across subtopics, questions, and labs.
   */
  async fetchFlaggedContent() {
    const [subtopicsRes, labsRes, questionsData] = await Promise.all([
      supabase.from('learn_subtopics').select('*, topic:topic_id(title, subject, chapter)').eq('flagged', true),
      supabase.from('lab_problems').select('*, title:lesson').eq('is_flagged', true),
      questionApi.fetchFlaggedQuestions()
    ]);

    return {
      subtopics: subtopicsRes.data || [],
      labs: labsRes.data || [],
      questions: Array.isArray(questionsData) ? questionsData : (questionsData.data || [])
    };
  },

  /**
   * Sends a general notification to a user.
   */
  async sendNotification(userId, { type, title, message, action_url = null, data = {} }) {
    const { data: result, error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        type: type || 'system',
        title: title,
        message: message,
        read: false,
        action_url: action_url,
        data: data,
        created_at: new Date().toISOString()
      }])
      .select();
    if (error) throw error;
    return result[0];
  },

  /**
   * Updates a user profile (e.g., tier, subscription dates).
   * Uses admin RPC to bypass RLS for developer dashboard actions.
   */
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
      // Use RPC to bypass RLS since Dev Dashboard might not have full Auth session
      const { data: success, error } = await supabase.rpc('update_user_admin', {
        target_user_id: userId,
        profile_updates: profileUpdates,
        subscription_updates: subUpdates
      });

      if (error) throw error;
      if (!success) throw new Error('Failed to update user via admin RPC');

      // Fetch the updated profile to return
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
  }
};
