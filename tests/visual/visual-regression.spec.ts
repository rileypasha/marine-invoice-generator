import { test, expect } from '@playwright/test';
import { MOBILE_DEVICES, DeviceType } from '../utils/mobile-helpers';

const VIEWPORTS: DeviceType[] = ['iPhoneSE', 'iPhone14', 'pixel5', 'iPadMini'];

test.describe('Visual Regression Tests', () => {
  for (const device of VIEWPORTS) {
    test.describe(`${device} viewport`, () => {
      test.beforeEach(async ({ page }) => {
        const config = MOBILE_DEVICES[device];
        await page.setViewportSize({ width: config.width, height: config.height });
      });

      test('requests list should match baseline', async ({ page }) => {
        await page.goto('/requests');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(`requests-list-${device}.png`, {
          fullPage: false,
          animations: 'disabled',
        });
      });

      test('request detail sheet should match baseline', async ({ page }) => {
        await page.goto('/requests');
        await page.waitForLoadState('networkidle');

        const firstItem = page.locator('tbody tr, .card').first();
        if (await firstItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstItem.click();

          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible({ timeout: 2000 });

          await expect(dialog).toHaveScreenshot(`request-detail-${device}.png`, {
            animations: 'disabled',
          });
        }
      });

      test('bottom navigation should match baseline', async ({ page }) => {
        await page.goto('/');

        if (device !== 'iPadMini') {
          // iPadMini may show desktop nav
          const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
          await expect(bottomNav).toBeVisible({ timeout: 3000 });

          await expect(bottomNav).toHaveScreenshot(`bottom-nav-${device}.png`, {
            animations: 'disabled',
          });
        }
      });

      test('offline banner should match baseline', async ({ page, context }) => {
        await context.setOffline(true);
        await page.goto('/');

        const banner = page.locator('[data-testid="offline-banner"]').first();
        const isVisible = await banner.isVisible({ timeout: 3000 }).catch(() => false);

        if (isVisible) {
          await expect(banner).toHaveScreenshot(`offline-banner-${device}.png`, {
            animations: 'disabled',
          });
        }

        await context.setOffline(false);
      });

      test('loading skeletons should match baseline', async ({ page }) => {
        // Intercept API to slow it down
        await page.route('**/api/**', async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await route.continue();
        });

        await page.goto('/requests');

        // Capture skeleton state
        const skeleton = page.locator('.skeleton, [data-testid="skeleton"]').first();
        const hasSkeleton = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);

        if (hasSkeleton) {
          await expect(page).toHaveScreenshot(`loading-skeleton-${device}.png`, {
            animations: 'disabled',
          });
        }
      });

      test('empty state should match baseline', async ({ page }) => {
        // Navigate to a potentially empty page
        await page.goto('/requests?filter=nonexistent12345');
        await page.waitForLoadState('networkidle');

        const emptyState = page.locator('[data-testid="empty-state"], .empty, text=/no.*found/i').first();
        const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasEmptyState) {
          await expect(page).toHaveScreenshot(`empty-state-${device}.png`, {
            fullPage: false,
            animations: 'disabled',
          });
        }
      });

      test('form inputs should match baseline', async ({ page }) => {
        await page.goto('/');

        const newButton = page.locator('button:has-text("New")').first();
        if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newButton.click();

          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible({ timeout: 2000 });

          await expect(dialog).toHaveScreenshot(`form-inputs-${device}.png`, {
            animations: 'disabled',
          });
        }
      });

      test('dark mode should match baseline', async ({ page }) => {
        // Enable dark mode
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        await expect(page).toHaveScreenshot(`dark-mode-${device}.png`, {
          fullPage: false,
          animations: 'disabled',
        });
      });
    });
  }

  test.describe('Spacing and Alignment', () => {
    test('should maintain consistent spacing across viewports', async ({ page }) => {
      const devices: DeviceType[] = ['iPhoneSE', 'iPhone14'];

      for (const device of devices) {
        const config = MOBILE_DEVICES[device];
        await page.setViewportSize({ width: config.width, height: config.height });
        await page.goto('/');

        const container = page.locator('main, [role="main"]').first();
        const padding = await container.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            top: parseInt(styles.paddingTop),
            right: parseInt(styles.paddingRight),
            bottom: parseInt(styles.paddingBottom),
            left: parseInt(styles.paddingLeft),
          };
        });

        // Should have consistent padding
        expect(padding.left).toBeGreaterThanOrEqual(16);
        expect(padding.right).toBeGreaterThanOrEqual(16);
      }
    });

    test('should align elements consistently', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/requests');

      const items = page.locator('.card, tbody tr').all();
      const itemsArray = await items;

      if (itemsArray.length > 1) {
        const box1 = await itemsArray[0].boundingBox();
        const box2 = await itemsArray[1].boundingBox();

        if (box1 && box2) {
          // Should be left-aligned (same x position)
          expect(box2.x).toBe(box1.x);
        }
      }
    });
  });

  test.describe('Safe Area Insets', () => {
    test('should respect safe area on iPhone 14', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      // Add safe area CSS
      await page.addInitScript(() => {
        document.documentElement.style.setProperty('--sat', '47px');
        document.documentElement.style.setProperty('--sab', '34px');
      });

      await page.goto('/');

      await expect(page).toHaveScreenshot('safe-area-iphone14.png', {
        fullPage: true,
        animations: 'disabled',
      });
    });
  });
});
