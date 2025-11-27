import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useProfile } from '../../hooks/useProfile'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  // Track only the edited value; null means using profile value
  const [editedName, setEditedName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = editedName ?? profile?.display_name ?? ''
  const hasChanges = editedName !== null && editedName !== profile?.display_name

  const { uploadAvatar, updateDisplayName, uploading, saving, error, clearError } =
    useProfile({
      userId: user?.id || '',
      onSuccess: () => {
        refreshProfile()
        setEditedName(null)
      },
    })

  const handleDisplayNameChange = (value: string) => {
    setEditedName(value)
    clearError()
  }

  const handleSave = async () => {
    if (hasChanges) {
      await updateDisplayName(displayName)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadAvatar(file)
      // Reset input so same file can be selected again
      e.target.value = ''
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <Link to="/" className="back-link">
          &larr; Back to Schedule
        </Link>
        <h2>Edit Profile</h2>
      </div>

      <div className="profile-content">
        {error && <div className="profile-error">{error}</div>}

        <div className="profile-avatar-section">
          <button
            type="button"
            className="avatar-upload-button"
            onClick={handleAvatarClick}
            disabled={uploading}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="profile-avatar"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {(profile?.display_name || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="avatar-overlay">
              {uploading ? 'Uploading...' : 'Change Photo'}
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden-input"
          />
          <p className="avatar-hint">Click to upload a new avatar (max 2MB)</p>
        </div>

        <div className="profile-form">
          <label className="profile-label">
            <span>Display Name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => handleDisplayNameChange(e.target.value)}
              className="profile-input"
              placeholder="Enter your display name"
            />
          </label>

          <label className="profile-label">
            <span>Email</span>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="profile-input disabled"
            />
            <span className="input-hint">Email cannot be changed</span>
          </label>

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="save-button"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
