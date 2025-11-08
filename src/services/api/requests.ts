import { supabase, ensureValidSession } from '../supabase'
import { Request, RequestStatus, DM329Status } from '@/types'
import { emailNotificationsApi } from './emailNotifications'

export interface CreateRequestInput {
  request_type_id: string
  title: string
  custom_fields: Record<string, any>
  customer_id?: string
}

export interface UpdateRequestInput {
  title?: string
  status?: RequestStatus | DM329Status
  assigned_to?: string | null
  custom_fields?: Record<string, any>
  customer_id?: string | null
}

export interface RequestFilters {
  status?: string
  request_type_id?: string
  assigned_to?: string
  created_by?: string
  is_hidden?: boolean
}

export const requestsApi = {
  // Get all requests (with filters and relations)
  getAll: async (filters?: RequestFilters): Promise<Request[]> => {
    let query = supabase
      .from('requests')
      .select(`
        *,
        request_type:request_types(*),
        assigned_user:users!requests_assigned_to_fkey(id, email, full_name, role),
        creator:users!requests_created_by_fkey(id, email, full_name, role),
        customer:customers(*)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }
    if (filters?.request_type_id) {
      query = query.eq('request_type_id', filters.request_type_id)
    }
    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to)
    }
    if (filters?.created_by) {
      query = query.eq('created_by', filters.created_by)
    }
    if (filters?.is_hidden !== undefined) {
      query = query.eq('is_hidden', filters.is_hidden)
    } else {
      // Default: show only visible requests (not hidden)
      query = query.eq('is_hidden', false)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  // Get single request by ID
  getById: async (id: string): Promise<Request> => {
    const { data, error} = await supabase
      .from('requests')
      .select(`
        *,
        request_type:request_types(*),
        assigned_user:users!requests_assigned_to_fkey(id, email, full_name, role),
        creator:users!requests_created_by_fkey(id, email, full_name, role),
        customer:customers(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  // Create new request
  create: async (input: CreateRequestInput): Promise<Request> => {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { data: session } = await supabase.auth.getSession()
    if (!session.session) {
      throw new Error('Non autenticato')
    }

    const { data, error } = await supabase
      .from('requests')
      .insert({
        ...input,
        created_by: session.session.user.id,
        status: 'APERTA', // Default status for standard requests
      })
      .select(`
        *,
        request_type:request_types(*),
        creator:users!requests_created_by_fkey(id, email, full_name, role),
        customer:customers(*)
      `)
      .single()

    if (error) {
      // Provide more detailed error messages
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti per creare questa richiesta.')
      }
      if (error.message?.includes('JWT')) {
        throw new Error('Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.')
      }
      throw error
    }

    // Invia notifiche email in background (non blocca se fallisce)
    emailNotificationsApi.notifyRequestCreated(data.id).catch((err) => {
      console.error('Failed to send email notifications for new request:', err)
    })

    return data
  },

  // Update request
  update: async (id: string, updates: UpdateRequestInput): Promise<Request> => {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    // Se viene aggiornato lo stato, recupera lo stato precedente per le notifiche
    let oldStatus: string | undefined
    if (updates.status) {
      const { data: oldData } = await supabase
        .from('requests')
        .select('status')
        .eq('id', id)
        .single()
      oldStatus = oldData?.status
    }

    const { data, error } = await supabase
      .from('requests')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        request_type:request_types(*),
        assigned_user:users!requests_assigned_to_fkey(id, email, full_name, role),
        creator:users!requests_created_by_fkey(id, email, full_name, role),
        customer:customers(*)
      `)
      .single()

    if (error) {
      // Provide more detailed error messages
      if (error.code === 'PGRST116') {
        throw new Error('Richiesta non trovata')
      }
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti per aggiornare questa richiesta.')
      }
      if (error.message?.includes('JWT')) {
        throw new Error('Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.')
      }
      throw error
    }

    // Invia notifiche email se lo stato è cambiato
    if (updates.status && oldStatus && oldStatus !== updates.status) {
      emailNotificationsApi.notifyStatusChange(id, oldStatus, updates.status).catch((err) => {
        console.error('Failed to send email notifications for status change:', err)
      })
    }

    return data
  },

  // Delete request (admin only)
  delete: async (id: string): Promise<void> => {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { error } = await supabase.from('requests').delete().eq('id', id)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono eliminare richieste.')
      }
      if (error.message?.includes('JWT')) {
        throw new Error('Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.')
      }
      throw error
    }
  },

  // Assign request to tecnico
  assign: async (requestId: string, tecnicoId: string): Promise<Request> => {
    return requestsApi.update(requestId, {
      assigned_to: tecnicoId,
      status: 'ASSEGNATA',
    })
  },

  // Update status with validation
  updateStatus: async (
    requestId: string,
    newStatus: RequestStatus | DM329Status
  ): Promise<Request> => {
    return requestsApi.update(requestId, { status: newStatus })
  },

  // Hide request (soft delete, admin only)
  hide: async (id: string): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { error } = await supabase
      .from('requests')
      .update({ is_hidden: true })
      .eq('id', id)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono nascondere richieste.')
      }
      throw error
    }
  },

  // Unhide request (restore from hidden, admin only)
  unhide: async (id: string): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { error } = await supabase
      .from('requests')
      .update({ is_hidden: false })
      .eq('id', id)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono ripristinare richieste.')
      }
      throw error
    }
  },

  // Bulk hide requests (admin only)
  bulkHide: async (ids: string[]): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { error } = await supabase
      .from('requests')
      .update({ is_hidden: true })
      .in('id', ids)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono nascondere richieste.')
      }
      throw error
    }
  },

  // Bulk unhide requests (admin only)
  bulkUnhide: async (ids: string[]): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { error } = await supabase
      .from('requests')
      .update({ is_hidden: false })
      .in('id', ids)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono ripristinare richieste.')
      }
      throw error
    }
  },

  // Bulk delete requests (admin only) - also deletes attachments from storage
  bulkDelete: async (ids: string[]): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    // First, get all attachments for these requests
    const { data: attachments, error: fetchError } = await supabase
      .from('attachments')
      .select('file_path')
      .in('request_id', ids)

    if (fetchError) throw fetchError

    // Delete attachments from storage if any exist
    if (attachments && attachments.length > 0) {
      const filePaths = attachments.map(a => a.file_path)
      const { error: storageError } = await supabase.storage
        .from('request-attachments')
        .remove(filePaths)

      if (storageError) {
        console.error('Error deleting attachments from storage:', storageError)
        // Continue with request deletion even if storage deletion fails
      }
    }

    // Delete requests (cascade will delete attachments records, history, etc.)
    const { error } = await supabase
      .from('requests')
      .delete()
      .in('id', ids)

    if (error) {
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti. Solo gli amministratori possono eliminare richieste.')
      }
      throw error
    }
  },
}
