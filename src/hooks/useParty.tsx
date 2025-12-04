/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchParties } from '../lib/queries'
import { type PartyWithAdmins } from '../lib/schemas'
import { STORAGE_KEYS, CACHE } from '../lib/constants'
import { useAuth } from './useAuth'

const STORAGE_KEY = STORAGE_KEYS.CURRENT_PARTY

interface PartyContextValue {
  parties: PartyWithAdmins[]
  currentParty: PartyWithAdmins | null
  loading: boolean
  error: string | null
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
  const queryClient = useQueryClient()

  // Local state for current party selection (UI state, not server state)
  const [currentPartyId, setCurrentPartyId] = useState<string | null>(() => getStoredPartyId())

  // TanStack Query for fetching parties (Supabase - no limit concerns)
  const {
    data: parties = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.parties(user?.id ?? ''),
    queryFn: () => fetchParties(user!.id),
    enabled: isAuthenticated && !!user,
    staleTime: CACHE.STALE_TIME_DEFAULT,
  })

  // Compute currentParty from parties list and currentPartyId
  const currentParty = parties.find((p) => p.id === currentPartyId) ?? null

  // When parties load and no currentParty is selected, select the first one
  useEffect(() => {
    if (parties.length === 0) return

    // If current selection is valid, keep it
    if (currentPartyId && parties.some((p) => p.id === currentPartyId)) {
      return
    }

    // Otherwise select first party
    const storedId = getStoredPartyId()
    const partyToSelect = (storedId && parties.find((p) => p.id === storedId)) || parties[0]

    if (partyToSelect) {
      setCurrentPartyId(partyToSelect.id)
      storePartyId(partyToSelect.id)
    }
  }, [parties, currentPartyId])

  // Clear state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentPartyId(null)
    }
  }, [isAuthenticated])

  const setCurrentParty = useCallback((partyId: string) => {
    setCurrentPartyId(partyId)
    storePartyId(partyId)
  }, [])

  // refreshParties wrapper that handles selectNewest option
  const refreshParties = useCallback(async (options?: { selectNewest?: boolean }) => {
    if (!isAuthenticated) {
      setCurrentPartyId(null)
      return
    }

    const result = await refetch()
    const updatedParties = result.data ?? []

    if (options?.selectNewest && updatedParties.length > 0) {
      // Select the most recently created party (for post-checkout)
      const newest = [...updatedParties].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      setCurrentPartyId(newest.id)
      storePartyId(newest.id)
    }
  }, [isAuthenticated, refetch])

  // Create party mutation
  const createPartyMutation = useMutation({
    mutationFn: async (name: string): Promise<PartyWithAdmins | null> => {
      if (!user) return null

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
        await supabase.from('party_admins').delete().eq('party_id', party.id)
        await supabase.from('parties').delete().eq('id', party.id)
        return null
      }

      return party as unknown as PartyWithAdmins
    },
    onSuccess: async (newParty) => {
      // Invalidate and refetch parties
      await queryClient.invalidateQueries({ queryKey: queryKeys.parties(user?.id ?? '') })

      // Set the new party as current
      if (newParty) {
        setCurrentPartyId(newParty.id)
        storePartyId(newParty.id)
      }
    },
  })

  const createParty = useCallback(async (name: string): Promise<PartyWithAdmins | null> => {
    const result = await createPartyMutation.mutateAsync(name)

    // After mutation success, we need to get the full party with admins from the refetched data
    if (result) {
      // The parties query should have been invalidated, wait a tick for it to update
      const latestParties = queryClient.getQueryData<PartyWithAdmins[]>(queryKeys.parties(user?.id ?? ''))
      return latestParties?.find((p) => p.id === result.id) ?? null
    }

    return null
  }, [createPartyMutation, queryClient, user?.id])

  // Compute isAdmin based on current party and user
  const isAdmin = !!(
    user &&
    currentParty &&
    currentParty.party_admins.some((admin) => admin.profile_id === user.id)
  )

  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load parties') : null

  const value: PartyContextValue = {
    parties,
    currentParty,
    loading,
    error,
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
