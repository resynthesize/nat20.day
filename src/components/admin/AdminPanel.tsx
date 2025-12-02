import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useParty } from '../../hooks/useParty'
import { useAuth } from '../../hooks/useAuth'
import { parsePartyMembers, type PartyMember } from '../../lib/schemas'

type TabType = 'members' | 'settings'

interface AdminInfo {
  profile_id: string
  profiles: { id: string; display_name: string; avatar_url: string | null } | null
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
  }, [fetchData, currentParty?.name])

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

  const isUserAdmin = (profileId: string) => admins.some((a) => a.profile_id === profileId)

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
        ) : (
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
        )}
      </div>
    </div>
  )
}
