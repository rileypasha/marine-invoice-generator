import { Page, BrowserContext, expect } from '@playwright/test';

/**
 * Install PWA and wait for confirmation
 */
export async function installPWA(page: Page): Promise<boolean> {
  let installPromptFired = false;

  // Listen for beforeinstallprompt event
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        (window as any).deferredPrompt = e;
        resolve();
      });

      // If event already fired, resolve immediately
      if ((window as any).deferredPrompt) {
        resolve();
      }

      // Timeout after 5 seconds
      setTimeout(resolve, 5000);
    });
  });

  // Trigger install
  installPromptFired = await page.evaluate(async () => {
    const deferredPrompt = (window as any).deferredPrompt;
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      return choiceResult.outcome === 'accepted';
    } catch {
      return false;
    }
  });

  return installPromptFired;
}

/**
 * Check if PWA install prompt is available
 */
export async function isPWAInstallable(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return !!(window as any).deferredPrompt ||
           window.matchMedia('(display-mode: standalone)').matches;
  });
}

/**
 * Get PWA display mode
 */
export async function getPWADisplayMode(page: Page): Promise<string> {
  return await page.evaluate(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone';
    if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen';
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui';
    return 'browser';
  });
}

/**
 * Check service worker status
 */
export interface ServiceWorkerStatus {
  registered: boolean;
  active: boolean;
  waiting: boolean;
  installing: boolean;
  scope?: string;
  scriptURL?: string;
}

export async function checkServiceWorker(page: Page): Promise<ServiceWorkerStatus> {
  return await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return {
        registered: false,
        active: false,
        waiting: false,
        installing: false,
      };
    }

    const registration = await navigator.serviceWorker.getRegistration();

    if (!registration) {
      return {
        registered: false,
        active: false,
        waiting: false,
        installing: false,
      };
    }

    return {
      registered: true,
      active: !!registration.active,
      waiting: !!registration.waiting,
      installing: !!registration.installing,
      scope: registration.scope,
      scriptURL: registration.active?.scriptURL,
    };
  });
}

/**
 * Wait for service worker to activate
 */
export async function waitForServiceWorkerActivation(page: Page, timeout = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await checkServiceWorker(page);
    if (status.active) return true;
    await page.waitForTimeout(500);
  }

  return false;
}

/**
 * Clear all caches
 */
export async function clearCache(page: Page) {
  await page.evaluate(async () => {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
  });
}

/**
 * Get cached URLs
 */
export async function getCachedURLs(page: Page): Promise<string[]> {
  return await page.evaluate(async () => {
    if (!('caches' in window)) return [];

    const cacheNames = await caches.keys();
    const allURLs: string[] = [];

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      allURLs.push(...requests.map((req) => req.url));
    }

    return allURLs;
  });
}

/**
 * Check if specific URL is cached
 */
export async function isURLCached(page: Page, url: string): Promise<boolean> {
  return await page.evaluate(async (targetUrl) => {
    if (!('caches' in window)) return false;

    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const response = await cache.match(targetUrl);
      if (response) return true;
    }

    return false;
  }, url);
}

/**
 * Mock network status
 */
export async function mockNetworkStatus(page: Page, online: boolean) {
  await page.evaluate((isOnline) => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: isOnline,
    });

    window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'));
  }, online);
}

/**
 * Get current network status from page
 */
export async function getNetworkStatus(page: Page): Promise<boolean> {
  return await page.evaluate(() => navigator.onLine);
}

/**
 * Wait for specific cache to populate
 */
export async function waitForCache(page: Page, expectedURLCount: number, timeout = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const cachedURLs = await getCachedURLs(page);
    if (cachedURLs.length >= expectedURLCount) return true;
    await page.waitForTimeout(500);
  }

  return false;
}

/**
 * Check manifest properties
 */
export interface ManifestData {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  background_color?: string;
  theme_color?: string;
  icons?: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
}

export async function getManifest(page: Page): Promise<ManifestData | null> {
  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');

  if (!manifestLink) return null;

  const manifestURL = new URL(manifestLink, page.url()).href;

  try {
    const manifestData = await page.evaluate(async (url) => {
      const response = await fetch(url);
      return await response.json();
    }, manifestURL);

    return manifestData;
  } catch {
    return null;
  }
}

/**
 * Verify PWA manifest completeness
 */
export async function verifyManifest(page: Page): Promise<{ valid: boolean; errors: string[] }> {
  const manifest = await getManifest(page);
  const errors: string[] = [];

  if (!manifest) {
    return { valid: false, errors: ['No manifest found'] };
  }

  // Required fields
  if (!manifest.name) errors.push('Missing: name');
  if (!manifest.short_name) errors.push('Missing: short_name');
  if (!manifest.start_url) errors.push('Missing: start_url');
  if (!manifest.display) errors.push('Missing: display');

  // Icons
  if (!manifest.icons || manifest.icons.length === 0) {
    errors.push('Missing: icons');
  } else {
    const has192 = manifest.icons.some((icon) => icon.sizes.includes('192'));
    const has512 = manifest.icons.some((icon) => icon.sizes.includes('512'));

    if (!has192) errors.push('Missing 192x192 icon');
    if (!has512) errors.push('Missing 512x512 icon');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if icons are accessible
 */
export async function verifyIcons(page: Page): Promise<{ valid: boolean; failures: string[] }> {
  const manifest = await getManifest(page);
  const failures: string[] = [];

  if (!manifest?.icons) {
    return { valid: false, failures: ['No icons in manifest'] };
  }

  for (const icon of manifest.icons) {
    const iconURL = new URL(icon.src, page.url()).href;

    try {
      const response = await page.request.get(iconURL);
      if (!response.ok()) {
        failures.push(`Icon ${icon.src} returned ${response.status()}`);
      }
    } catch (error) {
      failures.push(`Icon ${icon.src} failed to load: ${error}`);
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Simulate app install on iOS (add to home screen)
 */
export async function simulateIOSInstall(page: Page): Promise<boolean> {
  // Check for iOS-specific meta tags
  const hasAppleIcon = await page.locator('link[rel="apple-touch-icon"]').count() > 0;
  const hasAppleMobileCapable = await page.locator('meta[name="apple-mobile-web-app-capable"]').count() > 0;

  return hasAppleIcon && hasAppleMobileCapable;
}

/**
 * Check for iOS splash screen
 */
export async function hasIOSSplashScreen(page: Page): Promise<boolean> {
  const splashScreenLinks = await page.locator('link[rel="apple-touch-startup-image"]').count();
  return splashScreenLinks > 0;
}

/**
 * Test cache strategies
 */
export async function testCacheStrategy(
  page: Page,
  url: string,
  expectedStrategy: 'cache-first' | 'network-first' | 'stale-while-revalidate'
): Promise<boolean> {
  // First load - should go to network
  const firstResponse = await page.goto(url, { waitUntil: 'networkidle' });
  const firstFromCache = firstResponse?.headers()['x-from-cache'] === '1';

  // Second load - behavior depends on strategy
  await page.reload({ waitUntil: 'networkidle' });

  const cachedURLs = await getCachedURLs(page);
  const isCached = cachedURLs.some((cachedURL) => cachedURL.includes(url));

  switch (expectedStrategy) {
    case 'cache-first':
      return isCached && !firstFromCache; // First from network, second from cache
    case 'network-first':
      return !firstFromCache; // Always from network when online
    case 'stale-while-revalidate':
      return isCached; // URL should be cached for background refresh
    default:
      return false;
  }
}
