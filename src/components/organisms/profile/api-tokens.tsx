import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiTokens } from '@/hooks/useApiTokens'
import { formatDistanceToNow } from 'date-fns'
import { UI_TIMING } from '@/lib/constants'

interface ApiTokensProps {
  userId: string | null
}

export function ApiTokens({ userId }: ApiTokensProps) {
  const {
    tokens,
    loading,
    error,
    creating,
    deleting,
    createToken,
    deleteToken,
    clearError,
  } = useApiTokens({ userId })

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [tokenName, setTokenName] = useState('')
  const [newToken, setNewToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!tokenName.trim()) return

    const token = await createToken(tokenName.trim())
    if (token) {
      setNewToken(token)
      setTokenName('')
      setShowCreateForm(false)
    }
  }

  const handleCopy = async () => {
    if (newToken) {
      await navigator.clipboard.writeText(newToken)
      setCopied(true)
      setTimeout(() => setCopied(false), UI_TIMING.COPY_FEEDBACK_DURATION)
    }
  }

  const handleDismissNewToken = () => {
    setNewToken(null)
    setCopied(false)
  }

  const handleDelete = async (tokenId: string) => {
    if (confirm('Are you sure you want to revoke this token? Any applications using it will stop working.')) {
      await deleteToken(tokenId)
    }
  }

  if (loading) {
    return (
      <div className="api-tokens-section">
        <h3>API Tokens</h3>
        <p className="tokens-loading">Loading tokens...</p>
      </div>
    )
  }

  return (
    <div className="api-tokens-section">
      <div className="tokens-header">
        <h3>API Tokens</h3>
        <p className="tokens-description">
          Generate tokens to access nat20.day programmatically.{' '}
          <Link to="/docs" className="docs-link">View API documentation →</Link>
        </p>
      </div>

      {error && (
        <div className="profile-error">
          {error}
          <button type="button" onClick={clearError} className="error-dismiss">
            &times;
          </button>
        </div>
      )}

      {/* New Token Display (shown once after creation) */}
      {newToken && (
        <div className="new-token-display">
          <div className="new-token-warning">
            <strong>Save this token now!</strong> You won&apos;t be able to see it again.
          </div>
          <div className="new-token-value">
            <code>{newToken}</code>
            <button type="button" onClick={handleCopy} className="copy-button">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button type="button" onClick={handleDismissNewToken} className="dismiss-button">
            I&apos;ve saved it
          </button>
        </div>
      )}

      {/* Token List */}
      {tokens.length > 0 && (
        <div className="tokens-list">
          {tokens.map((token) => (
            <div key={token.id} className="token-item">
              <div className="token-info">
                <span className="token-name">{token.name}</span>
                <code className="token-prefix">{token.token_prefix}...</code>
                <span className="token-meta">
                  Created {formatDistanceToNow(new Date(token.created_at))} ago
                  {token.last_used_at && (
                    <> · Last used {formatDistanceToNow(new Date(token.last_used_at))} ago</>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(token.id)}
                disabled={deleting === token.id}
                className="token-delete-button"
              >
                {deleting === token.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Token Form */}
      {showCreateForm ? (
        <div className="create-token-form">
          <input
            type="text"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token name (e.g., Home Assistant)"
            className="profile-input"
            maxLength={100}
            autoFocus
          />
          <div className="create-token-actions">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !tokenName.trim()}
              className="save-button"
            >
              {creating ? 'Creating...' : 'Create Token'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false)
                setTokenName('')
              }}
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="create-token-button"
          disabled={!!newToken}
        >
          + Generate New Token
        </button>
      )}

      {tokens.length === 0 && !showCreateForm && !newToken && (
        <p className="no-tokens">No tokens yet. Generate one to get started.</p>
      )}
    </div>
  )
}
