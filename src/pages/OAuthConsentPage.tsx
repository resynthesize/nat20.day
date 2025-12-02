/**
 * OAuth Consent Page
 *
 * Handles OAuth 2.1 authorization requests from MCP clients.
 * Users approve or deny third-party access to their nat20.day data.
 *
 * Flow:
 * 1. MCP client redirects here with ?authorization_id=<id>
 * 2. We fetch authorization details from Supabase
 * 3. User approves or denies
 * 4. We redirect back to the client with result
 */
import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface AuthorizationDetails {
  authorization_id: string
  redirect_url?: string
  client: {
    id: string
    name: string
    uri: string
    logo_uri: string
  }
  user: {
    id: string
    email: string
  }
  scope: string
}

export function OAuthConsentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [authDetails, setAuthDetails] = useState<AuthorizationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const authorizationId = searchParams.get('authorization_id')

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const returnUrl = `/oauth/consent?authorization_id=${authorizationId}`
      navigate(`/?redirect=${encodeURIComponent(returnUrl)}`)
    }
  }, [authLoading, isAuthenticated, authorizationId, navigate])

  // Fetch authorization details
  useEffect(() => {
    async function fetchDetails() {
      if (!authorizationId) {
        setError('Missing authorization_id parameter')
        setLoading(false)
        return
      }

      if (!isAuthenticated) return

      try {
        const { data, error: fetchError } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)

        if (fetchError) {
          setError(fetchError.message)
        } else if (data) {
          // If redirect_url is present, user already consented - auto redirect
          if (data.redirect_url) {
            window.location.href = data.redirect_url
            return
          }
          setAuthDetails(data)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch authorization details')
      } finally {
        setLoading(false)
      }
    }

    if (isAuthenticated) {
      fetchDetails()
    }
  }, [authorizationId, isAuthenticated])

  async function handleApprove() {
    if (!authorizationId) return
    setSubmitting(true)

    try {
      const { data, error: approveError } = await supabase.auth.oauth.approveAuthorization(authorizationId)

      if (approveError) {
        setError(approveError.message)
        setSubmitting(false)
        return
      }

      // Redirect back to the client
      if (data?.redirect_url) {
        window.location.href = data.redirect_url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve authorization')
      setSubmitting(false)
    }
  }

  async function handleDeny() {
    if (!authorizationId) return
    setSubmitting(true)

    try {
      const { data, error: denyError } = await supabase.auth.oauth.denyAuthorization(authorizationId)

      if (denyError) {
        setError(denyError.message)
        setSubmitting(false)
        return
      }

      // Redirect back to the client with denial
      if (data?.redirect_url) {
        window.location.href = data.redirect_url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deny authorization')
      setSubmitting(false)
    }
  }

  // Parse scopes from space-separated string
  const scopes = authDetails?.scope.split(' ') || []

  const scopeDescriptions: Record<string, string> = {
    openid: 'Verify your identity',
    email: 'View your email address',
    profile: 'View your profile information',
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="consent-page">
        <div className="consent-card">
          <div className="consent-loading">Loading...</div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="consent-page">
        <div className="consent-card">
          <h1>Authorization Error</h1>
          <p className="consent-error">{error}</p>
          <button onClick={() => navigate('/')} className="consent-btn consent-btn-secondary">
            Return Home
          </button>
        </div>
      </div>
    )
  }

  // No details state
  if (!authDetails) {
    return (
      <div className="consent-page">
        <div className="consent-card">
          <h1>Invalid Request</h1>
          <p>Could not load authorization details.</p>
          <button onClick={() => navigate('/')} className="consent-btn consent-btn-secondary">
            Return Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="consent-page">
      <div className="consent-card">
        <div className="consent-header">
          {authDetails.client.logo_uri && (
            <img
              src={authDetails.client.logo_uri}
              alt={authDetails.client.name}
              className="consent-client-icon"
            />
          )}
          <h1>Authorize {authDetails.client.name}</h1>
        </div>

        <p className="consent-description">
          <strong>{authDetails.client.name}</strong> wants to access your nat20.day account.
        </p>

        <div className="consent-scopes">
          <h2>This will allow the app to:</h2>
          <ul>
            {scopes.map((scope) => (
              <li key={scope}>
                {scopeDescriptions[scope] || scope}
              </li>
            ))}
            <li>View your D&D parties</li>
            <li>View and manage your availability</li>
          </ul>
        </div>

        <div className="consent-actions">
          <button
            onClick={handleDeny}
            disabled={submitting}
            className="consent-btn consent-btn-secondary"
          >
            Deny
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="consent-btn consent-btn-primary"
          >
            {submitting ? 'Authorizing...' : 'Authorize'}
          </button>
        </div>

        <p className="consent-footer">
          You can revoke access at any time from your profile settings.
        </p>
      </div>

      <style>{`
        .consent-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: var(--bg-primary);
        }

        .consent-card {
          max-width: 420px;
          width: 100%;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 2rem;
        }

        .consent-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .consent-client-icon {
          width: 64px;
          height: 64px;
          border-radius: 12px;
          margin-bottom: 1rem;
        }

        .consent-header h1 {
          font-size: 1.5rem;
          margin: 0;
          color: var(--text-primary);
        }

        .consent-description {
          color: var(--text-secondary);
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .consent-scopes {
          background: var(--bg-primary);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .consent-scopes h2 {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0 0 0.75rem 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .consent-scopes ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .consent-scopes li {
          color: var(--text-primary);
          margin-bottom: 0.5rem;
        }

        .consent-scopes li:last-child {
          margin-bottom: 0;
        }

        .consent-actions {
          display: flex;
          gap: 1rem;
        }

        .consent-btn {
          flex: 1;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .consent-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .consent-btn-primary {
          background: var(--accent-primary);
          color: white;
          border: none;
        }

        .consent-btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        .consent-btn-secondary {
          background: transparent;
          color: var(--text-secondary);
          border: 1px solid var(--border-color);
        }

        .consent-btn-secondary:hover:not(:disabled) {
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .consent-footer {
          margin-top: 1.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
          text-align: center;
        }

        .consent-error {
          color: var(--error-color, #ef4444);
          background: rgba(239, 68, 68, 0.1);
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .consent-loading {
          text-align: center;
          color: var(--text-secondary);
          padding: 2rem;
        }
      `}</style>
    </div>
  )
}
