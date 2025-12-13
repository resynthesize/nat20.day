import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useLocation, useSearchParams, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { HomePage } from './pages/HomePage'
import { DemoPage } from './pages/DemoPage'
import { GuidePage } from './pages/GuidePage'
import { DocsPage } from './pages/DocsPage'
import { SignupPage } from './pages/SignupPage'
import { OAuthConsentPage } from './pages/OAuthConsentPage'
import { PartyProvider, useParty } from './hooks/useParty'
import { ThemeProvider } from './hooks/useTheme'
import { usePrefetchOnLogin } from './hooks/usePrefetchOnLogin'
import { AuthTabs } from './components/organisms/auth'
import { ScheduleGrid } from './components/organisms/schedule'
import { ProfilePage } from './components/organisms/profile'
import { AdminPanel } from './components/organisms/admin'
import { PartySelector, CreatePartyModal } from './components/organisms/party'
import { MobileMenu } from './components/organisms/header'
import { STORAGE_KEYS, UI_TIMING } from './lib/constants'
import './styles/index.css'

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

/**
 * Authenticated app component - shown when user is logged in at /app/*
 */
function AuthenticatedApp() {
  const { user, profile, signOut } = useAuth()
  const { isAdmin, refreshParties } = useParty()
  const [showCreatePartyModal, setShowCreatePartyModal] = useState(false)

  // Prefetch admin panel data for faster navigation
  usePrefetchOnLogin()
  const [searchParams, setSearchParams] = useSearchParams()

  const { session } = useAuth()

  // Initialize checkout message from URL params (read once on mount)
  const [checkoutMessage, setCheckoutMessage] = useState<{ type: 'success' | 'canceled'; text: string } | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const checkoutStatus = params.get('checkout')
    if (checkoutStatus === 'success') {
      return { type: 'success', text: 'Party created successfully! Welcome to your new adventure.' }
    } else if (checkoutStatus === 'canceled') {
      return { type: 'canceled', text: 'Checkout was canceled. You can try again anytime.' }
    }
    return null
  })

  // Track pending signup to prevent duplicate API calls (ref to avoid re-render)
  const pendingSignupProcessed = useRef(false)

  // Handle pending signup completion (from pre-auth signup flow)
  useEffect(() => {
    const pendingSignupId = searchParams.get('complete_signup')
    if (!pendingSignupId || !session || pendingSignupProcessed.current) return

    pendingSignupProcessed.current = true

    // Call the signup completion endpoint
    fetch('/api/v1/signup/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        pending_signup_id: pendingSignupId,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => null)
          throw new Error(errorData?.message || 'Failed to complete signup')
        }
        return res.json()
      })
      .then((data) => {
        // Clear pending signup from localStorage
        localStorage.removeItem(STORAGE_KEYS.PENDING_SIGNUP)
        setCheckoutMessage({ type: 'success', text: `Party "${data.party_name}" created successfully! Welcome to your new adventure.` })
        // Refresh parties and select the newest one
        refreshParties({ selectNewest: true })
      })
      .catch((err) => {
        console.error('Failed to complete signup:', err)
        setCheckoutMessage({ type: 'canceled', text: err.message || 'Failed to complete signup. Please try again.' })
      })
      .finally(() => {
        // Clean up the URL
        searchParams.delete('complete_signup')
        setSearchParams(searchParams, { replace: true })
      })
  }, [searchParams, setSearchParams, session, refreshParties])

  // Clean up checkout URL params and trigger side effects (runs once on mount if needed)
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout')
    if (checkoutStatus === 'success') {
      // Refresh parties to pick up the new party
      refreshParties({ selectNewest: true })
      // Clean up the URL
      searchParams.delete('checkout')
      searchParams.delete('session_id')
      setSearchParams(searchParams, { replace: true })
    } else if (checkoutStatus === 'canceled') {
      // Clean up the URL
      searchParams.delete('checkout')
      setSearchParams(searchParams, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- Run once on mount to process URL params

  // Auto-dismiss checkout message
  useEffect(() => {
    if (checkoutMessage) {
      const timer = setTimeout(() => setCheckoutMessage(null), UI_TIMING.TOAST_DURATION)
      return () => clearTimeout(timer)
    }
  }, [checkoutMessage])

  return (
    <div className="schedule-container">
      <header className="header">
        <div className="header-left">
          <Link to="/app" className="title-link">
            <h1 className="title">nat20.day</h1>
          </Link>
          <PartySelector onCreateParty={() => setShowCreatePartyModal(true)} />
        </div>
        <div className="header-right">
          {/* Desktop: show all items */}
          <div className="header-right-desktop">
            {isAdmin && (
              <Link to="/app/admin" className="admin-link">
                Settings
              </Link>
            )}
            <Link to="/app/profile" className="user-info">
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
                signOut()
                  .then(() => {
                    window.location.href = '/'
                  })
                  .catch((err) => console.error('Sign out failed:', err))
              }}
              className="sign-out-button"
            >
              Sign Out
            </button>
          </div>

          {/* Mobile: hamburger menu */}
          <MobileMenu
            isAdmin={isAdmin}
            profile={profile}
            user={user}
            onSignOut={signOut}
          />
        </div>
      </header>

      {checkoutMessage && (
        <div className={`checkout-banner checkout-${checkoutMessage.type}`}>
          <span>{checkoutMessage.text}</span>
          <button
            type="button"
            className="checkout-banner-dismiss"
            onClick={() => setCheckoutMessage(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <main className="main">
        <Routes>
          <Route path="/" element={<ScheduleGrid />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>Click a cell in your row to toggle availability.</p>
        <p>
          <a
            href="https://github.com/resynthesize/nat20.day"
            target="_blank"
            rel="noopener noreferrer"
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

/**
 * Login page for unauthenticated users who navigate to /app
 */
function LoginPage() {
  const [tagline] = useState(
    () => taglines[Math.floor(Math.random() * taglines.length)]
  )

  return (
    <div className="login-page">
      <div className="login-content">
        <h1>nat20.day</h1>
        <p className="subtitle">D&D Session Scheduler</p>
        <p className="tagline">"{tagline}"</p>
        <AuthTabs />
        <p className="login-back-link">
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </div>
  )
}

/**
 * Public routes wrapper - handles routes that don't require authentication
 */
function PublicRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/guide" element={<GuidePage />} />
      <Route path="/guide/:section" element={<GuidePage />} />
      <Route path="/privacy" element={<PlaceholderPage title="Privacy Policy" />} />
      <Route path="/terms" element={<PlaceholderPage title="Terms of Service" />} />
    </Routes>
  )
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>Coming soon.</p>
      <Link to="/">← Back to home</Link>
    </div>
  )
}

/**
 * Main App component with routing logic
 *
 * Route structure:
 * - / : Public landing page (HomePage)
 * - /demo : Demo party (public)
 * - /guide/* : User documentation (public)
 * - /docs : API documentation (public)
 * - /oauth/consent : OAuth consent page
 * - /app/* : Authenticated app routes
 */
function App() {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Check if this is a public route
  const publicPaths = ['/', '/demo', '/signup', '/guide', '/privacy', '/terms']
  const isPublicPath = publicPaths.some(path =>
    location.pathname === path || location.pathname.startsWith(path + '/')
  )

  // Serve docs publicly without authentication
  if (location.pathname.startsWith('/docs')) {
    return <DocsPage />
  }

  // OAuth consent page handles its own auth flow
  if (location.pathname.startsWith('/oauth/consent')) {
    return <OAuthConsentPage />
  }

  // Public routes - render without auth check
  if (isPublicPath) {
    return <PublicRoutes />
  }

  // For /app/* routes, check authentication

  if (loading) {
    return (
      <div className="app loading-screen">
        <div className="loading-spinner" />
        <p>Rolling for initiative...</p>
      </div>
    )
  }

  // /app routes require authentication
  if (location.pathname.startsWith('/app')) {
    if (!isAuthenticated) {
      return <LoginPage />
    }

    return (
      <PartyProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/app/*" element={<AuthenticatedApp />} />
          </Routes>
        </ThemeProvider>
      </PartyProvider>
    )
  }

  // Default: redirect to home
  return <Navigate to="/" replace />
}

export default App
