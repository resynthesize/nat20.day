import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { OAuthButton } from './oauth-button'
import { EmailAuth } from './email-auth'

export function AuthTabs() {
  const { signInWithGoogle, signInWithDiscord } = useAuth()
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  const handleOAuthClick = async (provider: 'google' | 'discord', signIn: () => Promise<void>) => {
    setLoadingProvider(provider)
    try {
      await signIn()
    } catch {
      // Error already logged in useAuth
      setLoadingProvider(null)
    }
  }

  return (
    <div className="auth-tabs">
      <div className="auth-tabs__oauth">
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

      <div className="auth-tabs__divider">
        <span>or</span>
      </div>

      <EmailAuth />
    </div>
  )
}
