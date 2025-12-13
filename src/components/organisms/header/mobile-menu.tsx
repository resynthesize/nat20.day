import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/schemas'

interface MobileMenuProps {
  isAdmin: boolean
  profile: Profile | null
  user: User | null
  onSignOut: () => Promise<void>
}

export function MobileMenu({ isAdmin, profile, user, onSignOut }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on navigation
  useEffect(() => {
    setIsOpen(false)
  }, [navigate])

  const handleSignOut = async () => {
    setIsOpen(false)
    try {
      await onSignOut()
      window.location.href = '/'
    } catch (err) {
      console.error('Sign out failed:', err)
    }
  }

  const displayName = profile?.display_name || user?.email || '?'
  const avatarInitial = displayName.charAt(0).toUpperCase()

  return (
    <div className="mobile-menu" ref={menuRef}>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Menu"
      >
        <span className="hamburger-icon">
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </span>
      </button>

      {isOpen && (
        <div className="mobile-menu-dropdown" role="menu">
          <Link
            to="/app/profile"
            className="mobile-menu-item profile-item"
            onClick={() => setIsOpen(false)}
            role="menuitem"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={displayName}
                className="mobile-menu-avatar"
              />
            ) : (
              <div className="mobile-menu-avatar-placeholder">{avatarInitial}</div>
            )}
            <div className="mobile-menu-profile-info">
              <span className="mobile-menu-name">{displayName}</span>
              <span className="mobile-menu-label">View Profile</span>
            </div>
          </Link>

          {isAdmin && (
            <Link
              to="/app/admin"
              className="mobile-menu-item"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              Settings
            </Link>
          )}

          <div className="mobile-menu-divider" />

          <button
            type="button"
            className="mobile-menu-item sign-out-item"
            onClick={handleSignOut}
            role="menuitem"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
