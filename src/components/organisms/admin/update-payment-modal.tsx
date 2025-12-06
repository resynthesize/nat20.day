import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

// Stripe appearance matching the app's dark theme
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
  },
}

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

interface UpdatePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  clientSecret: string | null
  onSuccess: () => void
}

function PaymentForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/app/admin`,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      setError(confirmError.message ?? 'Failed to update payment method')
      setIsProcessing(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      {error && <div className="modal-error">{error}</div>}

      <div className="payment-element-container">
        <PaymentElement onReady={() => setIsReady(true)} />
      </div>

      <div className="payment-form-actions">
        <button
          type="button"
          className="modal-button secondary"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="modal-button primary"
          disabled={!stripe || !elements || isProcessing || !isReady}
        >
          {isProcessing ? 'Updating...' : 'Update Payment Method'}
        </button>
      </div>
    </form>
  )
}

export function UpdatePaymentModal({ isOpen, onClose, clientSecret, onSuccess }: UpdatePaymentModalProps) {
  if (!isOpen || !clientSecret || !stripePromise) return null

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--payment" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Update Payment Method</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="modal-form">
          <p className="update-payment-hint">
            Enter your new card details below. Your subscription will automatically use this card for future payments.
          </p>

          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: stripeAppearance,
            }}
          >
            <PaymentForm onSuccess={handleSuccess} onCancel={onClose} />
          </Elements>
        </div>
      </div>
    </div>
  )
}
