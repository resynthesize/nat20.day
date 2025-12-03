/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { parseParties, type PartyWithAdmins } from '../lib/schemas'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'nat20-current-party'

interface PartyState {
  parties: PartyWithAdmins[]
  currentParty: PartyWithAdmins | null
  loading: boolean
  error: string | null
}

interface PartyContextValue extends PartyState {
  setCurrentParty: (partyId: string) => void
  isAdmin: boolean
  refreshParties: (options?: { selectNewest?: boolean }) => Promise<void>
  createParty: (name: string) => Promise<PartyWithAdmins | null>
}

const PartyContext = createContext<PartyContextValue | null>(null)

function getStoredPartyId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function storePartyId(partyId: string | null): void {
  try {
    if (partyId) {
      localStorage.setItem(STORAGE_KEY, partyId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export function PartyProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()

  const [state, setState] = useState<PartyState>({
    parties: [],
    currentParty: null,
    loading: true,
    error: null,
  })

  const fetchParties = useCallback(async (): Promise<PartyWithAdmins[]> => {
    if (!user) return []

    const { data, error } = await supabase
      .from('parties')
      .select(`
        id,
        name,
        created_at,
        is_demo,
        days_of_week,
        theme,
        party_admins (
          profile_id
        )
      `)
      .eq('is_demo', false)  // Exclude demo parties from user's party list
      .order('name')

    if (error) return []

    return parseParties(data)
  }, [user])

  const refreshParties = useCallback(async (options?: { selectNewest?: boolean }) => {
    if (!isAuthenticated) {
      setState({ parties: [], currentParty: null, loading: false, error: null })
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    const parties = await fetchParties()
    const storedPartyId = getStoredPartyId()

    // Find the current party to select
    let currentParty: PartyWithAdmins | null = null

    if (options?.selectNewest && parties.length > 0) {
      // Select the most recently created party (for post-checkout)
      currentParty = [...parties].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      storePartyId(currentParty.id)
    } else if (storedPartyId) {
      currentParty = parties.find((p) => p.id === storedPartyId) ?? null
    }

    if (!currentParty && parties.length > 0) {
      currentParty = parties[0]
      storePartyId(currentParty.id)
    }

    setState({ parties, currentParty, loading: false, error: null })
  }, [isAuthenticated, fetchParties])

  // Fetch parties when user changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: fetch on mount
    refreshParties()
  }, [refreshParties])

  const setCurrentParty = useCallback((partyId: string) => {
    setState((s) => {
      const party = s.parties.find((p) => p.id === partyId) ?? null
      if (party) {
        storePartyId(partyId)
      }
      return { ...s, currentParty: party }
    })
  }, [])

  const createParty = useCallback(async (name: string): Promise<PartyWithAdmins | null> => {
    if (!user) return null

    // Start a transaction-like operation:
    // 1. Create the party
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .insert({ name })
      .select()
      .single()

    if (partyError || !party) {
      console.error('Error creating party:', partyError)
      return null
    }

    // 2. Add creator as admin
    const { error: adminError } = await supabase
      .from('party_admins')
      .insert({ party_id: party.id, profile_id: user.id })

    if (adminError) {
      console.error('Error adding admin:', adminError)
      // Try to clean up the party
      await supabase.from('parties').delete().eq('id', party.id)
      return null
    }

    // 3. Add creator as member
    const { error: memberError } = await supabase
      .from('party_members')
      .insert({
        party_id: party.id,
        name: user.user_metadata?.full_name || user.email || 'Unknown',
        email: user.email,
        profile_id: user.id,
      })

    if (memberError) {
      console.error('Error adding member:', memberError)
      // Clean up
      await supabase.from('party_admins').delete().eq('party_id', party.id)
      await supabase.from('parties').delete().eq('id', party.id)
      return null
    }

    // Refresh parties and set the new one as current
    const updatedParties = await fetchParties()
    const newParty = updatedParties.find((p) => p.id === party.id) ?? null

    if (newParty) {
      storePartyId(newParty.id)
      setState({
        parties: updatedParties,
        currentParty: newParty,
        loading: false,
        error: null,
      })
    }

    return newParty
  }, [user, fetchParties])

  // Compute isAdmin based on current party and user
  const isAdmin = !!(
    user &&
    state.currentParty &&
    state.currentParty.party_admins.some((admin) => admin.profile_id === user.id)
  )

  const value: PartyContextValue = {
    ...state,
    setCurrentParty,
    isAdmin,
    refreshParties,
    createParty,
  }

  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>
}

export function useParty(): PartyContextValue {
  const context = useContext(PartyContext)
  if (!context) {
    throw new Error('useParty must be used within a PartyProvider')
  }
  return context
}
