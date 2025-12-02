import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface CreatePartyModalProps {
  isOpen: boolean
  onClose: () => void
}

type GameType = 'dnd' | 'mtg' | 'warhammer' | 'boardgames' | 'other'

const GAME_TYPE_OPTIONS: { value: GameType; label: string; description: string }[] = [
  { value: 'dnd', label: 'D&D', description: 'Dungeons & Dragons' },
  { value: 'mtg', label: 'MTG', description: 'Magic: The Gathering' },
  { value: 'warhammer', label: 'Warhammer', description: 'Warhammer 40K / AoS' },
  { value: 'boardgames', label: 'Board Games', description: 'Board game nights' },
  { value: 'other', label: 'Other', description: 'Other tabletop games' },
]

export function CreatePartyModal({ isOpen, onClose }: CreatePartyModalProps) {
  const [name, setName] = useState('')
  const [gameType, setGameType] = useState<GameType>('dnd')
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
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('You must be logged in to create a party')
        return
      }

      // Call the billing checkout API
      const response = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          party_name: trimmedName,
          game_type: gameType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to create checkout session')
      }

      const { checkout_url } = await response.json()

      // Redirect to Stripe Checkout
      window.location.href = checkout_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create party')
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (!creating) {
      setName('')
      setGameType('dnd')
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
              placeholder="The Dungeon Delvers..."
              className="modal-input"
              disabled={creating}
              autoFocus
              maxLength={100}
            />
          </label>

          <label className="modal-label">
            <span>Game Type</span>
            <div className="game-type-selector">
              {GAME_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`game-type-option ${gameType === option.value ? 'selected' : ''}`}
                  onClick={() => setGameType(option.value)}
                  disabled={creating}
                >
                  <span className="game-type-label">{option.label}</span>
                  <span className="game-type-description">{option.description}</span>
                </button>
              ))}
            </div>
          </label>

          <div className="modal-pricing">
            <span className="modal-price">$10/year</span>
            <span className="modal-price-note">Includes all features for your party</span>
          </div>

          <p className="modal-hint">
            You'll be redirected to Stripe for secure payment. After payment, you'll be added as party admin automatically.
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
              {creating ? 'Redirecting...' : 'Continue to Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
