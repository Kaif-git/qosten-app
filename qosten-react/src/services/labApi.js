import { supabase } from './supabaseClient';

export const labApi = {
  async fetchLabProblems(params = {}) {
    if (!supabase) throw new Error('Supabase client not initialized');

    let query = supabase
      .from('lab_problems')
      .select('*', { count: 'exact' });

    if (params.subject) query = query.eq('subject', params.subject);
    if (params.chapter) query = query.eq('chapter', params.chapter);
    if (params.board) query = query.eq('board', params.board);

    // Pagination
    if (params.limit) {
      const from = params.offset || 0;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return { data, totalCount: count };
  },

  async fetchLabProblemIds() {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { data, error } = await supabase
      .from('lab_problems')
      .select('lab_problem_id');
    if (error) throw error;
    return data.map(item => item.lab_problem_id);
  },

  async createLabProblem(problemData) {
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase
      .from('lab_problems')
      .insert([problemData])
      .select();

    if (error) throw error;
    return data[0];
  },

  async updateLabProblem(id, problemData) {
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase
      .from('lab_problems')
      .update(problemData)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data[0];
  },

  async deleteLabProblem(id) {
    if (!supabase) throw new Error('Supabase client not initialized');

    const { error } = await supabase
      .from('lab_problems')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async bulkCreateLabProblems(problems) {
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase
      .from('lab_problems')
      .insert(problems)
      .select();

    if (error) throw error;
    return data;
  },

  async deleteChapter(subject, chapter) {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase
      .from('lab_problems')
      .delete()
      .eq('subject', subject)
      .eq('chapter', chapter);
    if (error) throw error;
    return { success: true };
  },

  async renameSubject(oldSubjectName, newSubjectName) {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase
      .from('lab_problems')
      .update({ subject: newSubjectName })
      .eq('subject', oldSubjectName);
    if (error) throw error;
    return { success: true };
  },

  async renameChapter(subject, oldChapterName, newChapterName) {
    if (!supabase) throw new Error('Supabase client not initialized');
    const { error } = await supabase
      .from('lab_problems')
      .update({ chapter: newChapterName })
      .eq('subject', subject)
      .eq('chapter', oldChapterName);
    if (error) throw error;
    return { success: true };
  }
};
