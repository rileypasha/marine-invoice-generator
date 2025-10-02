/**
 * Service Worker Registration
 *
 * Registers service worker with offline support and background sync.
 */

import { requestPersistentStorage } from '../db/cache'
import { registerBackgroundSync } from '../db/queue'

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void
  onUpdate?: (registration: ServiceWorkerRegistration) => void
  onError?: (error: Error) => void
}

/**
 * Register service worker
 */
export async function registerServiceWorker(
  config: ServiceWorkerConfig = {}
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers are not supported')
    return null
  }

  try {
    // Request persistent storage
    const isPersisted = await requestPersistentStorage()
    console.log('Persistent storage:', isPersisted ? 'granted' : 'not granted')

    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('Service worker registered:', registration.scope)

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing

      if (!newWorker) return

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          console.log('New service worker available')
          config.onUpdate?.(registration)
        }
      })
    })

    // Check for updates periodically
    setInterval(() => {
      registration.update()
    }, 60 * 60 * 1000) // Check every hour

    // Register background sync
    await registerBackgroundSync()

    config.onSuccess?.(registration)

    return registration
  } catch (error) {
    console.error('Service worker registration failed:', error)
    config.onError?.(error as Error)
    return null
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      return await registration.unregister()
    }
    return false
  } catch (error) {
    console.error('Service worker unregistration failed:', error)
    return false
  }
}

/**
 * Check if service worker is active
 */
export async function isServiceWorkerActive(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return !!registration?.active
  } catch {
    return false
  }
}

/**
 * Send message to service worker
 */
export async function sendMessageToServiceWorker(message: any): Promise<any> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    throw new Error('No active service worker')
  }

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel()

    messageChannel.port1.onmessage = event => {
      if (event.data.error) {
        reject(new Error(event.data.error))
      } else {
        resolve(event.data)
      }
    }

    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2])
  })
}

/**
 * Prompt user to update service worker
 */
export function promptServiceWorkerUpdate(
  onAccept: () => void,
  onDecline: () => void
): void {
  const shouldUpdate = confirm(
    'A new version of the app is available. Update now? (Recommended)'
  )

  if (shouldUpdate) {
    onAccept()
  } else {
    onDecline()
  }
}

/**
 * Skip waiting and activate new service worker
 */
export async function activateNewServiceWorker(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()

  if (!registration?.waiting) {
    throw new Error('No waiting service worker')
  }

  // Send skip waiting message
  registration.waiting.postMessage({ type: 'SKIP_WAITING' })

  // Reload when new worker is activated
  return new Promise(resolve => {
    const handleControllerChange = () => {
      window.location.reload()
      resolve()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, {
      once: true,
    })
  })
}
