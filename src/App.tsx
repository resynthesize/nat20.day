import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { DocsPage } from './pages/DocsPage'
import { PartyProvider, useParty } from './hooks/useParty'
import { LoginButton } from './components/auth/LoginButton'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
import { ProfilePage } from './components/profile/ProfilePage'
import { AdminPanel } from './components/admin/AdminPanel'
import { PartySelector } from './components/party/PartySelector'
import { CreatePartyModal } from './components/party/CreatePartyModal'
import './App.css'

const taglines = [
  "Herding cats, but the cats have schedules.",
  "Because 'whenever works' never works.",
  "The real BBEG is everyone's calendar.",
  "Rolling a d20 to find a free Thursday.",
  "Your Google Calendar can't save you here.",
  "TPK: Total Party Kalendar conflict.",
  "Scheduling: the only encounter you can't fireball.",
  "Like Doodle, but with more existential dread.",
  "The dungeon master's true nemesis: adulting.",
  "Critical success requires a gathered party.",
]

function AuthenticatedApp() {
  const { user, profile, signOut } = useAuth()
  const { isAdmin } = useParty()
  const [showCreatePartyModal, setShowCreatePartyModal] = useState(false)

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <Link to="/" className="title-link">
            <h1 className="title">nat20.day</h1>
          </Link>
          <PartySelector onCreateParty={() => setShowCreatePartyModal(true)} />
        </div>
        <div className="header-right">
          {isAdmin && (
            <Link to="/admin" className="admin-link">
              Settings
            </Link>
          )}
          <Link to="/profile" className="user-info">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="user-avatar"
              />
            ) : (
              <div className="user-avatar-placeholder">
                {(profile?.display_name || user?.email || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="user-name">{profile?.display_name || user?.email}</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              signOut().catch((err) => console.error('Sign out failed:', err))
            }}
            className="sign-out-button"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<ScheduleGrid />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </main>

      <footer className="footer">
        <p className="hint">Click a cell in your row to toggle availability.</p>
        <p>
          <a
            href="https://github.com/resynthesize/nat20.day"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            github
          </a>
        </p>
      </footer>

      <CreatePartyModal
        isOpen={showCreatePartyModal}
        onClose={() => setShowCreatePartyModal(false)}
      />
    </div>
  )
}

function App() {
  const { loading, signInWithGoogle, isAuthenticated } = useAuth()
  const location = useLocation()

  const [tagline] = useState(
    () => taglines[Math.floor(Math.random() * taglines.length)]
  )

  // Serve docs publicly without authentication
  if (location.pathname.startsWith('/docs')) {
    return <DocsPage />
  }

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner" />
        <p>Rolling for initiative...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app login-screen">
        <div className="login-container">
          <h1 className="title">nat20.day</h1>
          <p className="subtitle">D&D Session Scheduler</p>
          <p className="tagline">"{tagline}"</p>
          <LoginButton onClick={signInWithGoogle} />
        </div>
      </div>
    )
  }

  return (
    <PartyProvider>
      <AuthenticatedApp />
    </PartyProvider>
  )
}

export default App
