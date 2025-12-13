import { useState, useEffect } from 'react'
import { formatDateDisplay, getDayOfWeek } from '@/lib/dates'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { Select } from '@/components/ui/select'
import type { PartyMember, PartyWithAdmins, SessionWithHost } from '@/lib/schemas'

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
    startTime?: string | null
  }) => Promise<void>
  /** If provided, this is an edit of an existing session */
  sessionId?: string
  /** Existing session data for pre-populating when editing */
  existingSession?: SessionWithHost | null
  /** Called when user wants to cancel/delete the session */
  onCancel?: (sessionId: string) => Promise<void>
}

type HostType = 'member' | 'location'

const TIME_PRESETS = [
  { label: '5 PM', value: '17:00' },
  { label: '6 PM', value: '18:00' },
  { label: '7 PM', value: '19:00' },
  { label: '8 PM', value: '20:00' },
] as const

export function ScheduleSessionModal({
  isOpen,
  onClose,
  date,
  partyMembers,
  party,
  onConfirm,
  sessionId,
  existingSession,
  onCancel,
}: ScheduleSessionModalProps) {
  const [hostType, setHostType] = useState<HostType>('member')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [locationName, setLocationName] = useState('')
  const [address, setAddress] = useState('')
  const [isVirtual, setIsVirtual] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [showCustomTime, setShowCustomTime] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // Check if current time matches a preset
  const isPresetTime = TIME_PRESETS.some((p) => p.value === startTime)

  const isEditing = !!sessionId

  // Pre-populate form when modal opens
  useEffect(() => {
    if (!isOpen) return

    // Determine initial values: existing session > party defaults > empty
    const memberId = existingSession?.host_member_id ?? party?.default_host_member_id ?? null
    const location = existingSession?.host_location ?? party?.default_host_location ?? null
    const member = memberId ? partyMembers.find((m) => m.id === memberId) : null

    setHostType(location && !memberId ? 'location' : 'member')
    setSelectedMemberId(memberId ?? '')
    setLocationName(location ?? '')
    setAddress(existingSession?.host_address ?? member?.profiles?.address ?? '')
    setIsVirtual(existingSession?.is_virtual ?? false)
    const existingTime = existingSession?.start_time ?? ''
    setStartTime(existingTime)
    // Show custom input if existing time doesn't match a preset
    const matchesPreset = TIME_PRESETS.some((p) => p.value === existingTime)
    setShowCustomTime(existingTime !== '' && !matchesPreset)
  }, [isOpen, existingSession, party, partyMembers])

  // When member changes, update address from their profile
  useEffect(() => {
    if (hostType === 'member' && selectedMemberId) {
      const member = partyMembers.find((m) => m.id === selectedMemberId)
      setAddress(member?.profiles?.address ?? '')
    }
  }, [hostType, selectedMemberId, partyMembers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || cancelling) return

    setSaving(true)
    try {
      await onConfirm({
        hostMemberId: hostType === 'member' ? selectedMemberId || null : null,
        hostLocation: hostType === 'location' ? locationName || null : null,
        hostAddress: address || null,
        isVirtual,
        startTime: startTime || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleCancelSession = async () => {
    if (!sessionId || !onCancel || cancelling || saving) return
    setCancelling(true)
    try {
      await onCancel(sessionId)
      onClose()
    } finally {
      setCancelling(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Session' : 'Schedule Session'}</h2>
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

            {/* Start time */}
            <div className="schedule-modal-field">
              <label>Start Time (optional)</label>
              <div className="time-preset-group">
                {TIME_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={`time-preset-btn ${startTime === preset.value && !showCustomTime ? 'selected' : ''}`}
                    onClick={() => {
                      setStartTime(preset.value)
                      setShowCustomTime(false)
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`time-preset-btn ${showCustomTime || (startTime && !isPresetTime) ? 'selected' : ''}`}
                  onClick={() => {
                    setShowCustomTime(true)
                    if (isPresetTime) setStartTime('')
                  }}
                >
                  Other
                </button>
                {startTime && (
                  <button
                    type="button"
                    className="time-preset-btn time-preset-clear"
                    onClick={() => {
                      setStartTime('')
                      setShowCustomTime(false)
                    }}
                    title="Clear time"
                  >
                    ✕
                  </button>
                )}
              </div>
              {showCustomTime && (
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="schedule-modal-input schedule-modal-time"
                  autoFocus
                />
              )}
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
                <Select
                  value={selectedMemberId}
                  onChange={setSelectedMemberId}
                  placeholder="Select a host..."
                  options={partyMembers.map((member) => ({
                    value: member.id,
                    label: member.profiles?.display_name || member.name,
                  }))}
                />
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
            {isEditing && onCancel && (
              <button
                type="button"
                className="modal-button modal-button-danger"
                onClick={handleCancelSession}
                disabled={saving || cancelling}
              >
                {cancelling ? 'Cancelling...' : 'Cancel Session'}
              </button>
            )}
            <div className="modal-footer-spacer" />
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={onClose}
              disabled={saving || cancelling}
            >
              Close
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
              disabled={saving || cancelling}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
