import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryKeys } from '../lib/queryKeys'
import { fetchApiTokens, type ApiToken } from '../lib/queries'

interface UseApiTokensOptions {
  userId: string | null
}

export function useApiTokens({ userId }: UseApiTokensOptions) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Query for fetching tokens (Vercel API - conservative caching)
  const {
    data: tokens = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.apiTokens(userId ?? ''),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      return fetchApiTokens(session.access_token)
    },
    enabled: !!userId,
    // AGGRESSIVE caching for Vercel API - free tier limits
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  // Mutation for creating a token
  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name }),
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to create token')
      }

      // Return the raw token (shown once to user)
      return result.data.token as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens(userId ?? '') })
    },
  })

  // Mutation for deleting a token
  const deleteMutation = useMutation({
    mutationFn: async (tokenId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(`/api/tokens?id=${tokenId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete token')
      }

      return tokenId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiTokens(userId ?? '') })
    },
  })

  // Wrapper functions to maintain backward compatibility
  const createToken = useCallback(
    async (name: string): Promise<string | null> => {
      setError(null)
      try {
        return await createMutation.mutateAsync(name)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create token'
        setError(message)
        return null
      }
    },
    [createMutation]
  )

  const deleteToken = useCallback(
    async (tokenId: string): Promise<boolean> => {
      setDeleting(tokenId)
      setError(null)
      try {
        await deleteMutation.mutateAsync(tokenId)
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete token'
        setError(message)
        return false
      } finally {
        setDeleting(null)
      }
    },
    [deleteMutation]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    tokens,
    loading,
    error,
    creating: createMutation.isPending,
    deleting,
    createToken,
    deleteToken,
    refetch,
    clearError,
  }
}

// Re-export type for convenience
export type { ApiToken }
