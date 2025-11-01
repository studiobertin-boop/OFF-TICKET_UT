import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'off-ticket-ut-auth',
    flowType: 'pkce',
  },
  db: {
    schema: 'public',
  },
  // Rimosso x-application-name per compatibilità con Edge Functions
})

// Export supabase URL for use in edge function calls
export const SUPABASE_URL = supabaseUrl

// Helper function to ensure session is valid before critical operations
export async function ensureValidSession(): Promise<boolean> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Session check error:', error)
      return false
    }

    if (!session) {
      console.warn('No active session found')
      return false
    }

    // Check if session needs refresh (expires in less than 5 minutes)
    const expiresAt = session.expires_at
    if (expiresAt) {
      const expiresInMs = (expiresAt * 1000) - Date.now()
      if (expiresInMs < 5 * 60 * 1000) {
        console.log('Session expiring soon, refreshing...')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError) {
          console.error('Session refresh error:', refreshError)
          return false
        }

        if (!refreshedSession) {
          console.warn('Session refresh failed - no session returned')
          return false
        }

        console.log('Session refreshed successfully')
      }
    }

    return true
  } catch (error) {
    console.error('Unexpected error checking session:', error)
    return false
  }
}
