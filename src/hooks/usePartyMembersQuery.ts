import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchPartyMembers } from '../lib/queries'
import type { PartyMember } from '../lib/schemas'

export function usePartyMembersQuery(partyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.partyMembers(partyId ?? ''),
    queryFn: () => fetchPartyMembers(partyId!),
    enabled: !!partyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useAddPartyMember(partyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, email }: { name: string; email: string | null }) => {
      if (!partyId) throw new Error('No party selected')

      const { error } = await supabase.from('party_members').insert({
        party_id: partyId,
        name,
        email,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partyMembers(partyId ?? '') })
    },
  })
}

export function useRemovePartyMember(partyId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      if (!partyId) throw new Error('No party selected')

      const { error } = await supabase
        .from('party_members')
        .delete()
        .eq('id', memberId)
        .eq('party_id', partyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partyMembers(partyId ?? '') })
    },
  })
}

// Re-export type for convenience
export type { PartyMember }
