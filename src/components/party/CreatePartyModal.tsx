import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { supabase } from '../../lib/supabase'
import { PaymentForm } from './PaymentForm'

interface CreatePartyModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

type GameType = 'dnd' | 'mtg' | 'warhammer' | 'boardgames' | 'other'

const GAME_TYPE_OPTIONS: { value: GameType; label: string; description: string }[] = [
  { value: 'dnd', label: 'D&D', description: 'Dungeons & Dragons' },
  { value: 'mtg', label: 'MTG', description: 'Magic: The Gathering' },
  { value: 'warhammer', label: 'Warhammer', description: 'Warhammer 40K / AoS' },
  { value: 'boardgames', label: 'Board Games', description: 'Board game nights' },
  { value: 'other', label: 'Other', description: 'Other tabletop games' },
]

// Stripe appearance customization for D&D Beyond-inspired dark theme
const stripeAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#c49250',
    colorBackground: '#1a1f23',
    colorText: '#ecedee',
    colorTextSecondary: '#a8b3b9',
    colorTextPlaceholder: '#6c7a82',
    colorDanger: '#e53e3e',
    fontFamily: '"JetBrains Mono", monospace',
    fontSizeBase: '14px',
    borderRadius: '4px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      backgroundColor: '#232b2f',
      border: '1px solid #3a4349',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #c49250',
      boxShadow: '0 0 0 1px #c49250',
    },
    '.Input--invalid': {
      border: '1px solid #e53e3e',
    },
    '.Label': {
      color: '#a8b3b9',
      fontWeight: '500',
      marginBottom: '4px',
    },
    '.Tab': {
      backgroundColor: '#232b2f',
      border: '1px solid #3a4349',
      color: '#a8b3b9',
    },
    '.Tab:hover': {
      backgroundColor: '#2a3238',
      color: '#ecedee',
    },
    '.Tab--selected': {
      backgroundColor: '#2a3238',
      borderColor: '#c49250',
      color: '#c49250',
    },
    '.TabIcon': {
      fill: '#a8b3b9',
    },
    '.TabIcon--selected': {
      fill: '#c49250',
    },
  },
}

// Initialize Stripe - loaded once at module level
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

type ModalStep = 'details' | 'payment' | 'success'

export function CreatePartyModal({ isOpen, onClose, onSuccess }: CreatePartyModalProps) {
  const [name, setName] = useState('')
  const [gameType, setGameType] = useState<GameType>('dnd')
  const [step, setStep] = useState<ModalStep>('details')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setName('')
      setGameType('dnd')
      setStep('details')
      setLoading(false)
      setError(null)
      setClientSecret(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleContinueToPayment = async (e: React.FormEvent) => {
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

    if (!stripePromise) {
      setError('Payment system not configured. Please contact support.')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('You must be logged in to create a party')
        return
      }

      // Call the new subscribe endpoint to create subscription with incomplete payment
      const response = await fetch('/api/v1/billing/subscribe', {
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
        throw new Error(errorData?.message || 'Failed to create subscription')
      }

      const { client_secret } = await response.json()
      setClientSecret(client_secret)
      setStep('payment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    setStep('success')
    // Trigger party list refresh after a short delay
    setTimeout(() => {
      onSuccess?.()
      onClose()
    }, 2000)
  }

  const handleClose = () => {
    if (!loading && step !== 'payment') {
      onClose()
    }
  }

  const handleBackToDetails = () => {
    setStep('details')
    setClientSecret(null)
    setError(null)
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-content--payment" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {step === 'details' && 'Create New Party'}
            {step === 'payment' && 'Complete Payment'}
            {step === 'success' && 'Success!'}
          </h2>
          {step !== 'success' && (
            <button
              type="button"
              className="modal-close"
              onClick={handleClose}
              disabled={loading || step === 'payment'}
              aria-label="Close"
            >
              &times;
            </button>
          )}
        </div>

        {error && <div className="modal-error">{error}</div>}

        {step === 'details' && (
          <form onSubmit={handleContinueToPayment} className="modal-form">
            <label className="modal-label">
              <span>Party Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="The Dungeon Delvers..."
                className="modal-input"
                disabled={loading}
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
                    disabled={loading}
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

            <div className="modal-actions">
              <button
                type="button"
                className="modal-button secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="modal-button primary"
                disabled={loading || !name.trim()}
              >
                {loading ? 'Loading...' : 'Continue to Payment'}
              </button>
            </div>
          </form>
        )}

        {step === 'payment' && clientSecret && stripePromise && (
          <div className="modal-form">
            <div className="payment-summary">
              <p className="payment-summary-party">
                <strong>{name}</strong>
              </p>
              <p className="payment-summary-amount">$10.00/year</p>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: stripeAppearance,
              }}
            >
              <PaymentForm
                onSuccess={handlePaymentSuccess}
                onCancel={handleBackToDetails}
                isProcessing={loading}
                setIsProcessing={setLoading}
                setError={setError}
              />
            </Elements>
          </div>
        )}

        {step === 'success' && (
          <div className="modal-form payment-success">
            <div className="payment-success-icon">&#10003;</div>
            <h3>Payment Successful!</h3>
            <p>Your party "<strong>{name}</strong>" is being created...</p>
            <p className="payment-success-note">You'll be redirected shortly.</p>
          </div>
        )}
      </div>
    </div>
  )
}
