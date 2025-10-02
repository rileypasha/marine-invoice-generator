/**
 * PWA Utilities
 * Helper functions for Progressive Web App features
 */

/**
 * Check if the app is running in standalone (installed) mode
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for iOS standalone mode
  const isIOSStandalone = (window.navigator as any).standalone === true;

  // Check for Android/Desktop standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return isIOSStandalone || isStandalone;
}

/**
 * Detect if running on iOS device
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * Detect if running on Android device
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
}

/**
 * Check if the app can be installed
 */
export function canInstall(): boolean {
  if (typeof window === 'undefined') return false;

  // Already installed
  if (isPWA()) return false;

  // Check if browser supports installation
  return 'BeforeInstallPromptEvent' in window || isIOS();
}

/**
 * Request persistent storage to prevent cache eviction
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return false;
  }

  try {
    // Check if storage is already persisted
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      return true;
    }

    // Request persistent storage
    const result = await navigator.storage.persist();
    return result;
  } catch (error) {
    console.error('Failed to request persistent storage:', error);
    return false;
  }
}

/**
 * Get storage quota information
 */
export async function getStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      percentUsed,
    };
  } catch (error) {
    console.error('Failed to get storage quota:', error);
    return null;
  }
}

/**
 * Get network status
 */
export interface NetworkStatus {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export function getNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return { online: true };
  }

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
    saveData: connection?.saveData || false,
  };
}

/**
 * Listen for network status changes
 */
export function onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => callback(getNetworkStatus());

  window.addEventListener('online', handleChange);
  window.addEventListener('offline', handleChange);

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  connection?.addEventListener('change', handleChange);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleChange);
    window.removeEventListener('offline', handleChange);
    connection?.removeEventListener('change', handleChange);
  };
}

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

/**
 * Register for push notifications (if supported)
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return null;
  }
}

/**
 * Check if notifications are supported and permitted
 */
export function canNotify(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  return Notification.permission === 'granted';
}

/**
 * Show a notification (if permitted)
 */
export async function showNotification(
  title: string,
  options?: NotificationOptions
): Promise<Notification | null> {
  if (!canNotify()) {
    return null;
  }

  try {
    return new Notification(title, options);
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
}

/**
 * Get app version from package.json or manifest
 */
export function getAppVersion(): string {
  // This would be injected at build time
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_APP_VERSION || '1.0.0';
  }
  return '1.0.0';
}

/**
 * Check if app update is available
 */
export function checkForUpdate(currentVersion: string, latestVersion: string): boolean {
  // Simple version comparison (assumes semantic versioning)
  return currentVersion !== latestVersion;
}
