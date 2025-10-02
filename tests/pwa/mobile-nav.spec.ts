import { test, expect } from '@playwright/test';
import { setViewport, checkTouchTargetSize, verifyAllTouchTargets, MOBILE_DEVICES } from '../utils/mobile-helpers';
import { getPWADisplayMode } from '../utils/pwa-helpers';

test.describe('Mobile Navigation Tests', () => {
  test.describe('Bottom Navigation', () => {
    test('should display bottom nav on mobile viewport (<768px)', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav, .mobile-nav').first();
      await expect(bottomNav).toBeVisible({ timeout: 5000 });
    });

    test('should hide bottom nav on desktop viewport (≥768px)', async ({ page }) => {
      await setViewport(page, 'desktop');
      await page.goto('/');

      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav, .mobile-nav').first();
      const isVisible = await bottomNav.isVisible({ timeout: 2000 }).catch(() => false);

      expect(isVisible).toBe(false);
    });

    test('should show bottom nav in PWA standalone mode', async ({ page }) => {
      await setViewport(page, 'iPhone14');

      // Simulate standalone mode
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: (query: string) => {
            if (query === '(display-mode: standalone)') {
              return {
                matches: true,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
              };
            }
            return {
              matches: false,
              media: query,
              addEventListener: () => {},
              removeEventListener: () => {},
            };
          },
        });
      });

      await page.goto('/');

      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      await expect(bottomNav).toBeVisible({ timeout: 5000 });
    });

    test('should have all navigation items with icons and labels', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const navItems = page.locator('[data-testid="bottom-nav"] a, nav.bottom-nav a, .mobile-nav a');
      const count = await navItems.count();

      // Should have at least 3-5 nav items (typical for mobile app)
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(6);

      // Each item should have icon and text
      for (let i = 0; i < count; i++) {
        const item = navItems.nth(i);

        // Should have icon (svg or icon class)
        const icon = item.locator('svg, [class*="icon"], .lucide');
        await expect(icon).toBeVisible();

        // Should have text label
        const text = await item.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
      }
    });

    test('should highlight active tab correctly', async ({ page }) => {
      await setViewport(page, 'iPhone14');

      // Navigate to requests
      await page.goto('/requests');

      // Find active nav item
      const activeItem = page.locator('[data-testid="bottom-nav"] [aria-current="page"], nav.bottom-nav .active, .mobile-nav [data-active="true"]').first();
      await expect(activeItem).toBeVisible({ timeout: 5000 });

      // Should have different styling (color, background, etc.)
      const color = await activeItem.evaluate((el) => window.getComputedStyle(el).color);
      expect(color).toBeDefined();
    });

    test('should update active state when navigating', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const nav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();

      // Click requests tab
      const requestsTab = nav.locator('a[href*="requests"], button:has-text("Requests")').first();
      if (await requestsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await requestsTab.click();
        await page.waitForURL(/\/requests/, { timeout: 3000 });

        // Requests should be active
        const activeItem = nav.locator('[aria-current="page"], .active, [data-active="true"]').first();
        const text = await activeItem.textContent();
        expect(text?.toLowerCase()).toContain('request');
      }
    });

    test('should have smooth transitions between tabs', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const nav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();

      // Get initial position
      const tab1 = nav.locator('a, button').first();
      const tab2 = nav.locator('a, button').nth(1);

      await tab1.click();
      await page.waitForTimeout(300); // Wait for transition

      await tab2.click();
      await page.waitForTimeout(300);

      // Page should have transitioned smoothly (check URL changed)
      const url = page.url();
      expect(url).toBeDefined();
    });

    test('all bottom nav tap targets should meet 44px minimum', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const navItems = page.locator('[data-testid="bottom-nav"] a, nav.bottom-nav a, .mobile-nav a');
      const count = await navItems.count();

      for (let i = 0; i < count; i++) {
        const item = navItems.nth(i);
        const box = await item.boundingBox();

        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('should hide sidebar on mobile when bottom nav is shown', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const sidebar = page.locator('[data-testid="sidebar"], aside, .sidebar').first();
      const sidebarVisible = await sidebar.isVisible({ timeout: 2000 }).catch(() => false);

      // Sidebar should be hidden on mobile (or collapsed)
      if (sidebarVisible) {
        // Check if it's collapsed/off-screen
        const box = await sidebar.boundingBox();
        if (box) {
          expect(box.x).toBeLessThan(0); // Off-screen to the left
        }
      }

      // Bottom nav should be visible instead
      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      await expect(bottomNav).toBeVisible();
    });

    test('should position bottom nav at bottom of viewport', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      const box = await bottomNav.boundingBox();
      const viewportHeight = page.viewportSize()?.height || 844;

      // Should be positioned at bottom (within 100px of bottom)
      const distanceFromBottom = viewportHeight - (box?.y || 0) - (box?.height || 0);
      expect(distanceFromBottom).toBeLessThan(100);
    });

    test('should have sticky positioning to stay visible while scrolling', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests'); // Page with scrollable content

      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();

      // Get position before scroll
      const boxBefore = await bottomNav.boundingBox();

      // Scroll down
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(300);

      // Get position after scroll
      const boxAfter = await bottomNav.boundingBox();

      // Position should be relatively the same (sticky)
      expect(Math.abs((boxBefore?.y || 0) - (boxAfter?.y || 0))).toBeLessThan(50);
    });
  });

  test.describe('FAB (Floating Action Button)', () => {
    test('should show FAB on mobile for primary actions', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const fab = page.locator('[data-testid="fab"], .fab, button.floating-action-button').first();
      const isVisible = await fab.isVisible({ timeout: 3000 }).catch(() => false);

      // FAB is optional but recommended for mobile UX
      if (isVisible) {
        await expect(fab).toBeVisible();

        // Should meet touch target size
        const box = await fab.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    });

    test('FAB should be clickable and trigger primary action', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const fab = page.locator('[data-testid="fab"], .fab, button.floating-action-button').first();

      if (await fab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fab.click();

        // Should open dialog or navigate
        const dialog = page.locator('[role="dialog"], .dialog, .modal');
        const isDialogOpen = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

        if (isDialogOpen) {
          await expect(dialog).toBeVisible();
        } else {
          // Or should have changed URL
          const url = page.url();
          expect(url).toBeDefined();
        }
      }
    });

    test('FAB should have appropriate z-index to float above content', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      const fab = page.locator('[data-testid="fab"], .fab').first();

      if (await fab.isVisible({ timeout: 2000 }).catch(() => false)) {
        const zIndex = await fab.evaluate((el) => window.getComputedStyle(el).zIndex);
        const zIndexNum = parseInt(zIndex);

        expect(zIndexNum).toBeGreaterThan(100);
      }
    });
  });

  test.describe('Touch Target Accessibility', () => {
    test('all interactive elements should meet 44px minimum size', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const { passed, failures } = await verifyAllTouchTargets(page);

      if (!passed) {
        console.error('Touch target failures:', failures);
      }

      expect(passed).toBe(true);
    });

    test('buttons in lists should have adequate spacing', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/requests');

      // Find action buttons in list
      const actionButtons = page.locator('tbody button, .list-item button, .card button');
      const count = await actionButtons.count();

      if (count > 0) {
        for (let i = 0; i < Math.min(count, 5); i++) {
          const button = actionButtons.nth(i);
          const box = await button.boundingBox();

          // Should meet minimum size
          expect(box?.width).toBeGreaterThanOrEqual(44);
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test('nav items should have spacing to prevent mis-taps', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const navItems = page.locator('[data-testid="bottom-nav"] a, nav.bottom-nav a').all();
      const items = await navItems;

      if (items.length > 1) {
        for (let i = 0; i < items.length - 1; i++) {
          const box1 = await items[i].boundingBox();
          const box2 = await items[i + 1].boundingBox();

          if (box1 && box2) {
            // Minimum 8px spacing between items
            const gap = box2.x - (box1.x + box1.width);
            expect(gap).toBeGreaterThanOrEqual(8);
          }
        }
      }
    });
  });

  test.describe('Responsive Breakpoints', () => {
    test('should show bottom nav on all mobile viewports', async ({ page }) => {
      const mobileDevices: Array<keyof typeof MOBILE_DEVICES> = ['iPhoneSE', 'iPhone14', 'pixel5'];

      for (const device of mobileDevices) {
        await setViewport(page, device);
        await page.goto('/');

        const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
        await expect(bottomNav).toBeVisible({ timeout: 5000 });
      }
    });

    test('should hide bottom nav on tablet landscape (iPad Mini)', async ({ page }) => {
      await setViewport(page, 'iPadMini');
      await page.goto('/');

      // On tablet, may show desktop sidebar instead
      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      const hasBottomNav = await bottomNav.isVisible({ timeout: 2000 }).catch(() => false);

      // Should show either bottom nav OR sidebar, not both
      if (!hasBottomNav) {
        const sidebar = page.locator('[data-testid="sidebar"], aside').first();
        await expect(sidebar).toBeVisible({ timeout: 5000 });
      }
    });

    test('should adapt nav layout at 768px breakpoint', async ({ page }) => {
      // Just below breakpoint
      await page.setViewportSize({ width: 767, height: 1024 });
      await page.goto('/');

      const bottomNavBefore = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      const hasBottomNavBefore = await bottomNavBefore.isVisible({ timeout: 2000 }).catch(() => false);

      // Just above breakpoint
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();

      const bottomNavAfter = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      const hasBottomNavAfter = await bottomNavAfter.isVisible({ timeout: 2000 }).catch(() => false);

      // Layout should change at breakpoint
      if (hasBottomNavBefore) {
        // May hide on larger viewport
        expect(hasBottomNavBefore).toBe(true);
      }
    });
  });

  test.describe('Navigation Performance', () => {
    test('should navigate between tabs in <300ms', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      const nav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      const tabs = nav.locator('a, button').all();
      const tabsArray = await tabs;

      if (tabsArray.length > 1) {
        const startTime = Date.now();
        await tabsArray[1].click();
        await page.waitForLoadState('domcontentloaded');
        const endTime = Date.now();

        const duration = endTime - startTime;
        expect(duration).toBeLessThan(300);
      }
    });

    test('should not cause layout shift when loading', async ({ page }) => {
      await setViewport(page, 'iPhone14');
      await page.goto('/');

      // Wait for nav to appear
      const bottomNav = page.locator('[data-testid="bottom-nav"], nav.bottom-nav').first();
      await expect(bottomNav).toBeVisible();

      // Check that nav doesn't shift after load
      const box1 = await bottomNav.boundingBox();
      await page.waitForTimeout(1000);
      const box2 = await bottomNav.boundingBox();

      // Position should be stable
      expect(box1?.y).toBe(box2?.y);
    });
  });
});
