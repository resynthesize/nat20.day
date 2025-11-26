import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { LoginButton } from './components/auth/LoginButton'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
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

function App() {
  const { user, profile, loading, signInWithGoogle, signOut, isAuthenticated } =
    useAuth()

  const [tagline] = useState(
    () => taglines[Math.floor(Math.random() * taglines.length)]
  )

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
          <h1 className="title">NAT 20</h1>
          <p className="subtitle">D&D Session Scheduler</p>
          <p className="tagline">"{tagline}"</p>
          <LoginButton onClick={signInWithGoogle} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="title">NAT 20</h1>
        </div>
        <div className="header-right">
          <div className="user-info">
            {profile?.avatar_url && (
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="user-avatar"
              />
            )}
            <span className="user-name">{profile?.display_name || user?.email}</span>
          </div>
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
        <ScheduleGrid />
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
            View source on GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}

export default App
