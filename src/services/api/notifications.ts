import { supabase } from '../supabase'
import type { Notification, UserNotificationPreferences } from '../../types'

export const notificationsApi = {
  // Ottieni notifiche non lette dell'utente corrente
  async getUnreadNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        request:requests(
          id,
          title,
          status,
          request_type:request_types(name)
        )
      `)
      .eq('read', false)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  // Ottieni tutte le notifiche dell'utente corrente (con paginazione)
  async getNotifications(limit = 50, offset = 0): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        request:requests(
          id,
          title,
          status,
          request_type:request_types(name)
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data || []
  },

  // Conta notifiche non lette
  async getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)

    if (error) throw error
    return count || 0
  },

  // Marca notifica come letta
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) throw error
  },

  // Marca tutte le notifiche come lette
  async markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) throw error
  },

  // Elimina notifica (dopo visualizzazione)
  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) throw error
  },

  // Elimina tutte le notifiche lette
  async deleteReadNotifications(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('read', true)

    if (error) throw error
  },

  // Ottieni preferenze notifiche utente
  async getNotificationPreferences(): Promise<UserNotificationPreferences | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data
  },

  // Crea o aggiorna preferenze notifiche
  async upsertNotificationPreferences(
    preferences: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('user_notification_preferences')
      .upsert(
        {
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id', // Specifica la colonna di conflitto
          ignoreDuplicates: false, // Aggiorna se esiste già
        }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Aggiorna preferenze transizioni stato
  async updateStatusTransitionPreference(
    statusFrom: string,
    statusTo: string,
    enabled: boolean
  ): Promise<UserNotificationPreferences> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Ottieni preferenze correnti
    const currentPrefs = await this.getNotificationPreferences()

    // Se non esistono preferenze, creale con valori default
    if (!currentPrefs) {
      const key = `${statusFrom}_${statusTo}`
      return await this.upsertNotificationPreferences({
        in_app: true,
        email: false,
        status_transitions: { [key]: enabled }
      })
    }

    // Clona status_transitions correnti
    const statusTransitions = { ...(currentPrefs.status_transitions || {}) }

    // Aggiorna la transizione specifica
    const key = `${statusFrom}_${statusTo}`
    statusTransitions[key] = enabled

    // Salva mantenendo tutte le altre proprietà
    return await this.upsertNotificationPreferences({
      in_app: currentPrefs.in_app,
      email: currentPrefs.email,
      status_transitions: statusTransitions
    })
  },

  // Subscribe alle notifiche in tempo reale
  subscribeToNotifications(
    callback: (notification: Notification) => void
  ): () => void {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          // Fetch completo con relazioni
          const { data } = await supabase
            .from('notifications')
            .select(`
              *,
              request:requests(
                id,
                title,
                status,
                request_type:request_types(name)
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            callback(data as Notification)
          }
        }
      )
      .subscribe()

    // Funzione di cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  },
}
