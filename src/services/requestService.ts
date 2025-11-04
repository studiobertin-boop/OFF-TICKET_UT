import { supabase, ensureValidSession } from './supabase'
import { RequestHistory, RequestBlock, StatusTransitionResult, UserRole } from '@/types'

/**
 * Update request status with validation and history tracking
 */
export async function updateRequestStatus(
  requestId: string,
  newStatus: string,
  userId: string,
  userRole: UserRole,
  notes?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      return {
        success: false,
        message: 'Sessione non valida. Per favore, effettua nuovamente il login.',
      }
    }

    // Get current request to determine request type
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('*, request_type:request_types(*)')
      .eq('id', requestId)
      .single()

    if (requestError) {
      console.error('Request fetch error:', requestError)
      if (requestError.code === 'PGRST116') {
        return { success: false, message: 'Richiesta non trovata' }
      }
      return { success: false, message: `Errore: ${requestError.message}` }
    }

    if (!request) {
      return { success: false, message: 'Richiesta non trovata' }
    }

    const requestTypeName = request.request_type?.name || ''

    // Validate transition using database function
    console.log('Calling validate_status_transition with:', {
      p_request_id: requestId,
      p_new_status: newStatus,
      p_user_role: userRole,
      p_request_type_name: requestTypeName,
    })

    const { data: validation, error: validationError } = await supabase.rpc(
      'validate_status_transition',
      {
        p_request_id: requestId,
        p_new_status: newStatus,
        p_user_role: userRole,
        p_request_type_name: requestTypeName,
      }
    )

    console.log('Validation result:', { validation, validationError })

    if (validationError) {
      console.error('Validation error:', validationError)
      return { success: false, message: `Errore durante la validazione: ${validationError.message}` }
    }

    const result = validation as StatusTransitionResult[]
    if (!result || result.length === 0 || !result[0].valid) {
      return {
        success: false,
        message: result?.[0]?.message || 'Transizione non permessa',
      }
    }

    const currentStatus = request.status

    // Validazione aggiuntiva: ASSEGNATA richiede assigned_to
    if (newStatus === 'ASSEGNATA' && !request.assigned_to) {
      return {
        success: false,
        message: 'Non è possibile impostare lo stato ASSEGNATA senza aver prima assegnato la richiesta a un tecnico.',
      }
    }

    // Update request status
    const { error: updateError } = await supabase
      .from('requests')
      .update({ status: newStatus })
      .eq('id', requestId)

    if (updateError) {
      console.error('Update error:', updateError)
      // Provide more detailed error messages
      if (updateError.code === '42501') {
        return {
          success: false,
          message: 'Permessi insufficienti per aggiornare questa richiesta. Verifica di avere i privilegi necessari.'
        }
      }
      if (updateError.message?.includes('JWT')) {
        return {
          success: false,
          message: 'Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.',
        }
      }
      return { success: false, message: `Errore durante l'aggiornamento dello stato: ${updateError.message}` }
    }

    // Add to history
    const { error: historyError } = await supabase.from('request_history').insert({
      request_id: requestId,
      status_from: currentStatus,
      status_to: newStatus,
      changed_by: userId,
      notes: notes || null,
    })

    if (historyError) {
      console.error('History error:', historyError)
      // Don't fail the whole operation if history fails
    }

    return { success: true, message: 'Stato aggiornato con successo' }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, message: 'Errore imprevisto' }
  }
}

/**
 * Assign request to a technician
 */
export async function assignRequest(
  requestId: string,
  technicianId: string,
  assignedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      return {
        success: false,
        message: 'Sessione non valida. Per favore, effettua nuovamente il login.',
      }
    }

    console.log('Assigning request:', { requestId, technicianId, assignedBy })

    // Get current request
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('status')
      .eq('id', requestId)
      .single()

    if (requestError) {
      console.error('Request fetch error:', requestError)
      if (requestError.code === 'PGRST116') {
        return { success: false, message: 'Richiesta non trovata' }
      }
      return { success: false, message: `Errore: ${requestError.message}` }
    }

    if (!request) {
      return { success: false, message: 'Richiesta non trovata' }
    }

    const currentStatus = request.status

    // Update request with assignment
    const { error: updateError } = await supabase
      .from('requests')
      .update({ assigned_to: technicianId })
      .eq('id', requestId)

    console.log('Assignment update result:', { updateError })

    if (updateError) {
      console.error('Assignment error:', updateError)
      // Provide more detailed error messages
      if (updateError.code === '42501') {
        return {
          success: false,
          message: 'Permessi insufficienti per assegnare questa richiesta. Solo gli amministratori possono effettuare assegnazioni.'
        }
      }
      if (updateError.message?.includes('JWT')) {
        return {
          success: false,
          message: 'Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.',
        }
      }
      return { success: false, message: `Errore durante l'assegnazione: ${updateError.message}` }
    }

    // If status is APERTA, automatically transition to ASSEGNATA
    if (currentStatus === 'APERTA') {
      await updateRequestStatus(requestId, 'ASSEGNATA', assignedBy, 'admin')
    }

    return { success: true, message: 'Richiesta assegnata con successo' }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, message: 'Errore imprevisto' }
  }
}

/**
 * Unassign request from technician
 */
export async function unassignRequest(
  requestId: string,
  _unassignedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { error: updateError } = await supabase
      .from('requests')
      .update({ assigned_to: null })
      .eq('id', requestId)

    if (updateError) {
      console.error('Unassignment error:', updateError)
      return { success: false, message: 'Errore durante la rimozione dell\'assegnazione' }
    }

    return { success: true, message: 'Assegnazione rimossa con successo' }
  } catch (error) {
    console.error('Unexpected error:', error)
    return { success: false, message: 'Errore imprevisto' }
  }
}

/**
 * Get request history
 */
export async function getRequestHistory(requestId: string): Promise<RequestHistory[]> {
  try {
    const { data, error } = await supabase
      .from('request_history')
      .select('*, changed_by_user:users!changed_by(*)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('History fetch error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Unexpected error:', error)
    return []
  }
}

/**
 * Get all technicians for assignment dropdown
 */
export async function getTechnicians() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'tecnico')
      .order('full_name')

    if (error) {
      console.error('Technicians fetch error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Unexpected error:', error)
    return []
  }
}

// =====================================================
// REQUEST BLOCKS API
// =====================================================

/**
 * Get all blocks for a request (active and resolved)
 */
export async function getRequestBlocks(requestId: string): Promise<RequestBlock[]> {
  try {
    const { data, error } = await supabase
      .from('request_blocks')
      .select(`
        *,
        blocked_by_user:users!blocked_by(id, full_name, email),
        unblocked_by_user:users!unblocked_by(id, full_name, email)
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Request blocks fetch error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Unexpected error fetching blocks:', error)
    return []
  }
}

/**
 * Get active block for a request (if any)
 */
export async function getActiveBlock(requestId: string): Promise<RequestBlock | null> {
  try {
    const { data, error } = await supabase
      .from('request_blocks')
      .select(`
        *,
        blocked_by_user:users!blocked_by(id, full_name, email),
        unblocked_by_user:users!unblocked_by(id, full_name, email)
      `)
      .eq('request_id', requestId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No active block found
        return null
      }
      console.error('Active block fetch error:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Unexpected error fetching active block:', error)
    return null
  }
}

/**
 * Block a request with a reason
 */
export async function blockRequest(
  requestId: string,
  blockedBy: string,
  reason: string
): Promise<{ success: boolean; message: string; block?: RequestBlock }> {
  try {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      return {
        success: false,
        message: 'Sessione non valida. Per favore, effettua nuovamente il login.',
      }
    }

    // Check if request is already blocked
    const activeBlock = await getActiveBlock(requestId)
    if (activeBlock) {
      return {
        success: false,
        message: 'La richiesta è già bloccata. Risolvi il blocco esistente prima di crearne uno nuovo.',
      }
    }

    // Create block
    const { data, error } = await supabase
      .from('request_blocks')
      .insert({
        request_id: requestId,
        blocked_by: blockedBy,
        reason: reason,
        is_active: true,
      })
      .select(`
        *,
        blocked_by_user:users!blocked_by(id, full_name, email)
      `)
      .single()

    if (error) {
      console.error('Block creation error:', error)
      if (error.code === '42501') {
        return {
          success: false,
          message: 'Permessi insufficienti per bloccare questa richiesta.',
        }
      }
      if (error.message?.includes('JWT')) {
        return {
          success: false,
          message: 'Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.',
        }
      }
      return {
        success: false,
        message: `Errore durante il blocco della richiesta: ${error.message}`,
      }
    }

    return {
      success: true,
      message: 'Richiesta bloccata con successo. L\'autore riceverà una notifica.',
      block: data,
    }
  } catch (error) {
    console.error('Unexpected error blocking request:', error)
    return { success: false, message: 'Errore imprevisto durante il blocco' }
  }
}

/**
 * Unblock (resolve) a request block
 */
export async function unblockRequest(
  blockId: string,
  unblockedBy: string,
  resolutionNotes?: string
): Promise<{ success: boolean; message: string; block?: RequestBlock }> {
  try {
    // Ensure session is valid before proceeding
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      return {
        success: false,
        message: 'Sessione non valida. Per favore, effettua nuovamente il login.',
      }
    }

    // Update block to resolved
    const { data, error } = await supabase
      .from('request_blocks')
      .update({
        is_active: false,
        unblocked_by: unblockedBy,
        unblocked_at: new Date().toISOString(),
        resolution_notes: resolutionNotes || null,
      })
      .eq('id', blockId)
      .eq('is_active', true) // Only unblock if it's currently active
      .select(`
        *,
        blocked_by_user:users!blocked_by(id, full_name, email),
        unblocked_by_user:users!unblocked_by(id, full_name, email)
      `)
      .single()

    if (error) {
      console.error('Unblock error:', error)
      if (error.code === 'PGRST116') {
        return {
          success: false,
          message: 'Blocco non trovato o già risolto.',
        }
      }
      if (error.code === '42501') {
        return {
          success: false,
          message: 'Permessi insufficienti per sbloccare questa richiesta.',
        }
      }
      if (error.message?.includes('JWT')) {
        return {
          success: false,
          message: 'Sessione scaduta. Ricarica la pagina ed effettua nuovamente il login.',
        }
      }
      return {
        success: false,
        message: `Errore durante lo sblocco della richiesta: ${error.message}`,
      }
    }

    if (!data) {
      return {
        success: false,
        message: 'Blocco non trovato o già risolto.',
      }
    }

    return {
      success: true,
      message: 'Blocco risolto con successo. Il tecnico riceverà una notifica.',
      block: data,
    }
  } catch (error) {
    console.error('Unexpected error unblocking request:', error)
    return { success: false, message: 'Errore imprevisto durante lo sblocco' }
  }
}
