import { supabase } from './supabaseClient';

export const videoApi = {
  async getVideoLinks(questionId) {
    if (!supabase) return [];
    
    // Ensure questionId is treated as a number/string correctly for BigInt column
    const qId = String(questionId);

    const { data, error } = await supabase
      .from('question_video_links')
      .select('*')
      .eq('question_id', qId);
      
    if (error) {
      console.error('Error fetching video links:', error);
      return [];
    }
    
    return data;
  },
  
  async addVideoLink(linkData) {
    if (!supabase) throw new Error('Supabase client not initialized');
    
    // Get current user for submitted_by
    const { data: { user } } = await supabase.auth.getUser();
    
    const payload = {
      ...linkData,
      submitted_by: user ? user.id : undefined,
      status: 'approved' // Auto-approve for admins/creators
    };

    const { data, error } = await supabase
      .from('question_video_links')
      .insert([payload])
      .select()
      .single();
      
    if (error) {
      throw error;
    }
    
    return data;
  },
  
  async updateVideoLink(id, updates) {
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase
      .from('question_video_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteVideoLink(id) {
    if (!supabase) throw new Error('Supabase client not initialized');
    
    const { error } = await supabase
      .from('question_video_links')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw error;
    }
    
    return true;
  },

  async getVideoCounts(questionIds) {
    if (!supabase || !questionIds || !questionIds.length) return {};
    
    // Filter out valid IDs and ensure they are strings
    const validIds = questionIds.filter(id => id).map(String);
    if (validIds.length === 0) return {};

    const counts = {};
    const CHUNK_SIZE = 200;

    for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
        const chunk = validIds.slice(i, i + CHUNK_SIZE);
        
        const { data, error } = await supabase
          .from('question_video_links')
          .select('question_id')
          .in('question_id', chunk);
          
        if (error) {
            console.error('Error fetching video counts:', error);
            continue;
        }
        
        if (data) {
          data.forEach(row => {
            const qId = String(row.question_id);
            counts[qId] = (counts[qId] || 0) + 1;
          });
        }
    }
    
    return counts;
  },

  async getAllVideoLinks(limit = 100) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('question_video_links')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) {
      console.error('Error fetching all video links:', error);
      return [];
    }
    
    return data;
  }
};
