import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PaymentForm } from '../components/party/PaymentForm'
import { OAuthButton } from '../components/auth/OAuthButton'
import { LandingNav } from '../components/landing/LandingNav'
import { Footer } from '../components/landing/Footer'

type GameType = 'dnd' | 'mtg' | 'warhammer' | 'boardgames' | 'other'
type SignupStep = 'details' | 'payment' | 'auth'

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

// Initialize Stripe
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

// LocalStorage key for pending signup
const PENDING_SIGNUP_KEY = 'nat20-pending-signup'

export function SignupPage() {
  const { signInWithGoogle, signInWithDiscord } = useAuth()

  const [step, setStep] = useState<SignupStep>('details')
  const [partyName, setPartyName] = useState('')
  const [email, setEmail] = useState('')
  const [gameType, setGameType] = useState<GameType>('dnd')
  const [loading, setLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pendingSignupId, setPendingSignupId] = useState<string | null>(null)

  // Check for existing pending signup on mount
  useEffect(() => {
    const stored = localStorage.getItem(PENDING_SIGNUP_KEY)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        // If payment was already completed, go straight to auth
        if (data.paymentCompleted) {
          setPendingSignupId(data.id)
          setPartyName(data.partyName || '')
          setStep('auth')
        }
      } catch {
        localStorage.removeItem(PENDING_SIGNUP_KEY)
      }
    }
  }, [])

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedName = partyName.trim()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedName) {
      setError('Party name is required')
      return
    }

    if (trimmedName.length > 100) {
      setError('Party name must be 100 characters or less')
      return
    }

    if (!trimmedEmail) {
      setError('Email is required')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    if (!stripePromise) {
      setError('Payment system not configured. Please contact support.')
      return
    }

    setLoading(true)
    try {
      // Call the signup/start endpoint (no auth required)
      const response = await fetch('/api/v1/signup/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: trimmedEmail,
          party_name: trimmedName,
          game_type: gameType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || 'Failed to start signup')
      }

      const { pending_signup_id, client_secret, payment_completed } = await response.json()

      setPendingSignupId(pending_signup_id)

      // If payment was already completed (resuming), skip to auth
      if (payment_completed) {
        localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
          id: pending_signup_id,
          partyName: trimmedName,
          paymentCompleted: true,
        }))
        setStep('auth')
      } else {
        setClientSecret(client_secret)
        // Store partial progress
        localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
          id: pending_signup_id,
          partyName: trimmedName,
          paymentCompleted: false,
        }))
        setStep('payment')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize signup')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSuccess = () => {
    // Update localStorage to mark payment as completed
    localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
      id: pendingSignupId,
      partyName,
      paymentCompleted: true,
    }))
    setStep('auth')
  }

  const handleBackToDetails = () => {
    setStep('details')
    setClientSecret(null)
    setError(null)
  }

  const handleOAuthClick = async (provider: 'google' | 'discord', signIn: () => Promise<void>) => {
    if (!pendingSignupId) {
      setError('Signup session expired. Please start over.')
      return
    }

    setLoadingProvider(provider)
    try {
      // The useAuth hook will be modified to check localStorage for pending signup
      // and include it in the redirect URL
      await signIn()
    } catch {
      setLoadingProvider(null)
    }
  }

  const getStepClass = (stepName: SignupStep, currentStep: SignupStep) => {
    const stepOrder: SignupStep[] = ['details', 'payment', 'auth']
    const currentIndex = stepOrder.indexOf(currentStep)
    const stepIndex = stepOrder.indexOf(stepName)

    if (currentStep === stepName) return 'active'
    if (stepIndex < currentIndex) return 'completed'
    return ''
  }

  const stepIndicator = (
    <div className="signup-steps">
      <div className={`signup-step ${getStepClass('details', step)}`}>
        <span className="signup-step-number">1</span>
        <span className="signup-step-label">Party Details</span>
      </div>
      <div className="signup-step-connector" />
      <div className={`signup-step ${getStepClass('payment', step)}`}>
        <span className="signup-step-number">2</span>
        <span className="signup-step-label">Payment</span>
      </div>
      <div className="signup-step-connector" />
      <div className={`signup-step ${getStepClass('auth', step)}`}>
        <span className="signup-step-number">3</span>
        <span className="signup-step-label">Create Account</span>
      </div>
    </div>
  )

  return (
    <div className="landing-page">
      <LandingNav />

      <main className="signup-page">
        <div className="signup-container">
          <div className="signup-header">
            <h1>Start Your Party</h1>
            <p>Create your adventuring party in 3 easy steps</p>
          </div>

          {stepIndicator}

          {error && <div className="signup-error">{error}</div>}

          {step === 'details' && (
            <form onSubmit={handleContinueToPayment} className="signup-form">
              <label className="signup-label">
                <span>Party Name</span>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="The Dungeon Delvers..."
                  className="signup-input"
                  disabled={loading}
                  autoFocus
                  maxLength={100}
                />
              </label>

              <label className="signup-label">
                <span>Your Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adventurer@example.com"
                  className="signup-input"
                  disabled={loading}
                />
                <span className="signup-hint">We'll use this to create your account</span>
              </label>

              <label className="signup-label">
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

              <div className="signup-pricing">
                <span className="signup-price">$10/year</span>
                <span className="signup-price-note">Includes all features for your party</span>
              </div>

              <div className="signup-actions">
                <Link to="/" className="signup-button secondary">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="signup-button primary"
                  disabled={loading || !partyName.trim() || !email.trim()}
                >
                  {loading ? 'Loading...' : 'Continue to Payment'}
                </button>
              </div>
            </form>
          )}

          {step === 'payment' && clientSecret && stripePromise && (
            <div className="signup-form">
              <div className="payment-summary">
                <p className="payment-summary-party">
                  <strong>{partyName}</strong>
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
                  returnUrl={`${window.location.origin}/signup?payment=success`}
                />
              </Elements>
            </div>
          )}

          {step === 'auth' && (
            <div className="signup-form signup-auth">
              <div className="signup-auth-success">
                <span className="signup-auth-check">&#10003;</span>
                <h3>Payment Complete!</h3>
                <p>
                  Your party "<strong>{partyName}</strong>" is ready to be created.
                  <br />
                  Just sign in to finish setting up your account.
                </p>
              </div>

              <div className="signup-auth-options">
                <OAuthButton
                  provider="google"
                  onClick={() => handleOAuthClick('google', signInWithGoogle)}
                  loading={loadingProvider === 'google'}
                />
                <OAuthButton
                  provider="discord"
                  onClick={() => handleOAuthClick('discord', signInWithDiscord)}
                  loading={loadingProvider === 'discord'}
                />
              </div>

              <p className="signup-auth-note">
                Already have an account? Your new party will be added to your existing account.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
