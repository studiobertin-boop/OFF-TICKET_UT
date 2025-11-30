import { supabase, ensureValidSession } from '../supabase'
import { Request, RequestStatus, DM329Status, StatoFattura, ExportFilters, ExportRequestData } from '@/types'
import { emailNotificationsApi } from './emailNotifications'
import { formatDateForExcel } from '../excelService'
import { getStatusLabel } from '@/utils/workflow'

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
  is_urgent?: boolean
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

    // Determina il tipo di richiesta per impostare lo stato iniziale corretto
    const { data: requestType } = await supabase
      .from('request_types')
      .select('name')
      .eq('id', input.request_type_id)
      .single()

    // Per DM329: stato iniziale è '1-INCARICO_RICEVUTO', per altri tipi: 'APERTA'
    const initialStatus = requestType?.name === 'DM329' ? '1-INCARICO_RICEVUTO' : 'APERTA'

    const { data, error } = await supabase
      .from('requests')
      .insert({
        ...input,
        created_by: session.session.user.id,
        status: initialStatus,
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

    // CRITICAL DEBUG: Log BEFORE email notification call
    console.log('[REQUEST_CREATE] Request created successfully, ID:', data.id)
    console.log('[REQUEST_CREATE] About to call emailNotificationsApi.notifyRequestCreated')
    console.log('[REQUEST_CREATE] emailNotificationsApi object:', emailNotificationsApi)
    console.log('[REQUEST_CREATE] notifyRequestCreated function:', emailNotificationsApi.notifyRequestCreated)

    // Invia notifiche email in background (non blocca se fallisce)
    // IMPORTANTE: usiamo void per indicare che ignoriamo intenzionalmente la Promise
    // ma la Promise DEVE essere eseguita
    try {
      console.log('[REQUEST_CREATE] Calling notifyRequestCreated with ID:', data.id)
      const emailPromise = emailNotificationsApi.notifyRequestCreated(data.id)
      console.log('[REQUEST_CREATE] Promise created:', emailPromise)

      // Assicuriamo che la Promise venga eseguita anche se non aspettiamo il risultato
      void emailPromise.then(
        () => console.log('[REQUEST_CREATE] Email notification completed successfully'),
        (err) => console.error('[REQUEST_CREATE] Failed to send email notifications for new request:', err)
      )
    } catch (syncError) {
      console.error('[REQUEST_CREATE] SYNCHRONOUS ERROR calling email notification:', syncError)
    }

    console.log('[REQUEST_CREATE] Returning request data')
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
        .from('attachments')
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

  // Toggle urgent flag
  toggleUrgent: async (id: string, isUrgent: boolean): Promise<Request> => {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    const { data, error } = await supabase
      .from('requests')
      .update({ is_urgent: isUrgent })
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
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti per modificare lo stato urgente di questa richiesta.')
      }
      throw error
    }

    return data
  },

  // Update a single custom field (for inline editing)
  updateCustomField: async (
    id: string,
    fieldName: string,
    fieldValue: any
  ): Promise<Request> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida. Per favore, effettua nuovamente il login.')
    }

    // Fetch current custom_fields
    const { data: current, error: fetchError } = await supabase
      .from('requests')
      .select('custom_fields')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    // Merge update
    const updatedFields = {
      ...current.custom_fields,
      [fieldName]: fieldValue
    }

    // Update request
    const { data, error } = await supabase
      .from('requests')
      .update({ custom_fields: updatedFields })
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
      if (error.code === '42501') {
        throw new Error('Permessi insufficienti per modificare questo campo.')
      }
      throw error
    }

    return data
  },

  // Bulk update stato_fattura for multiple requests
  bulkUpdateStatoFattura: async (
    ids: string[],
    statoFattura: StatoFattura
  ): Promise<void> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida.')
    }

    // Validate if setting to "SI"
    if (statoFattura === 'SI') {
      const { data: requests, error: fetchError } = await supabase
        .from('requests')
        .select('id, status')
        .in('id', ids)

      if (fetchError) throw fetchError

      const invalidRequests = requests.filter(
        r => r.status !== '7-CHIUSA' && r.status !== 'ARCHIVIATA NON FINITA'
      )

      if (invalidRequests.length > 0) {
        throw new Error(
          `${invalidRequests.length} richiesta/e non possono essere impostate a "Sì" (stato non valido)`
        )
      }
    }

    // Fetch all requests to merge custom_fields
    const { data: requests, error: fetchError } = await supabase
      .from('requests')
      .select('id, custom_fields')
      .in('id', ids)

    if (fetchError) throw fetchError

    // Update in parallel
    const updatePromises = requests.map(req =>
      supabase
        .from('requests')
        .update({
          custom_fields: {
            ...req.custom_fields,
            stato_fattura: statoFattura
          }
        })
        .eq('id', req.id)
    )

    const results = await Promise.all(updatePromises)

    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      throw new Error(`Errore nell'aggiornamento di ${errors.length} richiesta/e`)
    }
  },

  // Get requests for export with date and status filters
  getForExport: async (
    filters: ExportFilters,
    requestTypeId?: string
  ): Promise<ExportRequestData[]> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida.')
    }

    console.log('Calling get_requests_for_export with params:', {
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_statuses: filters.statuses,
      p_request_type_id: requestTypeId || null
    })

    // Query per ottenere le richieste che hanno raggiunto gli stati selezionati nel periodo specificato
    // Usa una subquery per trovare l'ultima volta che ogni richiesta è entrata in uno degli stati selezionati
    const { data, error } = await supabase.rpc('get_requests_for_export', {
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_statuses: filters.statuses,
      p_request_type_id: requestTypeId || null
    })

    if (error) {
      console.error('Error fetching export data:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw new Error(`Errore nel recupero dati export: ${error.message || 'Errore sconosciuto'}`)
    }

    console.log('Export data received:', data?.length || 0, 'records')

    // Trasforma i dati nel formato richiesto
    const exportData: ExportRequestData[] = (data || []).map((row: any) => {
      const nomeCliente = row.customer_ragione_sociale ||
                         (typeof row.custom_fields?.cliente === 'string'
                           ? row.custom_fields.cliente
                           : row.custom_fields?.cliente?.ragione_sociale) ||
                         'Non specificato'

      return {
        nomeCliente,
        dataImpostazioneStato: formatDateForExcel(row.status_change_date),
        statoImpostato: getStatusLabel(row.status_to),
        tipoRichiesta: row.request_type_name || 'Non specificato',
        noCiva: row.custom_fields?.no_civa || false,
        offCac: row.custom_fields?.off_cac || '',
        note: row.custom_fields?.note || '',
      }
    })

    return exportData
  },

  // Preview count for export
  getExportPreviewCount: async (
    filters: ExportFilters,
    requestTypeId?: string
  ): Promise<number> => {
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      throw new Error('Sessione non valida.')
    }

    const { data, error } = await supabase.rpc('get_requests_for_export', {
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_statuses: filters.statuses,
      p_request_type_id: requestTypeId || null
    })

    if (error) throw error
    return data?.length || 0
  },
}
