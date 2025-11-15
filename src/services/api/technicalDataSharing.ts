/**
 * API for managing DM329 technical data sharing with userDM329 users
 */

import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

export interface SharedUser {
  id: string
  technical_data_id: string
  user_id: string
  user: Pick<User, 'id' | 'full_name' | 'email'>
  shared_by: string
  shared_by_user: Pick<User, 'id' | 'full_name' | 'email'>
  shared_at: string
}

/**
 * Get list of userDM329 users available for sharing
 * Excludes users who are already shared with this technical data
 */
export async function getAvailableUsersForSharing(
  technicalDataId: string
): Promise<Pick<User, 'id' | 'full_name' | 'email'>[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'userdm329')
    .eq('is_suspended', false)
    .not(
      'id',
      'in',
      `(SELECT user_id FROM dm329_technical_data_shared_users WHERE technical_data_id = '${technicalDataId}')`
    )
    .order('full_name')

  if (error) {
    console.error('Error fetching available users:', error)
    throw new Error(`Errore nel recupero degli utenti disponibili: ${error.message}`)
  }

  return data || []
}

/**
 * Get list of users with whom this technical data has been shared
 */
export async function getSharedUsers(technicalDataId: string): Promise<SharedUser[]> {
  const { data, error } = await supabase
    .from('dm329_technical_data_shared_users')
    .select(
      `
      id,
      technical_data_id,
      user_id,
      user:users!dm329_technical_data_shared_users_user_id_fkey(id, full_name, email),
      shared_by,
      shared_by_user:users!dm329_technical_data_shared_users_shared_by_fkey(id, full_name, email),
      shared_at
    `
    )
    .eq('technical_data_id', technicalDataId)
    .order('shared_at', { ascending: false })

  if (error) {
    console.error('Error fetching shared users:', error)
    throw new Error(`Errore nel recupero degli utenti condivisi: ${error.message}`)
  }

  return data || []
}

/**
 * Share technical data with a userDM329 user
 */
export async function shareWithUser(
  technicalDataId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase.from('dm329_technical_data_shared_users').insert({
    technical_data_id: technicalDataId,
    user_id: userId,
    shared_by: (await supabase.auth.getUser()).data.user?.id,
  })

  if (error) {
    console.error('Error sharing with user:', error)

    // Check for unique constraint violation
    if (error.code === '23505') {
      return {
        success: false,
        message: 'Questo utente ha già accesso alla scheda',
      }
    }

    throw new Error(`Errore nella condivisione: ${error.message}`)
  }

  return {
    success: true,
    message: 'Scheda condivisa con successo',
  }
}

/**
 * Remove sharing (revoke access)
 */
export async function removeSharing(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('dm329_technical_data_shared_users')
    .delete()
    .eq('id', shareId)

  if (error) {
    console.error('Error removing sharing:', error)
    throw new Error(`Errore nella rimozione della condivisione: ${error.message}`)
  }
}

/**
 * Check if current user can manage sharing for this technical data
 * (admin, userdm329, or tecnicoDM329 assigned to the request)
 */
export async function canManageSharing(requestId: string): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userError || !userData) return false

  // Admin and userdm329 can always manage
  if (userData.role === 'admin' || userData.role === 'userdm329') {
    return true
  }

  // tecnicoDM329 can manage only if assigned
  if (userData.role === 'tecnicoDM329') {
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('assigned_to')
      .eq('id', requestId)
      .single()

    if (requestError || !request) return false

    return request.assigned_to === user.id
  }

  return false
}
