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
  signInWithDiscord: () => Promise<void>
  signInWithEmail: (email: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start with loading=true, let Supabase tell us the session state
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
  })

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    // Select only needed columns instead of * for reduced payload
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, created_at')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Auth] fetchProfile error:', error.message)
      return null
    }

    return parseProfile(data)
  }, [])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setState((s) => ({ ...s, user, session, loading: false }))

      if (user) {
        fetchProfile(user.id).then((profile) => {
          setState((s) => ({ ...s, profile }))
        })
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null
      setState((s) => ({ ...s, user, session, loading: false }))

      if (user) {
        // Fetch profile immediately - no need for setTimeout deferral
        fetchProfile(user.id).then((profile) => {
          setState((s) => ({ ...s, profile }))
        })
      } else {
        setState((s) => ({ ...s, profile: null }))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) {
      console.error('Error signing in with Google:', error.message)
      throw error
    }
  }, [])

  const signInWithDiscord = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) {
      console.error('Error signing in with Discord:', error.message)
      throw error
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) {
      console.error('Error sending magic link:', error.message)
      return { success: false, error: error.message }
    }
    return { success: true }
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
    signInWithDiscord,
    signInWithEmail,
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
