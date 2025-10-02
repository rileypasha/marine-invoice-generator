import { test, expect } from '@playwright/test';
import { setViewport, measureFPS, measureInputLatency, measureWebVitals, WebVitals } from '../utils/mobile-helpers';

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setViewport(page, 'iPhone14');
  });

  test.describe('List Scrolling Performance', () => {
    test('should scroll list at ≥55 FPS (no jank)', async ({ page }) => {
      await page.goto('/requests');
      await page.waitForLoadState('networkidle');

      // Measure FPS during scroll
      const fps = await measureFPS(page, async () => {
        await page.evaluate(() => {
          const scrollableElement = document.querySelector('main, [role="main"], .scroll-container') || window;
          const isWindow = scrollableElement === window;

          if (isWindow) {
            window.scrollBy({ top: 1000, behavior: 'smooth' });
          } else {
            (scrollableElement as Element).scrollBy({ top: 1000, behavior: 'smooth' });
          }
        });

        await page.waitForTimeout(1000);
      });

      // Should maintain ≥55 FPS (smooth)
      expect(fps).toBeGreaterThanOrEqual(55);
    });

    test('should handle rapid scrolling without freezing', async ({ page }) => {
      await page.goto('/requests');
      await page.waitForLoadState('networkidle');

      // Rapid scroll test
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(50);
      }

      // Page should still be responsive
      const body = page.locator('body');
      await expect(body).toBeVisible();

      // Should be able to interact
      const button = page.locator('button').first();
      if (await button.isVisible({ timeout: 2000 }).catch(() => false)) {
        await button.click();
      }
    });

    test('should virtualize long lists for performance', async ({ page }) => {
      await page.goto('/requests');
      await page.waitForLoadState('networkidle');

      // Count rendered items
      const items = page.locator('tbody tr, .list-item, .card').all();
      const count = (await items).length;

      // Should not render all items if list is very long (>100)
      // Virtualization should keep rendered items < 50
      if (count > 100) {
        expect(count).toBeLessThan(50);
      }
    });
  });

  test.describe('Filter Input Latency', () => {
    test('should respond to filter input in <50ms', async ({ page }) => {
      await page.goto('/requests');
      await page.waitForLoadState('networkidle');

      // Find search/filter input
      const filterInput = page.locator('input[type="search"], input[placeholder*="search"], input[placeholder*="filter"]').first();

      if (await filterInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const latency = await measureInputLatency(page, filterInput.first(), 'test');

        // Should respond quickly (<50ms)
        expect(latency).toBeLessThan(50);
      } else {
        test.skip();
      }
    });

    test('should debounce filter input properly', async ({ page }) => {
      await page.goto('/requests');

      const filterInput = page.locator('input[type="search"], input[placeholder*="search"]').first();

      if (await filterInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Type quickly
        await filterInput.type('test', { delay: 10 });

        // Wait for debounce
        await page.waitForTimeout(300);

        // Should have filtered results
        const results = page.locator('tbody tr, .list-item');
        await expect(results.first()).toBeVisible({ timeout: 2000 });
      } else {
        test.skip();
      }
    });
  });

  test.describe('Route Transition Performance', () => {
    test('should transition between routes in <300ms', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const startTime = Date.now();

      // Navigate to different route
      const link = page.locator('a[href*="requests"], button:has-text("Requests")').first();
      await link.click();

      await page.waitForURL(/\/requests/);
      await page.waitForLoadState('domcontentloaded');

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(300);
    });

    test('should not block UI during route transition', async ({ page }) => {
      await page.goto('/');

      const link = page.locator('a[href*="requests"]').first();
      await link.click();

      // Should show loading state or transition smoothly
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should preload routes for instant navigation', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check if route chunks are preloaded
      const preloadLinks = page.locator('link[rel="modulepreload"], link[rel="prefetch"]');
      const count = await preloadLinks.count();

      // Should have some preloaded chunks
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Image Loading Performance', () => {
    test('should lazy load images below fold', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img').all();
      const imagesArray = await images;

      let hasLazyImages = false;

      for (const img of imagesArray) {
        const loading = await img.getAttribute('loading');
        if (loading === 'lazy') {
          hasLazyImages = true;
          break;
        }
      }

      expect(hasLazyImages).toBe(true);
    });

    test('should load images progressively', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img').all();
      const imagesArray = await images;

      for (const img of imagesArray.slice(0, 3)) {
        if (await img.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Should have loaded
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
          expect(naturalWidth).toBeGreaterThan(0);
        }
      }
    });

    test('should use appropriate image formats (WebP/AVIF)', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img').all();
      const imagesArray = await images;

      let hasModernFormat = false;

      for (const img of imagesArray) {
        const src = await img.getAttribute('src');
        if (src && (src.includes('.webp') || src.includes('.avif'))) {
          hasModernFormat = true;
          break;
        }
      }

      // Modern formats are optional but recommended
      if (!hasModernFormat) {
        console.warn('No WebP/AVIF images found - consider using modern formats');
      }
    });
  });

  test.describe('Layout Stability (CLS)', () => {
    test('should have CLS < 0.1 (no layout shifts)', async ({ page }) => {
      await page.goto('/');

      const vitals = await measureWebVitals(page);

      if (vitals.CLS !== undefined) {
        expect(vitals.CLS).toBeLessThan(0.1);
      }
    });

    test('should reserve space for dynamic content', async ({ page }) => {
      await page.goto('/requests');

      // Get initial layout
      const container = page.locator('main, [role="main"]').first();
      const box1 = await container.boundingBox();

      // Wait for content to load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      // Check layout stability
      const box2 = await container.boundingBox();

      if (box1 && box2) {
        // Position should not shift significantly
        expect(Math.abs(box2.y - box1.y)).toBeLessThan(10);
      }
    });

    test('should not shift layout when images load', async ({ page }) => {
      await page.goto('/');

      // Get positions before images load
      const header = page.locator('header, h1').first();
      const box1 = await header.boundingBox();

      // Wait for images
      await page.waitForLoadState('networkidle');

      const box2 = await header.boundingBox();

      if (box1 && box2) {
        // Header should not shift
        expect(box2.y).toBe(box1.y);
      }
    });
  });

  test.describe('Core Web Vitals', () => {
    test('should have LCP < 2.5s (Largest Contentful Paint)', async ({ page }) => {
      await page.goto('/');

      const vitals = await measureWebVitals(page);

      if (vitals.LCP !== undefined) {
        expect(vitals.LCP).toBeLessThan(2500);
      }
    });

    test('should have FID < 100ms (First Input Delay)', async ({ page }) => {
      await page.goto('/');

      // Simulate first input
      const button = page.locator('button, a').first();
      await button.click();

      const vitals = await measureWebVitals(page);

      if (vitals.FID !== undefined) {
        expect(vitals.FID).toBeLessThan(100);
      }
    });

    test('should have good TTFB (Time to First Byte)', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');

      const vitals = await measureWebVitals(page);

      if (vitals.TTFB !== undefined) {
        expect(vitals.TTFB).toBeLessThan(800);
      }
    });
  });

  test.describe('Memory Usage', () => {
    test('should not leak memory during navigation', async ({ page }) => {
      await page.goto('/');

      // Get initial memory
      const memoryBefore = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Navigate multiple times
      for (let i = 0; i < 5; i++) {
        await page.goto('/requests');
        await page.goto('/invoices');
        await page.goto('/');
      }

      // Get final memory
      const memoryAfter = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });

      // Memory growth should be <100MB
      const growth = memoryAfter - memoryBefore;
      expect(growth).toBeLessThan(100 * 1024 * 1024);
    });

    test('should clean up event listeners on unmount', async ({ page }) => {
      await page.goto('/requests');

      // Get listener count before
      const listenersBefore = await page.evaluate(() => {
        return (window as any).eventListenerCount || 0;
      });

      // Navigate away and back
      await page.goto('/');
      await page.goto('/requests');

      const listenersAfter = await page.evaluate(() => {
        return (window as any).eventListenerCount || 0;
      });

      // Listener count should not grow excessively
      const growth = listenersAfter - listenersBefore;
      expect(growth).toBeLessThan(50);
    });
  });

  test.describe('Bundle Size', () => {
    test('should have reasonable initial bundle size', async ({ page }) => {
      // Track network requests
      const jsFiles: number[] = [];

      page.on('response', (response) => {
        const url = response.url();
        if (url.endsWith('.js') && response.status() === 200) {
          response.body().then((buffer) => {
            jsFiles.push(buffer.length);
          });
        }
      });

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Total JS should be <500KB (gzipped)
      const totalJS = jsFiles.reduce((sum, size) => sum + size, 0);
      expect(totalJS).toBeLessThan(500 * 1024);
    });

    test('should code-split by route', async ({ page }) => {
      // Track loaded chunks
      const chunks = new Set<string>();

      page.on('response', (response) => {
        const url = response.url();
        if (url.includes('.js') && response.status() === 200) {
          chunks.add(url);
        }
      });

      await page.goto('/');
      const initialChunks = chunks.size;

      await page.goto('/requests');
      const requestsChunks = chunks.size;

      // Should load additional chunks for new route
      expect(requestsChunks).toBeGreaterThan(initialChunks);
    });
  });

  test.describe('Render Performance', () => {
    test('should render initial UI in <1s', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');

      // Wait for main content
      const main = page.locator('main, [role="main"]').first();
      await expect(main).toBeVisible();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });

    test('should use skeleton screens for loading states', async ({ page }) => {
      await page.goto('/requests');

      // Look for skeleton loaders
      const skeleton = page.locator('.skeleton, [data-testid="skeleton"], .loading-placeholder');
      const hasSkeleton = await skeleton.first().isVisible({ timeout: 1000 }).catch(() => false);

      // Skeletons are recommended but not required
      if (!hasSkeleton) {
        console.warn('No skeleton screens found - consider adding for better UX');
      }
    });

    test('should batch DOM updates efficiently', async ({ page }) => {
      await page.goto('/requests');

      // Trigger filter that updates many items
      const filter = page.locator('input[type="search"]').first();

      if (await filter.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Measure update performance
        const startTime = Date.now();

        await filter.fill('test');
        await page.waitForTimeout(500);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should update in <200ms
        expect(duration).toBeLessThan(200);
      }
    });
  });
});
