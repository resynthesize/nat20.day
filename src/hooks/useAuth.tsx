/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { parseProfile, type Profile } from '../lib/schemas'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface StoredSession {
  access_token: string
  refresh_token: string
  expires_at: number
  user: {
    id: string
    email?: string
    app_metadata: Record<string, unknown>
    user_metadata: Record<string, unknown>
    aud: string
    created_at: string
  }
}

function getStoredSession(): { user: User; session: Session } | null {
  try {
    const stored = localStorage.getItem('nat20-auth')
    if (!stored) return null

    const parsed = JSON.parse(stored) as StoredSession
    if (!parsed.user || !parsed.access_token) return null

    // Check if session is expired (with 60s buffer)
    const now = Math.floor(Date.now() / 1000)
    if (parsed.expires_at && parsed.expires_at < now + 60) {
      return null // Session expired, don't use it
    }

    // Reconstruct user and session objects
    const user: User = {
      id: parsed.user.id,
      email: parsed.user.email,
      app_metadata: parsed.user.app_metadata,
      user_metadata: parsed.user.user_metadata,
      aud: parsed.user.aud,
      created_at: parsed.user.created_at,
    } as User

    const session: Session = {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_at: parsed.expires_at,
      expires_in: parsed.expires_at - now,
      token_type: 'bearer',
      user,
    } as Session

    return { user, session }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const cached = getStoredSession()
    if (cached) {
      return {
        user: cached.user,
        profile: null, // Will be fetched in useEffect
        session: cached.session,
        loading: false, // No loading - we have a session
      }
    }
    return {
      user: null,
      profile: null,
      session: null,
      loading: false, // No loading - show login immediately
    }
  })

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return parseProfile(data)
  }, [])

  useEffect(() => {
    // If we have a cached user, fetch their profile immediately
    const cached = getStoredSession()
    if (cached) {
      fetchProfile(cached.user.id).then((profile) => {
        setState((s) => ({ ...s, profile }))
      })
    }

    // Validate/refresh session in background
    // This handles token refresh and ensures session is still valid
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null
      const profile = user ? await fetchProfile(user.id) : null
      setState({ user, profile, session, loading: false })
    }).catch((err) => {
      console.error('Error getting session:', err)
      // On error, clear the invalid session
      setState({ user: null, profile: null, session: null, loading: false })
    })

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null
      const profile = user ? await fetchProfile(user.id) : null
      setState({ user, profile, session, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      console.error('Error signing in:', error.message)
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error.message)
      throw error
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!state.user) return
    const profile = await fetchProfile(state.user.id)
    if (profile) {
      setState((s) => ({ ...s, profile }))
    }
  }, [state.user, fetchProfile])

  const value: AuthContextValue = {
    ...state,
    signInWithGoogle,
    signOut,
    refreshProfile,
    isAuthenticated: !!state.user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
