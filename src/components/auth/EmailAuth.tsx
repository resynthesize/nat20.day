import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

type EmailAuthState = 'idle' | 'sending' | 'sent' | 'error'

export function EmailAuth() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<EmailAuthState>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) return

    setState('sending')
    setError(null)

    const result = await signInWithEmail(email.trim())

    if (result.success) {
      setState('sent')
    } else {
      setState('error')
      setError(result.error || 'Failed to send sign-in link')
    }
  }

  if (state === 'sent') {
    return (
      <div className="email-auth email-auth--sent">
        <p className="email-auth__success">
          Check your email for a sign-in link
        </p>
        <button
          type="button"
          className="email-auth__retry"
          onClick={() => {
            setState('idle')
            setEmail('')
          }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form className="email-auth" onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="email-auth__input"
        disabled={state === 'sending'}
        autoComplete="email"
      />
      {error && <p className="email-auth__error">{error}</p>}
      <button
        type="submit"
        className="email-auth__button"
        disabled={state === 'sending' || !email.trim()}
      >
        {state === 'sending' ? 'Sending...' : 'Send sign-in link'}
      </button>
    </form>
  )
}
