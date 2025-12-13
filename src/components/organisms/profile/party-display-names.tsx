import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface PartyMembership {
  id: string
  party_id: string
  display_name: string | null
  parties: {
    name: string
  }
}

interface PartyDisplayNamesProps {
  userId: string | null
  globalDisplayName: string
}

export function PartyDisplayNames({ userId, globalDisplayName }: PartyDisplayNamesProps) {
  const queryClient = useQueryClient()
  const [editedNames, setEditedNames] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  // Fetch user's party memberships
  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['party-memberships', userId],
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await supabase
        .from('party_members')
        .select(`
          id,
          party_id,
          display_name,
          parties (
            name
          )
        `)
        .eq('profile_id', userId)

      if (error) throw error

      // Normalize joined data
      return (data ?? []).map((item) => ({
        ...item,
        parties: Array.isArray(item.parties) ? item.parties[0] : item.parties,
      })) as PartyMembership[]
    },
    enabled: !!userId,
  })

  // Reset edited names when memberships change
  useEffect(() => {
    setEditedNames({})
  }, [memberships])

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ memberId, displayName }: { memberId: string; displayName: string | null }) => {
      const { error } = await supabase
        .from('party_members')
        .update({ display_name: displayName })
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      // Invalidate queries that show member names
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['party-memberships'] })
    },
  })

  const handleNameChange = (memberId: string, value: string) => {
    setEditedNames((prev) => ({ ...prev, [memberId]: value }))
  }

  const handleSave = async (membership: PartyMembership) => {
    const editedValue = editedNames[membership.id]
    if (editedValue === undefined) return

    // Empty string means clear the per-party name (use global)
    const newDisplayName = editedValue.trim() || null

    // Don't save if value hasn't actually changed
    if (newDisplayName === membership.display_name) {
      setEditedNames((prev) => {
        const next = { ...prev }
        delete next[membership.id]
        return next
      })
      return
    }

    setSavingId(membership.id)
    try {
      await saveMutation.mutateAsync({ memberId: membership.id, displayName: newDisplayName })
      setEditedNames((prev) => {
        const next = { ...prev }
        delete next[membership.id]
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  const hasChanges = (membership: PartyMembership) => {
    const editedValue = editedNames[membership.id]
    if (editedValue === undefined) return false
    const trimmed = editedValue.trim() || null
    return trimmed !== membership.display_name
  }

  if (!userId) return null
  if (isLoading) return <div className="party-names-loading">Loading parties...</div>
  if (memberships.length === 0) return null

  return (
    <div className="party-names-section">
      <h3>Party Display Names</h3>
      <p className="section-hint">
        Customize how your name appears in each party. Leave blank to use your global display name.
      </p>

      <div className="party-names-list">
        {memberships.map((membership) => {
          const currentValue = editedNames[membership.id] ?? membership.display_name ?? ''
          const isSaving = savingId === membership.id
          const changed = hasChanges(membership)

          return (
            <div key={membership.id} className="party-name-item">
              <label className="profile-label">
                <span>{membership.parties?.name || 'Unknown Party'}</span>
                <div className="party-name-input-row">
                  <input
                    type="text"
                    value={currentValue}
                    onChange={(e) => handleNameChange(membership.id, e.target.value)}
                    placeholder={globalDisplayName || 'Use global name'}
                    className="profile-input"
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    onClick={() => handleSave(membership)}
                    disabled={!changed || isSaving}
                    className="party-name-save-button"
                  >
                    {isSaving ? '...' : 'Save'}
                  </button>
                </div>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}
