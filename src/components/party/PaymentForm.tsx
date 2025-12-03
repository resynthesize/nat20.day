import { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'

interface PaymentFormProps {
  onSuccess: () => void
  onCancel: () => void
  isProcessing: boolean
  setIsProcessing: (processing: boolean) => void
  setError: (error: string | null) => void
}

/**
 * Embedded Stripe Payment Form using Payment Element
 *
 * This component handles the actual card input and payment confirmation.
 * It must be rendered inside a Stripe Elements provider.
 */
export function PaymentForm({
  onSuccess,
  onCancel,
  isProcessing,
  setIsProcessing,
  setError,
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isElementReady, setIsElementReady] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError(null)

    // Confirm the payment using the Payment Element
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Return URL after payment (for 3D Secure redirects)
        return_url: `${window.location.origin}/app?checkout=success`,
      },
      redirect: 'if_required',
    })

    if (confirmError) {
      // Show error to the user (e.g., card declined, insufficient funds)
      setError(confirmError.message ?? 'Payment failed. Please try again.')
      setIsProcessing(false)
    } else {
      // Payment succeeded! The webhook will create the party.
      // Show success state to user
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="payment-element-container">
        <PaymentElement
          onReady={() => setIsElementReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
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
          disabled={!stripe || !elements || isProcessing || !isElementReady}
        >
          {isProcessing ? 'Processing...' : 'Pay $10/year'}
        </button>
      </div>
    </form>
  )
}
