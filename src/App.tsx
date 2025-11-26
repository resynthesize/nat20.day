import { useAuth } from './hooks/useAuth'
import { LoginButton } from './components/auth/LoginButton'
import { ScheduleGrid } from './components/schedule/ScheduleGrid'
import './App.css'

function App() {
  const { user, profile, loading, signInWithGoogle, signOut, isAuthenticated } =
    useAuth()

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner" />
        <p>Gathering the party...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app login-screen">
        <div className="login-container">
          <h1 className="title">Gather Party</h1>
          <p className="subtitle">D&D Session Scheduler</p>
          <p className="tagline">
            "You must gather your party before venturing forth."
          </p>
          <LoginButton onClick={signInWithGoogle} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1 className="title">Gather Party</h1>
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
          <button onClick={signOut} className="sign-out-button">
            Sign Out
          </button>
        </div>
      </header>

      <main className="main">
        <ScheduleGrid />
      </main>

      <footer className="footer">
        <p>Mark your availability for upcoming Thursday and Friday sessions.</p>
        <p className="hint">Click a cell in your row to toggle availability.</p>
      </footer>
    </div>
  )
}

export default App
