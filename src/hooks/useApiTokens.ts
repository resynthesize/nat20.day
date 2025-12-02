import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ApiToken {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
}

interface UseApiTokensOptions {
  userId: string | null
}

export function useApiTokens({ userId }: UseApiTokensOptions) {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Fetch tokens on mount
  const fetchTokens = useCallback(async () => {
    if (!userId) {
      setTokens([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch('/api/tokens', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch tokens')
      }

      setTokens(result.data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tokens'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchTokens()
  }, [fetchTokens])

  // Create a new token
  const createToken = useCallback(
    async (name: string): Promise<string | null> => {
      setCreating(true)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

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

        // Refresh the list
        await fetchTokens()

        // Return the raw token (shown once to user)
        return result.data.token
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create token'
        setError(message)
        return null
      } finally {
        setCreating(false)
      }
    },
    [fetchTokens]
  )

  // Delete a token
  const deleteToken = useCallback(
    async (tokenId: string): Promise<boolean> => {
      setDeleting(tokenId)
      setError(null)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Not authenticated')
        }

        const response = await fetch(`/api/tokens/${tokenId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete token')
        }

        // Refresh the list
        await fetchTokens()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete token'
        setError(message)
        return false
      } finally {
        setDeleting(null)
      }
    },
    [fetchTokens]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    tokens,
    loading,
    error,
    creating,
    deleting,
    createToken,
    deleteToken,
    refetch: fetchTokens,
    clearError,
  }
}
