import { supabase } from '../supabase'

/**
 * Service per gestire l'invio di notifiche email tramite Edge Function
 * Questo bypassa pg_net e chiama direttamente l'Edge Function dal frontend
 */

interface EmailNotificationPayload {
  to: string
  user_name: string
  event_type: 'request_created' | 'status_change' | 'request_suspended' | 'request_unsuspended'
  message: string
  request_id: string
  metadata?: {
    request_title?: string
    request_type_name?: string
    customer_name?: string
    current_status?: string
    assigned_to_name?: string
    is_dm329?: boolean
    [key: string]: any
  }
}

interface NotificationRecipient {
  user_id: string
  email: string
  full_name: string
  role: string
  preferences: {
    email: boolean
    in_app: boolean
    status_transitions: Record<string, boolean>
  }
}

/**
 * Ottiene i destinatari delle notifiche per una richiesta
 */
async function getNotificationRecipients(requestId: string): Promise<NotificationRecipient[]> {
  const { data: request, error: requestError } = await supabase
    .from('requests')
    .select(`
      id,
      created_by,
      assigned_to,
      creator:users!requests_created_by_fkey(id, email, full_name, role),
      assigned_user:users!requests_assigned_to_fkey(id, email, full_name, role)
    `)
    .eq('id', requestId)
    .single()

  if (requestError) {
    console.error('Error fetching request recipients:', requestError)
    return []
  }

  // Ottieni tutti gli admin
  const { data: admins, error: adminsError } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('role', 'admin')

  if (adminsError) {
    console.error('Error fetching admins:', adminsError)
  }

  // Costruisci lista destinatari unici
  const recipientIds = new Set<string>()
  const recipients: NotificationRecipient[] = []

  // Aggiungi creatore
  const creator = request.creator as any
  if (creator && creator.id) {
    recipientIds.add(creator.id)
    recipients.push({
      user_id: creator.id,
      email: creator.email,
      full_name: creator.full_name,
      role: creator.role,
      preferences: { email: false, in_app: true, status_transitions: {} }, // Placeholder
    })
  }

  // Aggiungi assegnato
  const assignedUser = request.assigned_user as any
  if (assignedUser && assignedUser.id) {
    if (!recipientIds.has(assignedUser.id)) {
      recipientIds.add(assignedUser.id)
      recipients.push({
        user_id: assignedUser.id,
        email: assignedUser.email,
        full_name: assignedUser.full_name,
        role: assignedUser.role,
        preferences: { email: false, in_app: true, status_transitions: {} },
      })
    }
  }

  // Aggiungi admin
  if (admins) {
    admins.forEach((admin) => {
      if (!recipientIds.has(admin.id)) {
        recipientIds.add(admin.id)
        recipients.push({
          user_id: admin.id,
          email: admin.email,
          full_name: admin.full_name,
          role: admin.role,
          preferences: { email: false, in_app: true, status_transitions: {} },
        })
      }
    })
  }

  // Ottieni preferenze per tutti i destinatari
  const { data: preferences, error: prefsError } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .in('user_id', Array.from(recipientIds))

  if (prefsError) {
    console.error('Error fetching preferences:', prefsError)
  }

  // Mappa preferenze ai destinatari
  if (preferences) {
    preferences.forEach((pref) => {
      const recipient = recipients.find((r) => r.user_id === pref.user_id)
      if (recipient) {
        recipient.preferences = {
          email: pref.email,
          in_app: pref.in_app,
          status_transitions: pref.status_transitions || {},
        }
      }
    })
  }

  return recipients
}

/**
 * Verifica se un utente deve ricevere notifica per un evento specifico
 */
function shouldNotifyUser(
  recipient: NotificationRecipient,
  eventType: string,
  statusFrom?: string,
  statusTo?: string
): boolean {
  // Se email disabilitato, skip
  if (!recipient.preferences.email) {
    return false
  }

  // Eventi sempre attivi (se email abilitato)
  if (eventType === 'request_created' || eventType === 'request_suspended' || eventType === 'request_unsuspended') {
    return true
  }

  // Per status_change, controlla transizioni specifiche
  if (eventType === 'status_change' && statusFrom && statusTo) {
    const transitionKey = `${statusFrom}_${statusTo}`
    return recipient.preferences.status_transitions[transitionKey] === true
  }

  return false
}

/**
 * Invia notifica email a un singolo destinatario
 */
async function sendEmailToRecipient(payload: EmailNotificationPayload): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: payload,
    })

    if (error) {
      console.error('Error sending email notification:', error)
      return false
    }

    if (data?.success === false) {
      console.error('Email notification failed:', data.error || data.message)
      return false
    }

    console.log('Email notification sent successfully to:', payload.to)
    return true
  } catch (error) {
    console.error('Exception sending email notification:', error)
    return false
  }
}

export const emailNotificationsApi = {
  /**
   * Invia notifiche email per creazione nuova richiesta
   */
  async notifyRequestCreated(requestId: string): Promise<void> {
    console.log('[EMAIL] ========== FUNCTION ENTRY ==========')
    console.log('[EMAIL] notifyRequestCreated called for request:', requestId)
    console.log('[EMAIL] Current timestamp:', new Date().toISOString())

    try {
      console.log('[EMAIL] Inside try block, about to fetch request data')
      // Ottieni dati completi richiesta
      const { data: request, error } = await supabase
        .from('requests')
        .select(`
          id,
          title,
          status,
          created_by,
          request_type:request_types(name),
          customer:customers(ragione_sociale),
          creator:users!requests_created_by_fkey(email, full_name)
        `)
        .eq('id', requestId)
        .single()

      if (error || !request) {
        console.error('[EMAIL] Error fetching request for email notification:', error)
        return
      }

      console.log('[EMAIL] Request data fetched:', { title: request.title, status: request.status })

      // Ottieni destinatari
      const recipients = await getNotificationRecipients(requestId)
      console.log('[EMAIL] Recipients found:', recipients.length)
      console.log('[EMAIL] Recipients details:', recipients.map(r => ({
        email: r.email,
        full_name: r.full_name,
        role: r.role,
        email_enabled: r.preferences.email
      })))

      // Filtra solo quelli che hanno email abilitato per request_created
      const recipientsToNotify = recipients.filter((r) =>
        shouldNotifyUser(r, 'request_created')
      )

      console.log('[EMAIL] Recipients to notify after filtering:', recipientsToNotify.length)
      console.log('[EMAIL] Filtered recipients:', recipientsToNotify.map(r => r.email))

      // Invia email a ciascun destinatario
      const message = `Nuova richiesta creata: ${request.title}`
      const requestType = request.request_type as any
      const customer = request.customer as any

      if (recipientsToNotify.length === 0) {
        console.warn('[EMAIL] No recipients to notify (all have email disabled or no preferences found)')
        return
      }

      await Promise.all(
        recipientsToNotify.map((recipient) =>
          sendEmailToRecipient({
            to: recipient.email,
            user_name: recipient.full_name,
            event_type: 'request_created',
            message,
            request_id: requestId,
            metadata: {
              request_title: request.title,
              request_type_name: requestType?.name,
              customer_name: customer?.ragione_sociale,
              current_status: request.status,
              is_dm329: requestType?.name?.includes('DM329'),
            },
          })
        )
      )

      console.log(`[EMAIL] Email notifications sent for request_created: ${recipientsToNotify.length} recipients`)
    } catch (error) {
      console.error('[EMAIL] Error in notifyRequestCreated:', error)
      // Non lanciare errore per non bloccare la creazione della richiesta
    }
  },

  /**
   * Invia notifiche email per cambio stato richiesta
   */
  async notifyStatusChange(
    requestId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      // Ottieni dati completi richiesta
      const { data: request, error } = await supabase
        .from('requests')
        .select(`
          id,
          title,
          status,
          request_type:request_types(name),
          customer:customers(ragione_sociale),
          assigned_user:users!requests_assigned_to_fkey(full_name)
        `)
        .eq('id', requestId)
        .single()

      if (error || !request) {
        console.error('Error fetching request for email notification:', error)
        return
      }

      // Determina tipo evento
      let eventType: EmailNotificationPayload['event_type'] = 'status_change'
      let message = `Richiesta "${request.title}" cambiata da ${oldStatus} a ${newStatus}`

      if (newStatus === 'SOSPESA' && oldStatus !== 'SOSPESA') {
        eventType = 'request_suspended'
        message = `Richiesta sospesa: ${request.title}`
      } else if (oldStatus === 'SOSPESA' && newStatus !== 'SOSPESA') {
        eventType = 'request_unsuspended'
        message = `Richiesta riattivata: ${request.title}`
      }

      // Ottieni destinatari
      const recipients = await getNotificationRecipients(requestId)

      // Filtra destinatari
      const recipientsToNotify = recipients.filter((r) =>
        shouldNotifyUser(r, eventType, oldStatus, newStatus)
      )

      // Invia email
      const requestType = request.request_type as any
      const customer = request.customer as any
      const assignedUser = request.assigned_user as any

      await Promise.all(
        recipientsToNotify.map((recipient) =>
          sendEmailToRecipient({
            to: recipient.email,
            user_name: recipient.full_name,
            event_type: eventType,
            message,
            request_id: requestId,
            metadata: {
              request_title: request.title,
              request_type_name: requestType?.name,
              customer_name: customer?.ragione_sociale,
              current_status: newStatus,
              assigned_to_name: assignedUser?.full_name,
              is_dm329: requestType?.name?.includes('DM329'),
            },
          })
        )
      )

      console.log(`Email notifications sent for status_change: ${recipientsToNotify.length} recipients`)
    } catch (error) {
      console.error('Error in notifyStatusChange:', error)
      // Non lanciare errore per non bloccare l'aggiornamento
    }
  },
}
