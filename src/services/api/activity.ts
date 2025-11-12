import { supabase } from '../supabase';
import type { RecentActivity } from '../../types';

export const activityApi = {
  /**
   * Recupera attività recenti (aperture, cambi stato, blocchi, chiusure, eliminazioni)
   */
  async getRecentActivity(requestTypeName?: string, limit = 20): Promise<RecentActivity[]> {
    const { data, error } = await supabase.rpc('get_recent_activity', {
      p_request_type_name: requestTypeName || null,
      p_limit: limit,
    });

    if (error) throw error;

    return data || [];
  },
};
