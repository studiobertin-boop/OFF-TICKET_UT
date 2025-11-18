import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isTecnico: boolean
  isUtente: boolean
  isUserDM329: boolean
  isTecnicoDM329: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  isAdmin: false,
  isTecnico: false,
  isUtente: false,
  isUserDM329: false,
  isTecnicoDM329: false,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.email)

      setSession(session)
      if (session?.user) {
        loadUserProfile(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }

      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully')
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out')
        setUser(null)
        setSession(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Se l'utente non esiste nella tabella users, eseguire logout forzato
        console.error('User profile not found in database:', error)
        await supabase.auth.signOut()
        throw new Error('Profilo utente non trovato. Contattare l\'amministratore.')
      }

      // Verificare se l'utente è sospeso
      if (data.is_suspended) {
        console.error('User is suspended')
        await supabase.auth.signOut()
        throw new Error('Account sospeso. Contattare l\'amministratore.')
      }

      setUser(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
      // Assicurarsi che l'utente sia null e fare logout
      setUser(null)
      setSession(null)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error

    // Wait for user profile to be loaded before returning
    if (data.user) {
      await loadUserProfile(data.user.id)
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setSession(null)
  }

  const isAdmin = user?.role === 'admin'
  const isTecnico = user?.role === 'tecnico'
  const isUtente = user?.role === 'utente'
  const isUserDM329 = user?.role === 'userdm329'
  const isTecnicoDM329 = user?.role === 'tecnicoDM329'

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        isAdmin,
        isTecnico,
        isUtente,
        isUserDM329,
        isTecnicoDM329,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
