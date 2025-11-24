import { supabase } from '../supabase'

export interface RequestMessage {
  id: string
  request_id: string
  user_id: string
  message: string
  created_at: string
  updated_at: string
  user?: {
    full_name: string
    email: string
    role: string
  }
}

export interface CreateMessageInput {
  request_id: string
  message: string
}

export const requestMessagesApi = {
  // Get all messages for a request
  getByRequestId: async (requestId: string): Promise<RequestMessage[]> => {
    const { data, error } = await supabase
      .from('request_messages')
      .select(`
        *,
        user:users!request_messages_user_id_fkey(full_name, email, role)
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  // Create a new message
  create: async (input: CreateMessageInput): Promise<RequestMessage> => {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      throw new Error('Non autenticato')
    }

    const { data, error } = await supabase
      .from('request_messages')
      .insert({
        request_id: input.request_id,
        message: input.message,
        user_id: session.session.user.id,
      })
      .select(`
        *,
        user:users!request_messages_user_id_fkey(full_name, email, role)
      `)
      .single()

    if (error) {
      if (error.code === '42501') {
        throw new Error('Non hai i permessi per inviare messaggi in questa richiesta')
      }
      throw new Error(`Errore nell'invio del messaggio: ${error.message}`)
    }

    return data
  },

  // Delete a message (only own messages)
  delete: async (messageId: string): Promise<void> => {
    const { error } = await supabase
      .from('request_messages')
      .delete()
      .eq('id', messageId)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Non hai i permessi per eliminare questo messaggio')
      }
      throw new Error(`Errore nell'eliminazione del messaggio: ${error.message}`)
    }
  },

  // Subscribe to real-time messages for a request
  subscribeToMessages: (
    requestId: string,
    callback: (message: RequestMessage) => void
  ) => {
    const channel = supabase
      .channel(`request_messages:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${requestId}`,
        },
        async (payload) => {
          // Fetch the complete message with user data
          const { data } = await supabase
            .from('request_messages')
            .select(`
              *,
              user:users!request_messages_user_id_fkey(full_name, email, role)
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            callback(data)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}
