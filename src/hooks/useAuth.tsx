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
    console.log('[Auth] getStoredSession: localStorage nat20-auth exists?', !!stored)
    if (!stored) return null

    const parsed = JSON.parse(stored) as StoredSession
    if (!parsed.user || !parsed.access_token) {
      console.log('[Auth] getStoredSession: invalid stored data (missing user or token)')
      return null
    }

    // Check if session is expired (with 60s buffer)
    const now = Math.floor(Date.now() / 1000)
    if (parsed.expires_at && parsed.expires_at < now + 60) {
      console.log('[Auth] getStoredSession: session expired', { expires_at: parsed.expires_at, now })
      return null // Session expired, don't use it
    }
    console.log('[Auth] getStoredSession: valid cached session found for user', parsed.user.email)

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
    console.log('[Auth] AuthProvider: initializing state')
    const cached = getStoredSession()
    if (cached) {
      console.log('[Auth] AuthProvider: using cached session', { userId: cached.user.id, email: cached.user.email })
      return {
        user: cached.user,
        profile: null, // Will be fetched in useEffect
        session: cached.session,
        loading: false, // No loading - we have a session
      }
    }
    console.log('[Auth] AuthProvider: no cached session, starting fresh')
    return {
      user: null,
      profile: null,
      session: null,
      loading: false, // No loading - show login immediately
    }
  })

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    console.log('[Auth] fetchProfile: fetching for userId', userId)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Auth] fetchProfile: ERROR', error)
      return null
    }

    console.log('[Auth] fetchProfile: success', data)
    return parseProfile(data)
  }, [])

  useEffect(() => {
    console.log('[Auth] useEffect: starting auth initialization')

    // Debug: Check what's in localStorage right now
    const allKeys = Object.keys(localStorage)
    console.log('[Auth] useEffect: localStorage keys:', allKeys)
    const nat20Auth = localStorage.getItem('nat20-auth')
    console.log('[Auth] useEffect: nat20-auth exists?', !!nat20Auth, nat20Auth ? 'length=' + nat20Auth.length : '')

    // Check for OAuth tokens in URL hash (fallback for detectSessionInUrl)
    const hash = window.location.hash
    console.log('[Auth] useEffect: URL hash present?', !!hash, hash ? `(${hash.length} chars)` : '')

    if (hash && hash.includes('access_token=')) {
      console.log('[Auth] useEffect: Found OAuth tokens in URL, manually exchanging...')

      // Parse tokens from hash
      const params = new URLSearchParams(hash.substring(1))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')

      if (access_token && refresh_token) {
        console.log('[Auth] useEffect: Calling setSession with tokens')
        supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
          if (error) {
            console.error('[Auth] useEffect: setSession ERROR', error)
          } else {
            console.log('[Auth] useEffect: setSession SUCCESS', { userId: data.user?.id })
            // Clear the hash from URL (security - don't leave tokens in address bar)
            window.history.replaceState(null, '', window.location.pathname)
          }
        })
      }
    }

    // If we have a cached user, fetch their profile immediately
    const cached = getStoredSession()
    if (cached) {
      console.log('[Auth] useEffect: fetching profile for cached user')
      fetchProfile(cached.user.id).then((profile) => {
        console.log('[Auth] useEffect: cached user profile fetched', { hasProfile: !!profile })
        setState((s) => ({ ...s, profile }))
      })
    }

    // Use onAuthStateChange as the PRIMARY way to get session
    // IMPORTANT: Callback must NOT be async and must NOT call Supabase functions directly
    // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
    let initialEventReceived = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] onAuthStateChange:', event, { hasSession: !!session, userId: session?.user?.id })

      // Mark that we received the initial event
      if (!initialEventReceived) {
        initialEventReceived = true
        console.log('[Auth] onAuthStateChange: received initial auth event')
      }

      const user = session?.user ?? null

      // Set auth state immediately (without profile)
      setState((s) => ({ ...s, user, session, loading: false }))

      // Defer profile fetch to avoid deadlock (per Supabase docs)
      if (user) {
        setTimeout(() => {
          console.log('[Auth] Deferred: fetching profile for user', user.id)
          fetchProfile(user.id).then((profile) => {
            console.log('[Auth] Deferred: profile fetched', { hasProfile: !!profile })
            setState((s) => ({ ...s, profile }))
          })
        }, 0)
      } else {
        setState((s) => ({ ...s, profile: null }))
      }
    })

    // Fallback: If no auth event received after 3 seconds, assume no session
    const fallbackTimeout = setTimeout(() => {
      if (!initialEventReceived) {
        console.log('[Auth] Fallback: No auth event after 3s, assuming no session')
        setState({ user: null, profile: null, session: null, loading: false })
      }
    }, 3000)

    return () => {
      clearTimeout(fallbackTimeout)
      subscription.unsubscribe()
    }
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
