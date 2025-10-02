/**
 * Offline Banner Component
 *
 * Displays when offline with sync status and manual retry option.
 * Sticky positioning with smooth animations.
 */

import { useState, useEffect } from 'react'
import { useNetworkStatus, useConnectionQuality } from '../hooks/useNetworkStatus'
import { WifiOff, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react'

interface OfflineBannerProps {
  className?: string
}

export function OfflineBanner({ className = '' }: OfflineBannerProps) {
  const networkStatus = useNetworkStatus()
  const { quality, description } = useConnectionQuality()
  const [dismissed, setDismissed] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!networkStatus.online) {
      setDismissed(false)
    }
  }, [networkStatus.online])

  // Show banner if offline or has pending changes (and not dismissed)
  const shouldShow =
    !dismissed && (!networkStatus.online || networkStatus.isPending || networkStatus.conflictCount > 0)

  // Auto-dismiss success message
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => {
        setShowSuccess(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [showSuccess])

  const handleRetry = async () => {
    await networkStatus.retryPending()
    if (networkStatus.pendingCount === 0) {
      setShowSuccess(true)
    }
  }

  if (!shouldShow) return null

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50
        bg-gradient-to-r
        ${
          networkStatus.online
            ? networkStatus.conflictCount > 0
              ? 'from-amber-500 to-amber-600'
              : 'from-blue-500 to-blue-600'
            : 'from-gray-700 to-gray-800'
        }
        text-white shadow-lg
        transform transition-all duration-300 ease-in-out
        ${shouldShow ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Status Icon and Message */}
          <div className="flex items-center gap-3 flex-1">
            {networkStatus.online ? (
              networkStatus.conflictCount > 0 ? (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <RefreshCw
                  className={`h-5 w-5 flex-shrink-0 ${networkStatus.isRetrying ? 'animate-spin' : ''}`}
                />
              )
            ) : (
              <WifiOff className="h-5 w-5 flex-shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Primary message */}
                <span className="font-medium">
                  {networkStatus.online ? (
                    showSuccess ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        All changes synced
                      </span>
                    ) : networkStatus.conflictCount > 0 ? (
                      `${networkStatus.conflictCount} conflict${networkStatus.conflictCount > 1 ? 's' : ''} need${networkStatus.conflictCount === 1 ? 's' : ''} resolution`
                    ) : (
                      `${networkStatus.pendingCount} change${networkStatus.pendingCount > 1 ? 's' : ''} pending`
                    )
                  ) : (
                    'You are offline'
                  )}
                </span>

                {/* Connection quality (when online) */}
                {networkStatus.online && quality !== 'excellent' && quality !== 'offline' && (
                  <span className="text-sm opacity-90">• {description}</span>
                )}
              </div>

              {/* Secondary info */}
              {!networkStatus.online && (
                <p className="text-sm opacity-90 mt-0.5">
                  Changes will sync when connection is restored
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Retry button (when online and has pending) */}
            {networkStatus.online && networkStatus.isPending && (
              <button
                onClick={handleRetry}
                disabled={networkStatus.isRetrying}
                className="
                  px-3 py-1.5 rounded-md
                  bg-white bg-opacity-20 hover:bg-opacity-30
                  transition-colors duration-200
                  text-sm font-medium
                  disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center gap-2
                "
                aria-label="Retry pending changes"
              >
                <RefreshCw
                  className={`h-4 w-4 ${networkStatus.isRetrying ? 'animate-spin' : ''}`}
                />
                Sync Now
              </button>
            )}

            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="
                p-1.5 rounded-md
                bg-white bg-opacity-0 hover:bg-opacity-20
                transition-colors duration-200
              "
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version for minimal space usage
 */
export function OfflineBannerCompact() {
  const networkStatus = useNetworkStatus()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!networkStatus.online) {
      setDismissed(false)
    }
  }, [networkStatus.online])

  const shouldShow = !dismissed && (!networkStatus.online || networkStatus.isPending)

  if (!shouldShow) return null

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50
        ${networkStatus.online ? 'bg-blue-500' : 'bg-gray-700'}
        text-white text-sm
        px-4 py-2
        flex items-center justify-between
        transform transition-transform duration-300
        ${shouldShow ? 'translate-y-0' : '-translate-y-full'}
      `}
      role="alert"
    >
      <div className="flex items-center gap-2">
        {networkStatus.online ? (
          <RefreshCw className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span>
          {networkStatus.online
            ? `${networkStatus.pendingCount} pending`
            : 'Offline mode'}
        </span>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-white hover:bg-opacity-20 rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Badge indicator for pending changes (for toolbar/nav)
 */
export function OfflineBadge() {
  const networkStatus = useNetworkStatus()

  if (!networkStatus.isPending && networkStatus.online) return null

  return (
    <div
      className="relative inline-flex items-center"
      title={
        networkStatus.online
          ? `${networkStatus.pendingCount} changes pending sync`
          : 'Offline - changes will sync when online'
      }
    >
      <div
        className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium
        ${networkStatus.online ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}
      `}
      >
        {networkStatus.online ? (
          <>
            <RefreshCw className="h-3 w-3" />
            <span>{networkStatus.pendingCount}</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
          </>
        )}
      </div>

      {/* Animated dot for activity */}
      {networkStatus.isRetrying && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
      )}
    </div>
  )
}
