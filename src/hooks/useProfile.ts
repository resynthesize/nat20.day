import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface UseProfileOptions {
  userId: string
  onSuccess?: () => void | Promise<void>
}

export function useProfile({ userId, onSuccess }: UseProfileOptions) {
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Invalidate all queries that display profile data (names, avatars, addresses)
  const invalidateProfileDependentQueries = useCallback(() => {
    // Availability queries join party_members with profiles
    queryClient.invalidateQueries({ queryKey: ['availability'] })
    // Sessions may show host names
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    // Party members query
    queryClient.invalidateQueries({ queryKey: ['party'] })
  }, [queryClient])

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!userId) {
        setError('Not authenticated')
        return null
      }

      // Validate file
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return null
      }

      if (file.size > 2 * 1024 * 1024) {
        setError('Image must be less than 2MB')
        return null
      }

      setUploading(true)
      setError(null)

      try {
        // Get file extension
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filePath = `${userId}/avatar.${ext}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type,
          })

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        // Add cache buster to force refresh
        const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

        // Update profile with new avatar URL
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', userId)

        if (updateError) throw updateError

        invalidateProfileDependentQueries()
        await onSuccess?.()
        return avatarUrl
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload avatar'
        setError(message)
        return null
      } finally {
        setUploading(false)
      }
    },
    [userId, onSuccess, invalidateProfileDependentQueries]
  )

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!userId) {
        setError('Not authenticated')
        return false
      }

      if (!displayName.trim()) {
        setError('Display name cannot be empty')
        return false
      }

      setSaving(true)
      setError(null)

      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ display_name: displayName.trim() })
          .eq('id', userId)

        if (updateError) throw updateError

        invalidateProfileDependentQueries()
        await onSuccess?.()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update display name'
        setError(message)
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, onSuccess, invalidateProfileDependentQueries]
  )

  const updateAddress = useCallback(
    async (address: string | null) => {
      if (!userId) {
        setError('Not authenticated')
        return false
      }

      setSaving(true)
      setError(null)

      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ address: address?.trim() || null })
          .eq('id', userId)

        if (updateError) throw updateError

        invalidateProfileDependentQueries()
        await onSuccess?.()
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update address'
        setError(message)
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId, onSuccess, invalidateProfileDependentQueries]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    uploadAvatar,
    updateDisplayName,
    updateAddress,
    uploading,
    saving,
    error,
    clearError,
  }
}
