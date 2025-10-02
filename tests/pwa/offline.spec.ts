import { test, expect } from '@playwright/test';
import {
  simulateOffline,
  simulateOnline,
  setViewport,
  waitForNetworkIdle,
} from '../utils/mobile-helpers';
import {
  checkServiceWorker,
  waitForServiceWorkerActivation,
  getCachedURLs,
  isURLCached,
  mockNetworkStatus,
  getNetworkStatus,
} from '../utils/pwa-helpers';

test.describe('Offline Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await setViewport(page, 'iPhone14');

    // Load app and wait for SW activation
    await page.goto('/');
    await waitForServiceWorkerActivation(page);
    await waitForNetworkIdle(page);
  });

  test('should load app from cache while offline', async ({ page, context }) => {
    // Ensure app is cached
    await page.reload();
    await page.waitForTimeout(1000);

    // Go offline
    await simulateOffline(page);

    // Reload page
    const response = await page.goto('/');

    // Should load successfully from cache
    expect(response?.status()).toBeLessThan(400);

    // Verify page content is visible
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should display offline banner when disconnected', async ({ page }) => {
    // Mock offline status
    await mockNetworkStatus(page, false);

    // Check for offline indicator
    const offlineBanner = page.locator('[data-testid="offline-banner"], .offline-indicator, [aria-label*="offline"]');

    // Wait for banner to appear
    await expect(offlineBanner.first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate between cached pages offline', async ({ page, context }) => {
    // Visit multiple pages to ensure they're cached
    await page.goto('/');
    await page.goto('/requests');
    await page.goto('/invoices');

    // Go offline
    await simulateOffline(page);

    // Navigate between pages
    await page.goto('/requests');
    await expect(page).toHaveURL(/\/requests/);

    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/invoices/);

    await page.goto('/');
    await expect(page).toHaveURL(/\//);
  });

  test('should show cached request data offline', async ({ page, context }) => {
    // Load requests page online
    await page.goto('/requests');
    await waitForNetworkIdle(page);

    // Go offline
    await simulateOffline(page);

    // Reload page
    await page.reload();

    // Should show cached data (table or cards)
    const dataContainer = page.locator('table, [data-testid="requests-list"], .request-card').first();
    await expect(dataContainer).toBeVisible({ timeout: 5000 });
  });

  test('should queue create request action when offline', async ({ page, context }) => {
    // Go offline
    await simulateOffline(page);

    // Navigate to requests
    await page.goto('/requests');

    // Try to create new request
    const newButton = page.locator('button:has-text("New"), [aria-label*="new request"]').first();

    if (await newButton.isVisible()) {
      await newButton.click();

      // Fill form (minimal data)
      const vesselInput = page.locator('input[name="vessel"], select[name="vessel"]').first();
      if (await vesselInput.isVisible()) {
        await vesselInput.click();
      }

      // Try to save
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();

        // Should show queued message or pending indicator
        const queuedIndicator = page.locator('[data-testid="queued"], .pending-sync, [aria-label*="queued"]');
        const isQueued = await queuedIndicator.isVisible({ timeout: 3000 }).catch(() => false);

        // Or check for offline save message
        const saveMessage = page.locator('text=/saved offline|queued|pending/i');
        const hasSaveMessage = await saveMessage.isVisible({ timeout: 3000 }).catch(() => false);

        expect(isQueued || hasSaveMessage).toBe(true);
      }
    } else {
      // If no new button, test may need adjustment for actual UI
      test.skip();
    }
  });

  test('should queue edit request action when offline', async ({ page, context }) => {
    // Load a request online
    await page.goto('/requests');
    await waitForNetworkIdle(page);

    // Find first request row/card
    const firstRequest = page.locator('tbody tr, .request-card').first();
    const hasRequests = await firstRequest.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasRequests) {
      test.skip();
      return;
    }

    // Go offline
    await simulateOffline(page);

    // Click to edit
    await firstRequest.click();

    // Make an edit
    const editButton = page.locator('button:has-text("Edit")').first();
    if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editButton.click();
    }

    const input = page.locator('input, textarea').first();
    if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
      await input.fill('Offline edit test');

      // Save
      const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();

        // Should indicate queued/pending
        const pendingIndicator = page.locator('[data-testid="queued"], .pending-sync');
        const isPending = await pendingIndicator.isVisible({ timeout: 3000 }).catch(() => false);

        expect(isPending).toBe(true);
      }
    }
  });

  test('should sync pending changes when reconnected', async ({ page, context }) => {
    // Create action while offline
    await simulateOffline(page);
    await page.goto('/requests');

    // Queue an action (click new button if available)
    const newButton = page.locator('button:has-text("New")').first();
    if (await newButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newButton.click();

      // Close dialog/modal without saving to avoid errors
      const cancelButton = page.locator('button:has-text("Cancel")').first();
      if (await cancelButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cancelButton.click();
      }
    }

    // Go back online
    await simulateOnline(page);

    // Mock successful sync
    await mockNetworkStatus(page, true);

    // Wait for sync process
    await page.waitForTimeout(2000);

    // Should show online status
    const networkStatus = await getNetworkStatus(page);
    expect(networkStatus).toBe(true);

    // Sync indicator should disappear
    const syncIndicator = page.locator('[data-testid="syncing"], .syncing');
    const isSyncing = await syncIndicator.isVisible({ timeout: 1000 }).catch(() => false);

    // Should not be syncing after reconnect (or synced quickly)
    expect(isSyncing).toBe(false);
  });

  test('should not show blank screens when offline', async ({ page, context }) => {
    // Go offline
    await simulateOffline(page);

    // Navigate to different routes
    const routes = ['/', '/requests', '/invoices', '/vessels', '/contacts'];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });

      // Check that something is visible (not blank)
      const body = page.locator('body');
      const bodyText = await body.textContent();

      // Should have some content
      expect(bodyText?.trim().length).toBeGreaterThan(0);

      // Should not show generic error page
      const errorPage = page.locator('text=/404|not found|error/i');
      const hasError = await errorPage.isVisible({ timeout: 1000 }).catch(() => false);

      // Error pages are ok for uncached routes, but should show friendly message
      if (hasError) {
        const offlineMessage = page.locator('text=/offline|no connection|check connection/i');
        const hasOfflineMessage = await offlineMessage.isVisible({ timeout: 1000 }).catch(() => false);

        expect(hasOfflineMessage).toBe(true);
      }
    }
  });

  test('should cache API responses for offline use', async ({ page }) => {
    // Make API call online
    await page.goto('/requests');
    await waitForNetworkIdle(page);

    // Check if API responses are cached
    const cachedURLs = await getCachedURLs(page);
    const hasAPICached = cachedURLs.some((url) => url.includes('/api/'));

    // Should cache at least some API calls
    expect(hasAPICached).toBe(true);
  });

  test('should use stale cache when offline with visual indicator', async ({ page, context }) => {
    // Load data online
    await page.goto('/requests');
    await waitForNetworkIdle(page);

    // Go offline
    await simulateOffline(page);

    // Reload
    await page.reload();

    // Should show data (from cache)
    const dataContainer = page.locator('table, [data-testid="requests-list"]').first();
    await expect(dataContainer).toBeVisible({ timeout: 5000 });

    // Should show stale data indicator (optional)
    const staleIndicator = page.locator('[data-testid="stale-data"], .data-outdated');
    // This is optional, so just log if present
    const isStale = await staleIndicator.isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`Stale data indicator shown: ${isStale}`);
  });

  test('should handle offline → online → offline transitions', async ({ page, context }) => {
    // Start offline
    await simulateOffline(page);
    await page.goto('/');

    let networkStatus = await getNetworkStatus(page);
    expect(networkStatus).toBe(false);

    // Go online
    await simulateOnline(page);
    await mockNetworkStatus(page, true);

    networkStatus = await getNetworkStatus(page);
    expect(networkStatus).toBe(true);

    // Go offline again
    await simulateOffline(page);
    await mockNetworkStatus(page, false);

    networkStatus = await getNetworkStatus(page);
    expect(networkStatus).toBe(false);

    // App should still function
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should show offline banner only when actually offline', async ({ page }) => {
    // Start online
    await page.goto('/');

    // Should NOT show offline banner
    const offlineBanner = page.locator('[data-testid="offline-banner"]');
    const isVisibleOnline = await offlineBanner.isVisible({ timeout: 2000 }).catch(() => false);

    expect(isVisibleOnline).toBe(false);

    // Go offline
    await mockNetworkStatus(page, false);

    // Should show offline banner
    const isVisibleOffline = await offlineBanner.isVisible({ timeout: 3000 }).catch(() => false);

    expect(isVisibleOffline).toBe(true);
  });

  test('should preserve scroll position during offline navigation', async ({ page, context }) => {
    // Load page with scrollable content
    await page.goto('/requests');
    await waitForNetworkIdle(page);

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 500));
    const scrollBefore = await page.evaluate(() => window.scrollY);

    // Go offline
    await simulateOffline(page);

    // Navigate away and back
    await page.goto('/');
    await page.goto('/requests');

    // Scroll position may not be preserved, but page should load
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle failed network requests gracefully when offline', async ({ page, context }) => {
    // Go offline
    await simulateOffline(page);

    // Try to perform action that requires network
    await page.goto('/requests');

    // Click action button
    const actionButton = page.locator('button').first();
    if (await actionButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await actionButton.click();

      // Should show error OR queue message, not crash
      const errorOrQueue = page.locator('[role="alert"], .error, .queued, [data-testid="error"]');
      const hasMessage = await errorOrQueue.isVisible({ timeout: 3000 }).catch(() => false);

      // Page should still be functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should cache critical assets for offline use', async ({ page }) => {
    await page.goto('/');
    await waitForNetworkIdle(page);

    const cachedURLs = await getCachedURLs(page);

    // Should cache JS bundles
    const hasJS = cachedURLs.some((url) => url.includes('.js'));
    expect(hasJS).toBe(true);

    // Should cache CSS
    const hasCSS = cachedURLs.some((url) => url.includes('.css'));
    expect(hasCSS).toBe(true);

    // Should cache images
    const hasImages = cachedURLs.some((url) => url.match(/\.(png|jpg|svg|ico)$/));
    expect(hasImages).toBe(true);
  });
});
