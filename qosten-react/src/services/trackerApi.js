import { supabase } from './supabaseClient';

export const trackerApi = {
  /**
   * Fetch all entries from daily_guide_trackers
   */
  async getAllTrackers() {
    if (!supabase) return { data: [], error: 'Supabase client not initialized' };
    
    // Use RPC to bypass RLS for admin dashboard
    const { data, error } = await supabase.rpc('fetch_all_trackers');
    
    if (data) {
        // Sort manually since RPC might not guarantee order
        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    return { data, error };
  },

  /**
   * Delete a tracker entry by ID
   */
  async deleteTracker(id) {
    if (!supabase) return { error: 'Supabase client not initialized' };
    
    const { error } = await supabase
      .from('daily_guide_trackers')
      .delete()
      .eq('id', id);
    
    return { error };
  },

  /**
   * Fetch a specific tracker by ID
   */
  async getTrackerById(id) {
    if (!supabase) return { data: null, error: 'Supabase client not initialized' };
    
    const { data, error } = await supabase
      .from('daily_guide_trackers')
      .select('*')
      .eq('id', id)
      .single();
    
    return { data, error };
  },

  /**
   * Fetch user profiles by IDs
   */
  async getUsersByIds(userIds) {
    if (!supabase) return { data: [], error: 'Supabase client not initialized' };
    if (!userIds || userIds.length === 0) return { data: [], error: null };
    
    // Use RPC to bypass RLS for admin dashboard
    const { data, error } = await supabase.rpc('fetch_users_by_ids', { p_user_ids: userIds });
      
    return { data, error };
  }
};
