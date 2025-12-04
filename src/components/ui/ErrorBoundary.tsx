import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for catching and gracefully handling React render errors.
 * Prevents the entire app from crashing due to a component error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging - could be sent to an error reporting service
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h1>A wild error appeared!</h1>
            <p className="error-boundary-subtitle">
              Something went wrong while rendering this page.
            </p>

            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Technical details</summary>
                <pre>{this.state.error.message}</pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button
                type="button"
                onClick={this.handleRetry}
                className="error-boundary-button primary"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="error-boundary-button secondary"
              >
                Reload Page
              </button>
            </div>

            <p className="error-boundary-hint">
              If this keeps happening, try clearing your browser cache or{' '}
              <a href="https://github.com/resynthesize/nat20.day/issues" target="_blank" rel="noopener noreferrer">
                report the issue
              </a>.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
