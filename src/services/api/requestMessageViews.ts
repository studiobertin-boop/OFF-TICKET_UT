import { supabase } from '../supabase'

export interface RequestMessageView {
  id: string
  request_id: string
  user_id: string
  last_viewed_at: string
  created_at: string
  updated_at: string
}

export const requestMessageViewsApi = {
  // Mark messages as viewed for a request
  markAsViewed: async (requestId: string): Promise<void> => {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      throw new Error('Non autenticato')
    }

    const userId = session.session.user.id

    // Upsert the view record (insert or update if exists)
    const { error } = await supabase
      .from('request_message_views')
      .upsert(
        {
          request_id: requestId,
          user_id: userId,
          last_viewed_at: new Date().toISOString(),
        },
        {
          onConflict: 'request_id,user_id',
        }
      )

    if (error) {
      throw new Error(`Errore nell'aggiornamento della visualizzazione: ${error.message}`)
    }
  },

  // Check if a request has unread messages for the current user
  hasUnreadMessages: async (requestId: string): Promise<boolean> => {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      return false
    }

    const userId = session.session.user.id

    const { data, error } = await supabase.rpc('has_unread_messages', {
      p_request_id: requestId,
      p_user_id: userId,
    })

    if (error) {
      console.error('Error checking unread messages:', error)
      return false
    }

    return data as boolean
  },

  // Get view status for multiple requests (for table display)
  getUnreadStatusForRequests: async (requestIds: string[]): Promise<Record<string, boolean>> => {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session || requestIds.length === 0) {
      return {}
    }

    const userId = session.session.user.id

    // Call the RPC function for each request
    const promises = requestIds.map(async (requestId) => {
      const { data, error } = await supabase.rpc('has_unread_messages', {
        p_request_id: requestId,
        p_user_id: userId,
      })

      if (error) {
        console.error(`Error checking unread messages for ${requestId}:`, error)
        return [requestId, false] as const
      }

      return [requestId, data as boolean] as const
    })

    const results = await Promise.all(promises)
    return Object.fromEntries(results)
  },
}
