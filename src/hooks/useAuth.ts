import { useState, useEffect, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
}

function hasStoredSession(): boolean {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    return !!key && !!localStorage.getItem(key)
  } catch {
    return false
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: hasStoredSession(), // Only show loading if there might be a stored session
  })

  const fetchProfile = useCallback(async (userId: string) => {
    // Profile is created automatically by DB trigger on signup
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data as Profile | null
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setState((s) => {
        if (s.loading) return { ...s, loading: false }
        return s
      })
    }, 2000) // Max wait time for session check

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout)
      const user = session?.user ?? null
      const profile = user ? await fetchProfile(user.id) : null
      setState({ user, profile, session, loading: false })
    }).catch((err) => {
      clearTimeout(timeout)
      console.error('Error getting session:', err)
      setState((s) => ({ ...s, loading: false }))
    })

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

  return {
    ...state,
    signInWithGoogle,
    signOut,
    isAuthenticated: !!state.user,
  }
}
