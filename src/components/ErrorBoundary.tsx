/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 *
 * @module ErrorBoundary
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  /** Custom fallback UI component */
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode)
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Reset error boundary when this key changes */
  resetKeys?: Array<string | number>
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary Component
 *
 * Catches errors in child components and displays fallback UI
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={<ErrorFallback />}
 *   onError={(error, errorInfo) => {
 *     logErrorToService(error, errorInfo)
 *   }}
 * >
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    })

    // Call onError callback if provided
    this.props.onError?.(error, errorInfo)

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error Boundary caught error:', error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props
    const { hasError } = this.state

    // Reset error boundary if reset keys change
    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])

      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback } = this.props

    if (hasError && error) {
      // Render custom fallback if provided
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, errorInfo!)
        }
        return fallback
      }

      // Default fallback UI
      return <DefaultErrorFallback error={error} errorInfo={errorInfo!} onReset={this.resetErrorBoundary} />
    }

    return children
  }
}

interface DefaultErrorFallbackProps {
  error: Error
  errorInfo: ErrorInfo
  onReset: () => void
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({ error, errorInfo, onReset }: DefaultErrorFallbackProps) {
  const isDev = import.meta.env.DEV

  return (
    <div
      style={{
        padding: '20px',
        margin: '20px',
        border: '2px solid #ef4444',
        borderRadius: '8px',
        backgroundColor: '#fef2f2',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ color: '#dc2626', marginTop: 0 }}>Something went wrong</h2>

      <p style={{ color: '#991b1b' }}>
        An error occurred while rendering this component. Please try refreshing the page.
      </p>

      {isDev && (
        <details style={{ marginTop: '16px', fontSize: '14px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>Error Details</summary>

          <div
            style={{
              padding: '12px',
              backgroundColor: '#fee2e2',
              borderRadius: '4px',
              marginTop: '8px',
              fontFamily: 'monospace',
              fontSize: '12px',
              overflowX: 'auto',
            }}
          >
            <strong>Error:</strong>
            <pre style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{error.toString()}</pre>

            <strong>Stack Trace:</strong>
            <pre style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{error.stack}</pre>

            <strong>Component Stack:</strong>
            <pre style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>{errorInfo.componentStack}</pre>
          </div>
        </details>
      )}

      <button
        onClick={onReset}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#b91c1c'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#dc2626'
        }}
      >
        Try Again
      </button>
    </div>
  )
}

/**
 * Route Error Boundary - specialized for route-level errors
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '48px', margin: '0 0 16px 0' }}>Oops!</h1>
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '24px' }}>
            We couldn't load this page. Please try again.
          </p>

          {import.meta.env.DEV && (
            <p style={{ fontSize: '14px', color: '#999', fontFamily: 'monospace' }}>{error.message}</p>
          )}

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: '#0284c7',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )}
      onError={(error, errorInfo) => {
        // Log route errors to analytics
        console.error('Route error:', error, errorInfo)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * Chunk Loading Error Boundary - handles code splitting failures
 */
export function ChunkErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(error) => {
        const isChunkError = error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')

        if (isChunkError) {
          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                padding: '20px',
                textAlign: 'center',
              }}
            >
              <h1 style={{ fontSize: '32px', margin: '0 0 16px 0' }}>Update Available</h1>
              <p style={{ fontSize: '18px', color: '#666', marginBottom: '24px' }}>
                A new version of the app is available. Please reload to continue.
              </p>

              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  backgroundColor: '#0284c7',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Reload Now
              </button>
            </div>
          )
        }

        return <DefaultErrorFallback error={error} errorInfo={null as any} onReset={() => window.location.reload()} />
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
