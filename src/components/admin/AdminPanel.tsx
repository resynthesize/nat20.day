import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useParty } from '../../hooks/useParty'
import { useAuth } from '../../hooks/useAuth'
import { parsePartyMembers, type PartyMember } from '../../lib/schemas'

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

interface AdminInfo {
  profile_id: string
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
}

interface SubscriptionInfo {
  id: string
  party_id: string
  status: 'active' | 'past_due' | 'canceled' | 'expired'
  current_period_end: string
  cancel_at_period_end: boolean
}

export function AdminPanel() {
  const { currentParty, isAdmin, refreshParties } = useParty()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<TabType>('members')
  const [members, setMembers] = useState<PartyMember[]>([])
  const [admins, setAdmins] = useState<AdminInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add member form
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Edit party name
  const [partyName, setPartyName] = useState(currentParty?.name || '')
  const [savingName, setSavingName] = useState(false)

  // Days of week selection
  const [selectedDays, setSelectedDays] = useState<number[]>(
    currentParty?.days_of_week ?? [5, 6]
  )
  const [savingDays, setSavingDays] = useState(false)

  // Billing
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [openingPortal, setOpeningPortal] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin && !loading) {
      navigate('/')
    }
  }, [isAdmin, loading, navigate])

  const fetchData = useCallback(async () => {
    if (!currentParty) return

    setLoading(true)
    setError(null)

    try {
      const [membersResult, adminsResult] = await Promise.all([
        supabase
          .from('party_members')
          .select(`
            id,
            party_id,
            name,
            email,
            profile_id,
            created_at,
            profiles (
              display_name,
              avatar_url
            )
          `)
          .eq('party_id', currentParty.id)
          .order('name'),
        supabase
          .from('party_admins')
          .select(`
            profile_id,
            profiles (
              id,
              display_name,
              avatar_url
            )
          `)
          .eq('party_id', currentParty.id),
      ])

      if (membersResult.error) throw membersResult.error
      if (adminsResult.error) throw adminsResult.error

      // Normalize joined data - Supabase returns joined relations as arrays
      const normalizedMembers = (membersResult.data ?? []).map((item) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
      }))

      const normalizedAdmins = (adminsResult.data ?? []).map((item) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
      }))

      setMembers(parsePartyMembers(normalizedMembers))
      setAdmins(normalizedAdmins as AdminInfo[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [currentParty])

  useEffect(() => {
    fetchData()
    setPartyName(currentParty?.name || '')
    setSelectedDays(currentParty?.days_of_week ?? [5, 6])
  }, [fetchData, currentParty?.name, currentParty?.days_of_week])

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

    setAddingMember(true)
    setError(null)

    try {
      const { error: insertError } = await supabase.from('party_members').insert({
        party_id: currentParty.id,
        name: trimmedName,
        email: trimmedEmail,
      })

      if (insertError) throw insertError

      setNewMemberName('')
      setNewMemberEmail('')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!currentParty) return
    if (!confirm(`Remove ${memberName} from the party?`)) return

    try {
      const { error: deleteError } = await supabase
        .from('party_members')
        .delete()
        .eq('id', memberId)
        .eq('party_id', currentParty.id)

      if (deleteError) throw deleteError
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  const handlePromoteToAdmin = async (profileId: string) => {
    if (!currentParty) return

    try {
      const { error: insertError } = await supabase.from('party_admins').insert({
        party_id: currentParty.id,
        profile_id: profileId,
      })

      if (insertError) throw insertError
      await fetchData()
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
      const { error: deleteError } = await supabase
        .from('party_admins')
        .delete()
        .eq('party_id', currentParty.id)
        .eq('profile_id', profileId)

      if (deleteError) throw deleteError
      await fetchData()
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

  const isUserAdmin = (profileId: string) => admins.some((a) => a.profile_id === profileId)

  // Fetch subscription when billing tab is active
  const fetchSubscription = useCallback(async () => {
    if (!currentParty) return

    setLoadingSubscription(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`/api/v1/billing/subscription?party_id=${currentParty.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSubscription(data)
      } else if (response.status === 404) {
        setSubscription(null)
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err)
    } finally {
      setLoadingSubscription(false)
    }
  }, [currentParty])

  useEffect(() => {
    if (activeTab === 'billing') {
      fetchSubscription()
    }
  }, [activeTab, fetchSubscription])

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
        <Link to="/" className="back-link">← Back to Schedule</Link>
      </div>
    )
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <Link to="/" className="back-link">← Back to Schedule</Link>
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
                  disabled={addingMember}
                />
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="form-input"
                  disabled={addingMember}
                />
                <button
                  type="submit"
                  className="form-button"
                  disabled={addingMember || !newMemberName.trim()}
                >
                  {addingMember ? 'Adding...' : 'Add'}
                </button>
              </div>
              <p className="form-hint">
                Email is optional but required for members to log in and manage their availability.
              </p>
            </form>

            <div className="members-list">
              <h3>Party Members ({members.length})</h3>
              {members.map((member) => (
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
                      <span className="member-name">{member.name}</span>
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
              ))}
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
          </div>
        ) : (
          <div className="billing-tab">
            {loadingSubscription ? (
              <div className="loading">Loading subscription...</div>
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

                      <button
                        type="button"
                        className="billing-portal-button"
                        onClick={handleOpenBillingPortal}
                        disabled={openingPortal}
                      >
                        {openingPortal ? 'Opening...' : 'Manage Subscription'}
                      </button>
                      <p className="billing-hint">
                        Update payment method, view invoices, or cancel subscription.
                      </p>
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
    </div>
  )
}
