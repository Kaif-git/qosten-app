import { supabase } from './supabaseClient';
import { questionApi } from './questionApi';

export const reportApi = {
  /**
   * Fetches all user reports from the user_reports table.
   * Links related content and user profile data.
   */
  async fetchReports() {
    const { data: reports, error } = await supabase
      .from('user_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }

    if (!reports || reports.length === 0) return [];

    console.log('📦 [reportApi] Raw first report sample:', reports[0]);
    console.log('📦 [reportApi] Available columns in first report:', Object.keys(reports[0]));

    const subtopicIds = [...new Set(reports.map(r => r.subtopic_id).filter(Boolean))];
    const questionIds = [...new Set(reports.map(r => r.question_id).filter(Boolean))];
    const labIds = [...new Set(reports.map(r => r.lab_problem_id).filter(Boolean))];
    const userIds = [...new Set(reports.map(r => r.user_id).filter(Boolean))];

    const [subtopicsRes, labsRes, usersRes] = await Promise.all([
      subtopicIds.length > 0 ? supabase.from('learn_subtopics').select('id, title, topic_id').in('id', subtopicIds) : { data: [] },
      labIds.length > 0 ? supabase.from('lab_problems').select('id, title:lesson, chapter, subject').in('id', labIds) : { data: [] },
      userIds.length > 0 ? supabase.from('user_profiles').select('user_id, display_name, username, account_tier').in('user_id', userIds) : { data: [] }
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
    const { data: chats, error } = await supabase
      .from('dev_chats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!chats || chats.length === 0) return [];

    const userIds = [...new Set(chats.map(c => c.user_id).filter(Boolean))];
    const { data: users } = userIds.length > 0 
      ? await supabase.from('user_profiles').select('user_id, display_name, username, account_tier').in('user_id', userIds)
      : { data: [] };

    const userMap = (users || []).reduce((acc, u) => ({ ...acc, [u.user_id]: u }), {});

    return chats.map(chat => ({
      ...chat,
      user: userMap[chat.user_id]
    }));
  },

  async fetchUsers() {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Sends a reply to a chat.
   */
  async sendChatReply(userId, message) {
    const { data, error } = await supabase
      .from('dev_chats')
      .insert([{
        user_id: userId,
        message: message,
        sender_type: 'developer',
        sender_id: '00000000-0000-0000-0000-000000000000', // Use Nil UUID for System/Admin
        is_read: false
      }])
      .select();
    if (error) throw error;
    return data[0];
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
   */
  async flagContent(type, id, value = true) {
    if (type === 'subtopic') {
      return await supabase.from('learn_subtopics').update({ flagged: value }).eq('id', id);
    } else if (type === 'lab_problem') {
      return await supabase.from('lab_problems').update({ is_flagged: value }).eq('id', id);
    } else if (type === 'question') {
      // For questions, we use the Worker API update method
      return await questionApi.updateQuestion(id, { is_flagged: value });
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
   * Updates a user profile (e.g., tier, subscription dates).
   */
  async updateUser(userId, updates) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select();
    if (error) throw error;
    return data[0];
  }
};
