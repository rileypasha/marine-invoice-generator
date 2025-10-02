import { Page, expect } from '@playwright/test';

/**
 * Mobile device configurations for testing
 */
export const MOBILE_DEVICES = {
  iPhoneSE: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  iPhone14: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  pixel5: { width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
  iPadMini: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;

export type DeviceType = keyof typeof MOBILE_DEVICES;

/**
 * Set viewport to specific mobile device
 */
export async function setViewport(page: Page, device: DeviceType) {
  const config = MOBILE_DEVICES[device];
  await page.setViewportSize({ width: config.width, height: config.height });
}

/**
 * Simulate offline network condition
 */
export async function simulateOffline(page: Page) {
  await page.context().setOffline(true);
}

/**
 * Simulate online network condition
 */
export async function simulateOnline(page: Page) {
  await page.context().setOffline(false);
}

/**
 * Simulate slow 3G network
 */
export async function simulateSlowNetwork(page: Page) {
  await page.route('**/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // 2s delay
    await route.continue();
  });
}

/**
 * Simulate fast 4G network
 */
export async function simulateFastNetwork(page: Page) {
  await page.route('**/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
    await route.continue();
  });
}

/**
 * Measure FPS during an action
 */
export async function measureFPS(page: Page, action: () => Promise<void>): Promise<number> {
  // Start performance measurement
  await page.evaluate(() => {
    (window as any).__fpsFrames = 0;
    (window as any).__fpsStart = performance.now();

    const countFrame = () => {
      (window as any).__fpsFrames++;
      requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);
  });

  // Perform action
  await action();

  // Calculate FPS
  const fps = await page.evaluate(() => {
    const frames = (window as any).__fpsFrames;
    const duration = (performance.now() - (window as any).__fpsStart) / 1000;
    return Math.round(frames / duration);
  });

  return fps;
}

/**
 * Measure input latency
 */
export async function measureInputLatency(page: Page, selector: string, text: string): Promise<number> {
  const input = page.locator(selector);
  await input.focus();

  const startTime = Date.now();
  await input.type(text, { delay: 0 });

  // Wait for debounced update
  await page.waitForTimeout(100);

  const endTime = Date.now();
  return endTime - startTime;
}

/**
 * Check if element meets minimum touch target size (44x44px)
 */
export async function checkTouchTargetSize(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  const box = await element.boundingBox();

  if (!box) return false;

  const MIN_SIZE = 44;
  return box.width >= MIN_SIZE && box.height >= MIN_SIZE;
}

/**
 * Verify all touch targets on page meet minimum size
 */
export async function verifyAllTouchTargets(page: Page): Promise<{ passed: boolean; failures: string[] }> {
  const interactiveSelectors = [
    'button',
    'a',
    'input[type="button"]',
    'input[type="submit"]',
    '[role="button"]',
    '[onclick]',
  ];

  const failures: string[] = [];

  for (const selector of interactiveSelectors) {
    const elements = await page.locator(selector).all();

    for (let i = 0; i < elements.length; i++) {
      const box = await elements[i].boundingBox();
      if (box && (box.width < 44 || box.height < 44)) {
        const text = await elements[i].textContent();
        failures.push(`${selector}[${i}]: ${box.width}x${box.height}px - "${text}"`);
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Simulate pull-to-refresh gesture
 */
export async function pullToRefresh(page: Page) {
  await page.touchscreen.tap(200, 100);
  await page.mouse.move(200, 100);
  await page.mouse.down();
  await page.mouse.move(200, 400, { steps: 10 });
  await page.mouse.up();
}

/**
 * Simulate swipe gesture (left/right/up/down)
 */
export async function swipe(page: Page, direction: 'left' | 'right' | 'up' | 'down', startX = 200, startY = 400) {
  const distance = 200;
  let endX = startX;
  let endY = startY;

  switch (direction) {
    case 'left':
      endX -= distance;
      break;
    case 'right':
      endX += distance;
      break;
    case 'up':
      endY -= distance;
      break;
    case 'down':
      endY += distance;
      break;
  }

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Check if page is in PWA standalone mode
 */
export async function isPWAStandalone(page: Page): Promise<boolean> {
  return await page.evaluate(() => window.matchMedia('(display-mode: standalone)').matches);
}

/**
 * Measure Core Web Vitals
 */
export interface WebVitals {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
}

export async function measureWebVitals(page: Page): Promise<WebVitals> {
  return await page.evaluate(() => {
    return new Promise<WebVitals>((resolve) => {
      const vitals: WebVitals = {};

      // LCP
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FID
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          vitals.FID = entry.processingStart - entry.startTime;
        });
      }).observe({ entryTypes: ['first-input'] });

      // CLS
      let clsValue = 0;
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        vitals.CLS = clsValue;
      }).observe({ entryTypes: ['layout-shift'] });

      // FCP and TTFB from Navigation Timing
      const perfData = performance.getEntriesByType('navigation')[0] as any;
      if (perfData) {
        vitals.FCP = perfData.responseStart - perfData.requestStart;
        vitals.TTFB = perfData.responseStart - perfData.requestStart;
      }

      // Resolve after a delay to collect metrics
      setTimeout(() => resolve(vitals), 5000);
    });
  });
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Check if service worker is registered
 */
export async function isServiceWorkerRegistered(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    }
    return false;
  });
}

/**
 * Unregister all service workers (for test cleanup)
 */
export async function unregisterServiceWorkers(page: Page) {
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  });
}
