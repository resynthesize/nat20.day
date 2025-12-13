import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useParty } from '@/hooks/useParty'
import { useAuth } from '@/hooks/useAuth'
import { usePartyMembersQuery, useAddPartyMember, useRemovePartyMember } from '@/hooks/usePartyMembersQuery'
import { usePartyAdminsQuery, usePromoteToAdmin, useRemoveAdmin } from '@/hooks/usePartyAdminsQuery'
import { useSubscriptionQuery, useCancelSubscription, useReactivateSubscription } from '@/hooks/useSubscriptionQuery'
import { getDisplayName } from '@/lib/display-name'
import { UpdatePaymentModal } from './update-payment-modal'
import { ThemeSelector } from './theme-selector'
import { TimePresetsSelector } from './time-presets-selector'
import { SkeletonBox } from '@/components/organisms/shared/skeleton'
import { Select } from '@/components/ui/select'

type TabType = 'members' | 'settings' | 'billing'

const DAY_LABELS = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
]

export function AdminPanel() {
  const { currentParty, isAdmin, refreshParties } = useParty()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Invalidate queries that depend on party settings (days_of_week, etc.)
  const invalidatePartyDependentQueries = useCallback(() => {
    if (currentParty?.id) {
      // Availability uses days_of_week to generate dates
      queryClient.invalidateQueries({ queryKey: ['availability', currentParty.id] })
      // Sessions may also be affected
      queryClient.invalidateQueries({ queryKey: ['sessions', currentParty.id] })
    }
  }, [queryClient, currentParty?.id])

  const [activeTab, setActiveTab] = useState<TabType>('members')
  const [error, setError] = useState<string | null>(null)

  // TanStack Query hooks for data fetching (cached!)
  const { data: members = [], isLoading: loadingMembers } = usePartyMembersQuery(currentParty?.id)
  const { data: admins = [], isLoading: loadingAdmins } = usePartyAdminsQuery(currentParty?.id)
  const { data: subscription, isLoading: loadingSubscription, refetch: refetchSubscription } = useSubscriptionQuery(
    currentParty?.id,
    { enabled: activeTab === 'billing' }
  )

  // Mutations
  const addMemberMutation = useAddPartyMember(currentParty?.id)
  const removeMemberMutation = useRemovePartyMember(currentParty?.id)
  const promoteToAdminMutation = usePromoteToAdmin(currentParty?.id)
  const removeAdminMutation = useRemoveAdmin(currentParty?.id)
  const cancelSubscriptionMutation = useCancelSubscription(currentParty?.id)
  const reactivateSubscriptionMutation = useReactivateSubscription(currentParty?.id)

  // Combined loading state for initial data
  const loading = loadingMembers || loadingAdmins

  // Add member form
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')

  // Edit party name
  const [partyName, setPartyName] = useState(currentParty?.name || '')
  const [savingName, setSavingName] = useState(false)

  // Days of week selection
  const [selectedDays, setSelectedDays] = useState<number[]>(
    currentParty?.days_of_week ?? [5, 6]
  )
  const [savingDays, setSavingDays] = useState(false)

  // Default host settings
  const [defaultHostType, setDefaultHostType] = useState<'none' | 'member' | 'location'>('none')
  const [defaultHostMemberId, setDefaultHostMemberId] = useState<string>('')
  const [defaultHostLocation, setDefaultHostLocation] = useState<string>('')
  const [savingHost, setSavingHost] = useState(false)

  // Billing UI state
  const [openingPortal, setOpeningPortal] = useState(false)
  const [showUpdatePayment, setShowUpdatePayment] = useState(false)
  const [setupIntentSecret, setSetupIntentSecret] = useState<string | null>(null)

  // Delete party state
  const [deletingParty, setDeletingParty] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  // Inline display name editing
  const [editingDisplayNameId, setEditingDisplayNameId] = useState<string | null>(null)
  const [editedDisplayName, setEditedDisplayName] = useState('')
  const [savingDisplayName, setSavingDisplayName] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/')
    }
  }, [isAdmin, loading, navigate])

  // Sync form state with currentParty changes
  useEffect(() => {
    setPartyName(currentParty?.name || '')
    setSelectedDays(currentParty?.days_of_week ?? [5, 6])

    // Sync host settings
    if (currentParty?.default_host_member_id) {
      setDefaultHostType('member')
      setDefaultHostMemberId(currentParty.default_host_member_id)
      setDefaultHostLocation('')
    } else if (currentParty?.default_host_location) {
      setDefaultHostType('location')
      setDefaultHostMemberId('')
      setDefaultHostLocation(currentParty.default_host_location)
    } else {
      setDefaultHostType('none')
      setDefaultHostMemberId('')
      setDefaultHostLocation('')
    }
  }, [currentParty?.name, currentParty?.days_of_week, currentParty?.default_host_member_id, currentParty?.default_host_location])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentParty) return

    const trimmedName = newMemberName.trim()
    const trimmedEmail = newMemberEmail.trim().toLowerCase() || null

    if (!trimmedName) {
      setError('Member name is required')
      return
    }

    if (trimmedEmail && !trimmedEmail.includes('@')) {
      setError('Invalid email format')
      return
    }

    setError(null)

    try {
      await addMemberMutation.mutateAsync({ name: trimmedName, email: trimmedEmail })
      setNewMemberName('')
      setNewMemberEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!currentParty) return
    if (!confirm(`Remove ${memberName} from the party?`)) return

    try {
      await removeMemberMutation.mutateAsync(memberId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handlePromoteToAdmin = async (profileId: string) => {
    if (!currentParty) return

    try {
      await promoteToAdminMutation.mutateAsync(profileId)
      await refreshParties()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote to admin')
    }
  }

  const handleRemoveAdmin = async (profileId: string) => {
    if (!currentParty) return

    if (admins.length <= 1) {
      setError('Cannot remove the last admin. Promote another member first.')
      return
    }

    try {
      await removeAdminMutation.mutateAsync(profileId)
      await refreshParties()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin')
    }
  }

  const handleSavePartyName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentParty) return

    const trimmedName = partyName.trim()
    if (!trimmedName) {
      setError('Party name is required')
      return
    }

    if (trimmedName === currentParty.name) return

    setSavingName(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('parties')
        .update({ name: trimmedName })
        .eq('id', currentParty.id)

      if (updateError) throw updateError
      await refreshParties()
      invalidatePartyDependentQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update party name')
    } finally {
      setSavingName(false)
    }
  }

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        // Don't allow removing last day
        if (prev.length === 1) return prev
        return prev.filter((d) => d !== day)
      }
      return [...prev, day].sort((a, b) => a - b)
    })
  }

  const handleSaveDays = async () => {
    if (!currentParty || selectedDays.length === 0) return

    setSavingDays(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('parties')
        .update({ days_of_week: selectedDays })
        .eq('id', currentParty.id)

      if (updateError) throw updateError
      await refreshParties()
      invalidatePartyDependentQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update schedule days')
    } finally {
      setSavingDays(false)
    }
  }

  const arraysEqual = (a: number[], b: number[]) => {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort((x, y) => x - y)
    const sortedB = [...b].sort((x, y) => x - y)
    return sortedA.every((val, idx) => val === sortedB[idx])
  }

  const handleSaveDefaultHost = async () => {
    if (!currentParty) return

    setSavingHost(true)
    setError(null)

    try {
      const updates: { default_host_member_id: string | null; default_host_location: string | null } = {
        default_host_member_id: null,
        default_host_location: null,
      }

      if (defaultHostType === 'member' && defaultHostMemberId) {
        updates.default_host_member_id = defaultHostMemberId
      } else if (defaultHostType === 'location' && defaultHostLocation.trim()) {
        updates.default_host_location = defaultHostLocation.trim()
      }

      const { error: updateError } = await supabase
        .from('parties')
        .update(updates)
        .eq('id', currentParty.id)

      if (updateError) throw updateError
      await refreshParties()
      invalidatePartyDependentQueries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update default host')
    } finally {
      setSavingHost(false)
    }
  }

  const hasHostChanges = () => {
    if (!currentParty) return false

    if (defaultHostType === 'none') {
      return !!(currentParty.default_host_member_id || currentParty.default_host_location)
    }
    if (defaultHostType === 'member') {
      return defaultHostMemberId !== (currentParty.default_host_member_id || '')
    }
    if (defaultHostType === 'location') {
      return defaultHostLocation.trim() !== (currentParty.default_host_location || '')
    }
    return false
  }

  const isUserAdmin = (profileId: string) => admins.some((a) => a.profile_id === profileId)

  const handleStartEditDisplayName = (memberId: string, currentDisplayName: string | null) => {
    setEditingDisplayNameId(memberId)
    setEditedDisplayName(currentDisplayName ?? '')
  }

  const handleCancelEditDisplayName = () => {
    setEditingDisplayNameId(null)
    setEditedDisplayName('')
  }

  const handleSaveDisplayName = async (memberId: string) => {
    if (!currentParty) return

    setSavingDisplayName(true)
    setError(null)

    try {
      const newDisplayName = editedDisplayName.trim() || null
      const { error: updateError } = await supabase
        .from('party_members')
        .update({ display_name: newDisplayName })
        .eq('id', memberId)

      if (updateError) throw updateError

      // Invalidate queries that show member names
      queryClient.invalidateQueries({ queryKey: ['party-members'] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })

      setEditingDisplayNameId(null)
      setEditedDisplayName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update display name')
    } finally {
      setSavingDisplayName(false)
    }
  }

  const handleDeleteParty = async () => {
    if (!currentParty) return

    setDeletingParty(true)
    setError(null)

    try {
      // Soft delete via RPC function
      const { error: deleteError } = await supabase.rpc('soft_delete_party', {
        p_party_id: currentParty.id,
      })

      if (deleteError) throw deleteError

      // Refresh parties - this will exclude the deleted party
      // The useParty hook will auto-select another party if available
      await refreshParties()

      // Close the modal and navigate away
      setShowDeleteConfirm(false)
      setDeleteConfirmName('')
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete party')
    } finally {
      setDeletingParty(false)
    }
  }

  const handleOpenBillingPortal = async () => {
    if (!currentParty) return

    setOpeningPortal(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('You must be logged in to manage billing')
        return
      }

      const response = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ party_id: currentParty.id }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to open billing portal')
      }

      const { portal_url } = await response.json()
      window.location.href = portal_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open billing portal')
      setOpeningPortal(false)
    }
  }

  const handleUpdatePaymentMethod = async () => {
    if (!currentParty) return

    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('You must be logged in')
        return
      }

      const response = await fetch('/api/v1/billing/setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ party_id: currentParty.id }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to create setup intent')
      }

      const { client_secret } = await response.json()
      setSetupIntentSecret(client_secret)
      setShowUpdatePayment(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment method')
    }
  }

  const handleCancelSubscription = async () => {
    if (!currentParty) return
    if (!confirm('Are you sure you want to cancel? Your party will remain active until the end of the billing period.')) {
      return
    }

    setError(null)

    try {
      await cancelSubscriptionMutation.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription')
    }
  }

  const handleReactivateSubscription = async () => {
    if (!currentParty) return

    setError(null)

    try {
      await reactivateSubscriptionMutation.mutateAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription')
    }
  }

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active'
      case 'past_due': return 'Past Due'
      case 'canceled': return 'Canceled'
      case 'expired': return 'Expired'
      default: return status
    }
  }

  if (!currentParty) {
    return (
      <div className="admin-panel">
        <p className="error">No party selected</p>
        <Link to="/app" className="back-link">← Back to Schedule</Link>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <Link to="/app" className="back-link">← Back to Schedule</Link>
        <h2>Party Settings</h2>
        <p className="admin-subtitle">{currentParty.name}</p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          Members
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          Billing
        </button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : activeTab === 'members' ? (
          <div className="members-tab">
            <form onSubmit={handleAddMember} className="add-member-form">
              <h3>Add Member</h3>
              <div className="form-row">
                <input
                  type="text"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Name"
                  className="form-input"
                  disabled={addMemberMutation.isPending}
                />
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="form-input"
                  disabled={addMemberMutation.isPending}
                />
                <button
                  type="submit"
                  className="form-button"
                  disabled={addMemberMutation.isPending || !newMemberName.trim()}
                >
                  {addMemberMutation.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
              <p className="form-hint">
                Email is optional but required for members to log in and manage their availability.
              </p>
            </form>

            <div className="members-list">
              <h3>Party Members ({members.length})</h3>
              {members.map((member) => {
                const isEditingThisMember = editingDisplayNameId === member.id
                const effectiveDisplayName = getDisplayName(member)
                const hasCustomDisplayName = !!member.display_name

                return (
                  <div key={member.id} className="member-item">
                    <div className="member-info">
                      {member.profiles?.avatar_url ? (
                        <img
                          src={member.profiles.avatar_url}
                          alt={member.name}
                          className="member-avatar"
                        />
                      ) : (
                        <div className="member-avatar-placeholder">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="member-details">
                        <div className="member-name-row">
                          {isEditingThisMember ? (
                            <div className="display-name-edit">
                              <input
                                type="text"
                                value={editedDisplayName}
                                onChange={(e) => setEditedDisplayName(e.target.value)}
                                placeholder={member.profiles?.display_name || member.name}
                                className="display-name-input"
                                disabled={savingDisplayName}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveDisplayName(member.id)
                                  if (e.key === 'Escape') handleCancelEditDisplayName()
                                }}
                              />
                              <button
                                type="button"
                                className="display-name-save"
                                onClick={() => handleSaveDisplayName(member.id)}
                                disabled={savingDisplayName}
                                title="Save"
                              >
                                {savingDisplayName ? '...' : '✓'}
                              </button>
                              <button
                                type="button"
                                className="display-name-cancel"
                                onClick={handleCancelEditDisplayName}
                                disabled={savingDisplayName}
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="member-name">{effectiveDisplayName}</span>
                              {hasCustomDisplayName && (
                                <span className="member-original-name">({member.name})</span>
                              )}
                              <button
                                type="button"
                                className="display-name-edit-btn"
                                onClick={() => handleStartEditDisplayName(member.id, member.display_name ?? null)}
                                title="Edit display name for this party"
                              >
                                ✎
                              </button>
                            </>
                          )}
                        </div>
                        {member.email && (
                          <span className="member-email">{member.email}</span>
                        )}
                        {member.profile_id && isUserAdmin(member.profile_id) && (
                          <span className="member-admin-badge">Admin</span>
                        )}
                        {!member.profile_id && (
                          <span className="member-pending">Not linked</span>
                        )}
                      </div>
                    </div>
                    <div className="member-actions">
                      {member.profile_id && !isUserAdmin(member.profile_id) && (
                        <button
                          type="button"
                          className="action-button promote"
                          onClick={() => handlePromoteToAdmin(member.profile_id!)}
                        >
                          Make Admin
                        </button>
                      )}
                      {member.profile_id && isUserAdmin(member.profile_id) && member.profile_id !== user?.id && (
                        <button
                          type="button"
                          className="action-button demote"
                          onClick={() => handleRemoveAdmin(member.profile_id!)}
                        >
                          Remove Admin
                        </button>
                      )}
                      {member.profile_id !== user?.id && (
                        <button
                          type="button"
                          className="action-button remove"
                          onClick={() => handleRemoveMember(member.id, member.name)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="settings-tab">
            <form onSubmit={handleSavePartyName} className="settings-form">
              <h3>Party Name</h3>
              <div className="form-row">
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Party name"
                  className="form-input"
                  disabled={savingName}
                  maxLength={100}
                />
                <button
                  type="submit"
                  className="form-button"
                  disabled={savingName || !partyName.trim() || partyName.trim() === currentParty.name}
                >
                  {savingName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>

            <div className="days-settings">
              <h3>Schedule Days</h3>
              <p className="form-hint">
                Select which days of the week to show in the availability grid.
              </p>
              <div className="days-selector">
                {DAY_LABELS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={`day-toggle ${selectedDays.includes(day.value) ? 'selected' : ''}`}
                    onClick={() => handleDayToggle(day.value)}
                    title={day.fullLabel}
                    disabled={savingDays}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="form-button"
                onClick={handleSaveDays}
                disabled={
                  savingDays ||
                  selectedDays.length === 0 ||
                  arraysEqual(selectedDays, currentParty?.days_of_week ?? [5, 6])
                }
              >
                {savingDays ? 'Saving...' : 'Save Schedule Days'}
              </button>
            </div>

            <TimePresetsSelector />

            <ThemeSelector />

            <div className="hosting-settings">
              <h3>Default Host</h3>
              <p className="form-hint">
                Set a default host for sessions. This will be pre-selected when scheduling new sessions.
              </p>
              <div className="host-type-selector">
                <label className="host-type-option">
                  <input
                    type="radio"
                    name="hostType"
                    value="none"
                    checked={defaultHostType === 'none'}
                    onChange={() => setDefaultHostType('none')}
                    disabled={savingHost}
                  />
                  <span>No default</span>
                </label>
                <label className="host-type-option">
                  <input
                    type="radio"
                    name="hostType"
                    value="member"
                    checked={defaultHostType === 'member'}
                    onChange={() => setDefaultHostType('member')}
                    disabled={savingHost}
                  />
                  <span>Party Member</span>
                </label>
                <label className="host-type-option">
                  <input
                    type="radio"
                    name="hostType"
                    value="location"
                    checked={defaultHostType === 'location'}
                    onChange={() => setDefaultHostType('location')}
                    disabled={savingHost}
                  />
                  <span>Custom Location</span>
                </label>
              </div>

              <div className="host-input-row">
                {defaultHostType === 'member' && (
                  <Select
                    value={defaultHostMemberId}
                    onChange={setDefaultHostMemberId}
                    placeholder="Select a member..."
                    className="host-select"
                    options={members.map((member) => ({
                      value: member.id,
                      label: getDisplayName(member),
                    }))}
                  />
                )}

                {defaultHostType === 'location' && (
                  <input
                    type="text"
                    value={defaultHostLocation}
                    onChange={(e) => setDefaultHostLocation(e.target.value)}
                    placeholder="e.g., Game Store, Zoom, Discord"
                    className="form-input host-location-input"
                    disabled={savingHost}
                  />
                )}

                <button
                  type="button"
                  className="form-button"
                  onClick={handleSaveDefaultHost}
                  disabled={savingHost || !hasHostChanges()}
                >
                  {savingHost ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div className="admin-list">
              <h3>Party Admins ({admins.length})</h3>
              {admins.map((admin) => (
                <div key={admin.profile_id} className="admin-item">
                  <div className="admin-info">
                    {admin.profiles?.avatar_url ? (
                      <img
                        src={admin.profiles.avatar_url}
                        alt={admin.profiles.display_name}
                        className="member-avatar"
                      />
                    ) : (
                      <div className="member-avatar-placeholder">
                        {(admin.profiles?.display_name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="admin-name">
                      {admin.profiles?.display_name || 'Unknown'}
                      {admin.profile_id === user?.id && <span className="you-badge"> (you)</span>}
                    </span>
                  </div>
                  {admin.profile_id !== user?.id && admins.length > 1 && (
                    <button
                      type="button"
                      className="action-button demote"
                      onClick={() => handleRemoveAdmin(admin.profile_id)}
                    >
                      Remove Admin
                    </button>
                  )}
                </div>
              ))}
            </div>

            {currentParty.created_by === user?.id && (
              <div className="danger-zone">
                <h3>Danger Zone</h3>
                <div className="danger-zone-content">
                  {!showDeleteConfirm ? (
                    <div className="danger-zone-item">
                      <div className="danger-zone-info">
                        <span className="danger-zone-title">Delete this party</span>
                        <span className="danger-zone-description">
                          Once deleted, all members and availability data will be hidden. This can be undone later.
                        </span>
                      </div>
                      <button
                        type="button"
                        className="action-button danger"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        Delete Party
                      </button>
                    </div>
                  ) : (
                    <div className="delete-confirm-inline">
                      <p className="delete-confirm-prompt">
                        Type <strong>{currentParty.name}</strong> to confirm deletion:
                      </p>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        placeholder={currentParty.name}
                        className="form-input"
                        autoFocus
                      />
                      <p className="delete-confirm-warning">
                        All party members and availability data will be hidden. You can contact support to restore the party later.
                      </p>
                      <div className="delete-confirm-actions">
                        <button
                          type="button"
                          className="form-button secondary"
                          onClick={() => {
                            setShowDeleteConfirm(false)
                            setDeleteConfirmName('')
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="action-button danger"
                          onClick={handleDeleteParty}
                          disabled={deletingParty || deleteConfirmName !== currentParty.name}
                        >
                          {deletingParty ? 'Deleting...' : 'Delete Party'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="billing-tab">
            {loadingSubscription ? (
              <div className="subscription-card">
                <div className="subscription-header">
                  <SkeletonBox width={160} height={24} />
                  <SkeletonBox width={70} height={24} style={{ borderRadius: 'var(--radius-sm)' }} />
                </div>
                <div className="subscription-details">
                  <div className="subscription-detail">
                    <SkeletonBox width={40} height={14} />
                    <SkeletonBox width={60} height={16} />
                  </div>
                  <div className="subscription-detail">
                    <SkeletonBox width={50} height={14} />
                    <SkeletonBox width={120} height={16} />
                  </div>
                </div>
                <div className="billing-actions">
                  <SkeletonBox width="100%" height={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                  <SkeletonBox width="100%" height={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                  <SkeletonBox width="100%" height={40} style={{ borderRadius: 'var(--radius-sm)' }} />
                </div>
              </div>
            ) : subscription ? (
              <>
                <div className="subscription-card">
                  <div className="subscription-header">
                    <h3>Subscription Status</h3>
                    <span className={`subscription-status subscription-${subscription.status}`}>
                      {getStatusLabel(subscription.status)}
                    </span>
                  </div>

                  {subscription.id === 'demo' ? (
                    <p className="subscription-info">
                      This is a demo party with unlimited access for exploration.
                    </p>
                  ) : (
                    <>
                      <div className="subscription-details">
                        <div className="subscription-detail">
                          <span className="detail-label">Plan</span>
                          <span className="detail-value">$10/year</span>
                        </div>
                        <div className="subscription-detail">
                          <span className="detail-label">
                            {subscription.cancel_at_period_end ? 'Expires' : 'Renews'}
                          </span>
                          <span className="detail-value">
                            {formatDate(subscription.current_period_end)}
                          </span>
                        </div>
                      </div>

                      {subscription.cancel_at_period_end && (
                        <div className="subscription-warning">
                          Your subscription will not renew. Access will end on{' '}
                          {formatDate(subscription.current_period_end)}.
                        </div>
                      )}

                      {subscription.status === 'past_due' && (
                        <div className="subscription-warning">
                          Your payment is past due. Please update your payment method to maintain access.
                        </div>
                      )}

                      <div className="billing-actions">
                        <button
                          type="button"
                          className="billing-action-button"
                          onClick={handleUpdatePaymentMethod}
                        >
                          Update Payment Method
                        </button>

                        {subscription.cancel_at_period_end ? (
                          <button
                            type="button"
                            className="billing-action-button reactivate"
                            onClick={handleReactivateSubscription}
                            disabled={reactivateSubscriptionMutation.isPending}
                          >
                            {reactivateSubscriptionMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="billing-action-button cancel"
                            onClick={handleCancelSubscription}
                            disabled={cancelSubscriptionMutation.isPending}
                          >
                            {cancelSubscriptionMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
                          </button>
                        )}

                        <button
                          type="button"
                          className="billing-action-button secondary"
                          onClick={handleOpenBillingPortal}
                          disabled={openingPortal}
                        >
                          {openingPortal ? 'Opening...' : 'View Invoices'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="no-subscription">
                <p>No subscription found for this party.</p>
                <p className="billing-hint">
                  This party may have been created before billing was enabled or the subscription has expired.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <UpdatePaymentModal
        isOpen={showUpdatePayment}
        onClose={() => {
          setShowUpdatePayment(false)
          setSetupIntentSecret(null)
        }}
        clientSecret={setupIntentSecret}
        onSuccess={() => refetchSubscription()}
      />
    </div>
  )
}
