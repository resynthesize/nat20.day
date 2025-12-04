import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchPartyAdmins, type AdminInfo } from '../lib/queries'
import { CACHE } from '../lib/constants'

export function usePartyAdminsQuery(partyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partyAdmins(partyId ?? ''),
    queryFn: () => fetchPartyAdmins(partyId!),
    enabled: !!partyId,
    staleTime: CACHE.STALE_TIME_DEFAULT,
  })
}

export function usePromoteToAdmin(partyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profileId: string) => {
      if (!partyId) throw new Error('No party selected')

      const { error } = await supabase.from('party_admins').insert({
        party_id: partyId,
        profile_id: profileId,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partyAdmins(partyId ?? '') })
      // Also invalidate parties since admin status affects the parties list
      queryClient.invalidateQueries({ queryKey: ['parties'] })
    },
  })
}

export function useRemoveAdmin(partyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (profileId: string) => {
      if (!partyId) throw new Error('No party selected')

      const { error } = await supabase
        .from('party_admins')
        .delete()
        .eq('party_id', partyId)
        .eq('profile_id', profileId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partyAdmins(partyId ?? '') })
      // Also invalidate parties since admin status affects the parties list
      queryClient.invalidateQueries({ queryKey: ['parties'] })
    },
  })
}

// Re-export type for convenience
export type { AdminInfo }
