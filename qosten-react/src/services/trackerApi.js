import { supabase } from './supabaseClient';

export const trackerApi = {
  /**
   * Fetch all entries from daily_guide_trackers
   */
  async getAllTrackers() {
    if (!supabase) return { data: [], error: 'Supabase client not initialized' };
    
    const { data, error } = await supabase
      .from('daily_guide_trackers')
      .select('*')
      .order('created_at', { ascending: false });
    
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
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, username, account_tier, created_at, last_seen_at')
      .in('user_id', userIds);
      
    return { data, error };
  }
};
