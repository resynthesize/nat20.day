import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'
import { BrowserRouter } from 'react-router-dom'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock Supabase
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignInWithOAuth = vi.fn()
const mockSignOut = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (callback: unknown) => {
        mockOnAuthStateChange(callback)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signInWithOAuth: (opts: unknown) => mockSignInWithOAuth(opts),
      signOut: () => mockSignOut(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'user-1', display_name: 'Test User', is_admin: false }, error: null }),
        }),
      }),
    }),
  },
}))

function TestConsumer() {
  const { loading, user, isAuthenticated } = useAuth()
  return (
    <div>
      <span data-testid="loading">{loading ? 'loading' : 'ready'}</span>
      <span data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.email ?? 'none'}</span>
    </div>
  )
}

function renderAuth() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </BrowserRouter>
  )
}

const validSession = {
  access_token: 'valid-token',
  refresh_token: 'refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'user-1',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01',
  },
}

const expiredSession = {
  ...validSession,
  expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    // Default: getSession resolves with no session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('instant load behavior', () => {
    it('shows login immediately when no stored session exists', async () => {
      // No session in localStorage
      renderAuth()

      // Should immediately show ready (not loading) and not authenticated
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
    })

    it('shows authenticated state immediately when valid session exists in localStorage', async () => {
      // Store a valid session in localStorage
      localStorageMock.setItem('nat20-auth', JSON.stringify(validSession))
      mockGetSession.mockResolvedValue({ data: { session: validSession }, error: null })

      renderAuth()

      // Should immediately show authenticated (using stored session)
      // Not loading spinner!
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      })
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })

    it('uses stored session instantly without waiting for getSession', async () => {
      // Store a valid session
      localStorageMock.setItem('nat20-auth', JSON.stringify(validSession))

      // Make getSession slow
      mockGetSession.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({ data: { session: validSession }, error: null }), 1000)
      }))

      renderAuth()

      // Should NOT be in loading state - should use cached session immediately
      expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
    })
  })

  describe('session persistence on refresh', () => {
    it('maintains session after simulated page refresh', async () => {
      // Store a valid session
      localStorageMock.setItem('nat20-auth', JSON.stringify(validSession))
      mockGetSession.mockResolvedValue({ data: { session: validSession }, error: null })

      const { unmount } = renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })

      // Simulate page refresh by unmounting and remounting
      unmount()

      // Session should still be in localStorage
      expect(localStorageMock.getItem('nat20-auth')).not.toBeNull()

      // Re-render (simulating page load after refresh)
      renderAuth()

      // Should still be authenticated
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })
    })

    it('handles expired session by showing login', async () => {
      // Store an expired session
      localStorageMock.setItem('nat20-auth', JSON.stringify(expiredSession))
      // Supabase getSession returns null for expired session
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      renderAuth()

      // Should show login (not authenticated) after validation
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
      })
    })
  })

  describe('background session validation', () => {
    it('updates state if background validation returns different result', async () => {
      // Start with valid session in localStorage
      localStorageMock.setItem('nat20-auth', JSON.stringify(validSession))

      // But getSession says it's invalid
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      renderAuth()

      // Initially should use stored session
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')

      // After validation, should update to logged out
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
      })
    })
  })
})
