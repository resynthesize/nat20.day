import { useState } from 'react'
import { useParty } from '../../hooks/useParty'

interface CreatePartyModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreatePartyModal({ isOpen, onClose }: CreatePartyModalProps) {
  const { createParty } = useParty()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Party name is required')
      return
    }

    if (trimmedName.length > 100) {
      setError('Party name must be 100 characters or less')
      return
    }

    setCreating(true)
    try {
      const party = await createParty(trimmedName)
      if (party) {
        setName('')
        onClose()
      } else {
        setError('Failed to create party. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create party')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (!creating) {
      setName('')
      setError(null)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Party</h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            disabled={creating}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <label className="modal-label">
            <span>Party Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter party name..."
              className="modal-input"
              disabled={creating}
              autoFocus
              maxLength={100}
            />
          </label>

          <p className="modal-hint">
            You'll be added as the party admin and member automatically.
          </p>

          <div className="modal-actions">
            <button
              type="button"
              className="modal-button secondary"
              onClick={handleClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button primary"
              disabled={creating || !name.trim()}
            >
              {creating ? 'Creating...' : 'Create Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
