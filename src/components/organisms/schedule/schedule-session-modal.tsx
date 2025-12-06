import { useState, useEffect } from 'react'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import type { PartyMember, PartyWithAdmins } from '@/lib/schemas'

interface ScheduleSessionModalProps {
  isOpen: boolean
  onClose: () => void
  date: string
  partyMembers: PartyMember[]
  party: PartyWithAdmins | null
  onConfirm: (options: {
    hostMemberId?: string | null
    hostLocation?: string | null
    hostAddress?: string | null
    isVirtual?: boolean
  }) => Promise<void>
}

type HostType = 'member' | 'location'

export function ScheduleSessionModal({
  isOpen,
  onClose,
  date,
  partyMembers,
  party,
  onConfirm,
}: ScheduleSessionModalProps) {
  const [hostType, setHostType] = useState<HostType>('member')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [locationName, setLocationName] = useState('')
  const [address, setAddress] = useState('')
  const [isVirtual, setIsVirtual] = useState(false)
  const [saving, setSaving] = useState(false)

  // Pre-populate from party defaults when modal opens
  useEffect(() => {
    if (isOpen && party) {
      if (party.default_host_member_id) {
        setHostType('member')
        setSelectedMemberId(party.default_host_member_id)
        // Get member's address if they have one
        const member = partyMembers.find((m) => m.id === party.default_host_member_id)
        setAddress(member?.profiles?.address ?? '')
        setIsVirtual(false)
      } else if (party.default_host_location) {
        setHostType('location')
        setLocationName(party.default_host_location)
        setAddress('')
        setIsVirtual(false)
      } else {
        // No default - reset form
        setHostType('member')
        setSelectedMemberId('')
        setLocationName('')
        setAddress('')
        setIsVirtual(false)
      }
    }
  }, [isOpen, party, partyMembers])

  // When member changes, update address from their profile
  useEffect(() => {
    if (hostType === 'member' && selectedMemberId) {
      const member = partyMembers.find((m) => m.id === selectedMemberId)
      setAddress(member?.profiles?.address ?? '')
    }
  }, [hostType, selectedMemberId, partyMembers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    try {
      await onConfirm({
        hostMemberId: hostType === 'member' ? selectedMemberId || null : null,
        hostLocation: hostType === 'location' ? locationName || null : null,
        hostAddress: address || null,
        isVirtual,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule Session</h2>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Date display */}
            <div className="schedule-modal-date">
              <span className="schedule-modal-date-icon">📅</span>
              <span className="schedule-modal-date-text">
                {getDayOfWeek(date)}, {formatDateDisplay(date)}
              </span>
            </div>

            {/* Host type selection */}
            <fieldset className="schedule-modal-fieldset">
              <legend>Who's hosting?</legend>

              <label className="schedule-modal-radio">
                <input
                  type="radio"
                  name="hostType"
                  value="member"
                  checked={hostType === 'member'}
                  onChange={() => setHostType('member')}
                />
                <span>Party Member</span>
              </label>

              <label className="schedule-modal-radio">
                <input
                  type="radio"
                  name="hostType"
                  value="location"
                  checked={hostType === 'location'}
                  onChange={() => setHostType('location')}
                />
                <span>Custom Location</span>
              </label>
            </fieldset>

            {/* Host selection based on type */}
            {hostType === 'member' ? (
              <div className="schedule-modal-field">
                <label htmlFor="hostMember">Host</label>
                <select
                  id="hostMember"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="schedule-modal-select"
                >
                  <option value="">Select a host...</option>
                  {partyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.profiles?.display_name || member.name}
                      {member.profiles?.address ? ' (has address)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="schedule-modal-field">
                <label htmlFor="locationName">Location Name</label>
                <input
                  id="locationName"
                  type="text"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g., Game Store, Discord, Zoom"
                  className="schedule-modal-input"
                />
              </div>
            )}

            {/* Address / Meeting URL */}
            <div className="schedule-modal-field">
              <label htmlFor="address">
                {isVirtual ? 'Meeting URL' : 'Address'}
              </label>
              {isVirtual ? (
                <input
                  id="address"
                  type="url"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                  className="schedule-modal-input"
                />
              ) : (
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  placeholder="Enter address..."
                />
              )}
            </div>

            {/* Virtual meeting toggle */}
            <label className="schedule-modal-checkbox">
              <input
                type="checkbox"
                checked={isVirtual}
                onChange={(e) => {
                  setIsVirtual(e.target.checked)
                  if (e.target.checked) {
                    // Clear address when switching to virtual
                    setAddress('')
                  }
                }}
              />
              <span>Virtual meeting (Zoom, Discord, etc.)</span>
            </label>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
              disabled={saving}
            >
              {saving ? 'Scheduling...' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
