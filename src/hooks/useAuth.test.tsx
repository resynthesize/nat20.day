import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from './useAuth'
import { BrowserRouter } from 'react-router-dom'

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
          single: () => Promise.resolve({
            data: { id: 'user-1', display_name: 'Test User', is_admin: false },
            error: null,
          }),
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
  expires_at: Math.floor(Date.now() / 1000) + 3600,
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

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: getSession resolves with no session
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  describe('initial load behavior', () => {
    it('starts in loading state', async () => {
      // Make getSession hang so we can observe loading state
      mockGetSession.mockImplementation(() => new Promise(() => {}))

      renderAuth()

      // Should start in loading state
      expect(screen.getByTestId('loading')).toHaveTextContent('loading')
    })

    it('shows not authenticated when getSession returns no session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      renderAuth()

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      })

      expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
    })

    it('shows authenticated when getSession returns valid session', async () => {
      mockGetSession.mockResolvedValue({ data: { session: validSession }, error: null })

      renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('ready')
      })

      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com')
    })
  })

  describe('auth state changes', () => {
    it('updates state when auth state changes to logged in', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
      })

      // Simulate auth state change (user logs in)
      const authCallback = mockOnAuthStateChange.mock.calls[0][0]
      await act(async () => {
        authCallback('SIGNED_IN', validSession)
      })

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })
    })

    it('updates state when auth state changes to logged out', async () => {
      mockGetSession.mockResolvedValue({ data: { session: validSession }, error: null })

      renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })

      // Simulate auth state change (user logs out)
      const authCallback = mockOnAuthStateChange.mock.calls[0][0]
      await act(async () => {
        authCallback('SIGNED_OUT', null)
      })

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
      })
    })
  })

  describe('session persistence', () => {
    it('maintains session after component remount', async () => {
      mockGetSession.mockResolvedValue({ data: { session: validSession }, error: null })

      const { unmount } = renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })

      unmount()

      // Re-render (simulating page navigation or refresh)
      renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })
    })

    it('shows not authenticated when session expires', async () => {
      // First call returns valid session
      mockGetSession.mockResolvedValueOnce({ data: { session: validSession }, error: null })

      const { unmount } = renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('yes')
      })

      unmount()

      // Second call returns no session (expired)
      mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null })

      renderAuth()

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('no')
      })
    })
  })
})
