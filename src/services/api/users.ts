import { supabase } from '../supabase'
import type { User, UserRole } from '../../types'

// Interfaccia per creazione utente
export interface CreateUserData {
  email: string
  password: string
  full_name: string
  role: UserRole
}

// Interfaccia per aggiornamento utente
export interface UpdateUserData {
  full_name?: string
  role?: UserRole
  is_suspended?: boolean
}

// Interfaccia per reset password
export interface ResetPasswordData {
  user_id: string
  new_password: string
}

/**
 * Recupera tutti gli utenti (solo admin)
 */
export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    throw new Error(`Errore nel recupero degli utenti: ${error.message}`)
  }

  return data || []
}

/**
 * Recupera un singolo utente per ID
 */
export async function getUserById(userId: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user:', error)
    throw new Error(`Errore nel recupero dell'utente: ${error.message}`)
  }

  return data
}

/**
 * Crea un nuovo utente tramite Edge Function
 * IMPORTANTE: Usa Edge Function per accesso sicuro all'Admin API
 */
export async function createUser(userData: CreateUserData): Promise<User> {
  try {
    console.log('Calling Edge Function with data:', { ...userData, password: '***' })

    // Ottenere l'utente corrente
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Nessuna sessione attiva. Effettua il login.')
    }

    console.log('Calling user ID:', user.id)

    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'create',
        calling_user_id: user.id,
        email: userData.email,
        password: userData.password,
        full_name: userData.full_name,
        role: userData.role,
      },
    })

    console.log('Edge Function response:', { data, error })

    if (error) {
      console.error('Error creating user:', error)
      throw new Error(`Errore nella creazione dell'utente: ${error.message}`)
    }

    if (!data?.success) {
      const errorMsg = data?.error || 'Errore sconosciuto dalla Edge Function'
      console.error('Edge Function returned error:', errorMsg)
      throw new Error(`Errore nella creazione dell'utente: ${errorMsg}`)
    }

    if (!data?.user) {
      throw new Error('Errore: utente non restituito dalla Edge Function')
    }

    return data.user
  } catch (error) {
    console.error('Unexpected error creating user:', error)
    throw error
  }
}

/**
 * Aggiorna un utente esistente tramite Edge Function
 * IMPORTANTE: Usa Edge Function per garantire permessi admin
 */
export async function updateUser(
  userId: string,
  updates: UpdateUserData
): Promise<User> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nessuna sessione attiva')

    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'update',
        calling_user_id: user.id,
        userId,
        ...updates,
      },
    })

    if (error) {
      console.error('Error updating user:', error)
      throw new Error(`Errore nell'aggiornamento dell'utente: ${error.message}`)
    }

    if (!data?.success || !data?.user) {
      throw new Error(data?.error || 'Errore nell\'aggiornamento dell\'utente')
    }

    return data.user
  } catch (error) {
    console.error('Unexpected error updating user:', error)
    throw error
  }
}

/**
 * Elimina un utente tramite Edge Function
 * IMPORTANTE: Usa Edge Function per accesso sicuro all'Admin API
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nessuna sessione attiva')

    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'delete',
        calling_user_id: user.id,
        userId,
      },
    })

    if (error) {
      console.error('Error deleting user:', error)
      throw new Error(`Errore nell'eliminazione dell'utente: ${error.message}`)
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Errore nell\'eliminazione dell\'utente')
    }
  } catch (error) {
    console.error('Unexpected error deleting user:', error)
    throw error
  }
}

/**
 * Sospende un utente
 */
export async function suspendUser(userId: string): Promise<User> {
  return updateUser(userId, { is_suspended: true })
}

/**
 * Riattiva un utente sospeso
 */
export async function unsuspendUser(userId: string): Promise<User> {
  return updateUser(userId, { is_suspended: false })
}

/**
 * Resetta la password di un utente tramite Edge Function
 * IMPORTANTE: Usa Edge Function per accesso sicuro all'Admin API
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Nessuna sessione attiva')

    const { data, error } = await supabase.functions.invoke('manage-user', {
      body: {
        action: 'reset-password',
        calling_user_id: user.id,
        userId,
        newPassword,
      },
    })

    if (error) {
      console.error('Error resetting password:', error)
      throw new Error(`Errore nel reset della password: ${error.message}`)
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Errore nel reset della password')
    }
  } catch (error) {
    console.error('Unexpected error resetting password:', error)
    throw error
  }
}

/**
 * Recupera tutti i tecnici (per dropdown assegnazioni)
 */
export async function getTechnicians(): Promise<
  Pick<User, 'id' | 'full_name' | 'email'>[]
> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('role', 'tecnico')
    .eq('is_suspended', false)
    .order('full_name')

  if (error) {
    console.error('Error fetching technicians:', error)
    throw new Error(`Errore nel recupero dei tecnici: ${error.message}`)
  }

  return data || []
}
