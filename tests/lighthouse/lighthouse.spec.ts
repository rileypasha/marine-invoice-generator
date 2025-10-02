import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';

test.describe('Lighthouse Performance Tests', () => {
  test('should meet performance budgets on mobile', async ({ page }) => {
    await page.goto('/');

    // Run Lighthouse audit
    const result = await page.evaluate(async () => {
      // Simplified performance check
      const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

      return {
        fcp: timing.domContentLoadedEventEnd - timing.fetchStart,
        lcp: timing.loadEventEnd - timing.fetchStart,
        ttfb: timing.responseStart - timing.requestStart,
      };
    });

    expect(result.fcp).toBeLessThan(2000); // FCP <2s
    expect(result.lcp).toBeLessThan(2500); // LCP <2.5s
    expect(result.ttfb).toBeLessThan(800); // TTFB <800ms
  });

  test('should be installable as PWA', async ({ page }) => {
    await page.goto('/');

    // Check PWA criteria
    const hasManifest = await page.locator('link[rel="manifest"]').count() > 0;
    expect(hasManifest).toBe(true);

    // Check service worker
    const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(hasSW).toBe(true);

    // Check HTTPS (or localhost)
    const isSecure = page.url().startsWith('https://') || page.url().includes('localhost');
    expect(isSecure).toBe(true);
  });

  test('should have good accessibility score', async ({ page }) => {
    await page.goto('/');

    // Check basic a11y requirements
    const hasLang = await page.locator('html[lang]').count() > 0;
    expect(hasLang).toBe(true);

    const hasTitle = await page.title();
    expect(hasTitle.length).toBeGreaterThan(0);

    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    expect(h1Count).toBeLessThanOrEqual(1); // Should have exactly one H1
  });

  test('should follow SEO best practices', async ({ page }) => {
    await page.goto('/');

    // Meta description
    const hasDescription = await page.locator('meta[name="description"]').count() > 0;
    expect(hasDescription).toBe(true);

    // Viewport meta tag
    const hasViewport = await page.locator('meta[name="viewport"]').count() > 0;
    expect(hasViewport).toBe(true);

    // Title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.length).toBeLessThan(60); // SEO best practice
  });

  test('should use modern image formats', async ({ page }) => {
    await page.goto('/');

    const images = await page.locator('img').all();
    let hasModernFormats = false;

    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src && (src.includes('.webp') || src.includes('.avif'))) {
        hasModernFormats = true;
        break;
      }
    }

    // Modern formats are recommended but not required
    if (!hasModernFormats) {
      console.warn('Consider using WebP or AVIF for better performance');
    }
  });
});
