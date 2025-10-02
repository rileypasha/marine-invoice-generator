/**
 * Network Status Monitor Hook
 *
 * Detects online/offline state, connection quality, and auto-retries
 * failed requests when connection is restored.
 */

import { useEffect, useState, useCallback } from 'react'
import { processQueue, getQueueStats } from '../db/queue'
import { useQueryClient } from '@tanstack/react-query'

export interface NetworkStatus {
  online: boolean
  effectiveType?: '2g' | '3g' | '4g' | '5g' | 'slow-2g'
  downlink?: number // Mbps
  rtt?: number // Round trip time in ms
  saveData?: boolean
}

export interface NetworkStatusHook extends NetworkStatus {
  isPending: boolean
  pendingCount: number
  conflictCount: number
  retryPending: () => Promise<void>
  isRetrying: boolean
}

// Debounce duration to avoid flickering
const DEBOUNCE_MS = 500

/**
 * Hook to monitor network status and manage offline queue
 */
export function useNetworkStatus(): NetworkStatusHook {
  const queryClient = useQueryClient()

  // Network status state
  const [online, setOnline] = useState(navigator.onLine)
  const [networkInfo, setNetworkInfo] = useState<Partial<NetworkStatus>>({})
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)

  // Debounced online status to prevent flicker
  const [debouncedOnline, setDebouncedOnline] = useState(navigator.onLine)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOnline(online)
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [online])

  // Update queue stats
  const updateQueueStats = useCallback(async () => {
    try {
      const stats = await getQueueStats()
      setPendingCount(stats.total)
      setConflictCount(stats.conflicts)
    } catch (error) {
      console.error('Failed to get queue stats:', error)
    }
  }, [])

  // Retry pending requests
  const retryPending = useCallback(async () => {
    if (!navigator.onLine || isRetrying) return

    setIsRetrying(true)
    try {
      const result = await processQueue()

      // Invalidate queries if any succeeded
      if (result.succeeded > 0) {
        queryClient.invalidateQueries()
      }

      // Update stats
      await updateQueueStats()
    } catch (error) {
      console.error('Failed to process queue:', error)
    } finally {
      setIsRetrying(false)
    }
  }, [queryClient, updateQueueStats, isRetrying])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      // Auto-retry when coming online
      retryPending()
    }

    const handleOffline = () => {
      setOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [retryPending])

  // Monitor network information API
  useEffect(() => {
    if (!('connection' in navigator)) return

    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection

    if (!connection) return

    const updateNetworkInfo = () => {
      setNetworkInfo({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      })
    }

    // Initial update
    updateNetworkInfo()

    // Listen for changes
    connection.addEventListener('change', updateNetworkInfo)

    return () => {
      connection.removeEventListener('change', updateNetworkInfo)
    }
  }, [])

  // Update queue stats periodically
  useEffect(() => {
    updateQueueStats()

    const interval = setInterval(updateQueueStats, 10000) // Every 10 seconds

    return () => clearInterval(interval)
  }, [updateQueueStats])

  return {
    online: debouncedOnline,
    effectiveType: networkInfo.effectiveType,
    downlink: networkInfo.downlink,
    rtt: networkInfo.rtt,
    saveData: networkInfo.saveData,
    isPending: pendingCount > 0,
    pendingCount,
    conflictCount,
    retryPending,
    isRetrying,
  }
}

/**
 * Hook to get connection quality assessment
 */
export function useConnectionQuality(): {
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
  description: string
} {
  const { online, effectiveType, rtt } = useNetworkStatus()

  if (!online) {
    return {
      quality: 'offline',
      description: 'No internet connection',
    }
  }

  // Assess based on effective type
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return {
      quality: 'poor',
      description: 'Slow connection (2G)',
    }
  }

  if (effectiveType === '3g') {
    return {
      quality: 'fair',
      description: 'Moderate connection (3G)',
    }
  }

  // For 4G/5G, check RTT if available
  if (rtt !== undefined) {
    if (rtt < 100) {
      return {
        quality: 'excellent',
        description: 'Excellent connection',
      }
    }
    if (rtt < 300) {
      return {
        quality: 'good',
        description: 'Good connection',
      }
    }
    return {
      quality: 'fair',
      description: 'Fair connection',
    }
  }

  // Default for 4G/5G
  return {
    quality: effectiveType === '5g' ? 'excellent' : 'good',
    description: effectiveType === '5g' ? 'Excellent connection (5G)' : 'Good connection (4G)',
  }
}

/**
 * Hook to estimate bandwidth
 */
export function useBandwidthEstimate(): {
  downlink?: number
  estimate: 'fast' | 'moderate' | 'slow' | 'unknown'
} {
  const { downlink } = useNetworkStatus()

  let estimate: 'fast' | 'moderate' | 'slow' | 'unknown' = 'unknown'

  if (downlink !== undefined) {
    if (downlink >= 10) {
      estimate = 'fast'
    } else if (downlink >= 1.5) {
      estimate = 'moderate'
    } else {
      estimate = 'slow'
    }
  }

  return { downlink, estimate }
}

/**
 * Hook to check if data saver mode is enabled
 */
export function useDataSaverMode(): boolean {
  const { saveData } = useNetworkStatus()
  return saveData === true
}
