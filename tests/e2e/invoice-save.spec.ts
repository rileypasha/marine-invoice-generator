import { test, expect, Page } from '@playwright/test';

test.describe('Invoice Save Auth Flow', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Scenario 1: Logged Out Compose - no network calls', async () => {
    // Navigate to invoice form without logging in
    await page.goto('http://localhost:3000/invoice/new');
    
    // Set up request monitoring
    const saveRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/v1/invoice/save')) {
        saveRequests.push(request.url());
      }
    });

    // Fill form
    await page.fill('#amount', '100');
    await page.fill('#customerName', 'John Doe');
    await page.fill('#description', 'Test invoice');
    
    // Click save
    await page.click('#save-button');
    
    // Verify no network calls were made
    expect(saveRequests).toHaveLength(0);
    
    // Verify toast message
    await expect(page.locator('.toast')).toContainText(/Draft saved locally|Login to save/);
    
    // Verify data persists after reload
    await page.reload();
    await expect(page.locator('#amount')).toHaveValue('100');
    await expect(page.locator('#customerName')).toHaveValue('John Doe');
  });

  test('Scenario 2: Session Expiry - shows banner, no retries', async () => {
    // Login first
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    
    // Navigate to invoice form
    await page.goto('http://localhost:3000/invoice/new');
    await page.fill('#amount', '200');
    await page.fill('#customerName', 'Jane Smith');
    
    // Clear cookies to simulate session expiry
    await page.context().clearCookies();
    
    // Track save attempts
    const saveAttempts: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/v1/invoice/save')) {
        saveAttempts.push(request.url());
      }
    });
    
    // Trigger save
    await page.click('#save-button');
    
    // Wait for potential retries
    await page.waitForTimeout(5000);
    
    // Should see session expired banner
    await expect(page.locator('.session-expired-banner')).toBeVisible();
    await expect(page.locator('.session-expired-banner')).toContainText('Session expired');
    
    // Verify no retry storm (max 1 attempt)
    expect(saveAttempts.length).toBeLessThanOrEqual(1);
    
    // Verify form data is preserved
    await expect(page.locator('#amount')).toHaveValue('200');
    await expect(page.locator('#customerName')).toHaveValue('Jane Smith');
  });

  test('Scenario 3: Post-Login Queue Flush', async () => {
    // Start logged out
    await page.goto('http://localhost:3000/invoice/new');
    
    // Create multiple drafts
    for (let i = 1; i <= 3; i++) {
      await page.fill('#amount', String(i * 100));
      await page.fill('#customerName', `Customer ${i}`);
      await page.click('#save-button');
      await page.waitForTimeout(500);
    }
    
    // Verify local save messages
    const toasts = page.locator('.toast');
    await expect(toasts).toContainText(/Draft saved locally/);
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    
    // Review modal should appear
    await expect(page.locator('.queued-saves-modal')).toBeVisible();
    await expect(page.locator('.queue-item')).toHaveCount(3);
    
    // Track API calls with idempotency keys
    const sentKeys = new Set<string>();
    page.on('request', request => {
      if (request.url().includes('/api/v1/invoice/save')) {
        const idempotencyKey = request.headers()['idempotency-key'];
        if (idempotencyKey) {
          sentKeys.add(idempotencyKey);
        }
      }
    });
    
    // Submit all
    await page.click('#submit-all');
    
    // Wait for sync
    await page.waitForTimeout(2000);
    
    // Verify success message
    await expect(page.locator('.submit-result')).toContainText(/Successfully synced 3 invoices/);
    
    // Verify unique idempotency keys
    expect(sentKeys.size).toBe(3);
  });

  test('Scenario 4: Multi-Tab Consistency', async ({ browser }) => {
    const context = await browser.newContext();
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    
    // Login in tab1
    await tab1.goto('http://localhost:3000/login');
    await tab1.fill('#username', 'test');
    await tab1.fill('#password', 'password123');
    await tab1.click('#login-button');
    
    // Both tabs navigate to same invoice
    await tab1.goto('http://localhost:3000/invoice/123');
    await tab2.goto('http://localhost:3000/invoice/123');
    
    // Clear cookies to simulate session loss
    await context.clearCookies();
    
    // Edit in both tabs
    await tab1.fill('#amount', '500');
    await tab2.fill('#description', 'Updated description');
    
    // Save in both tabs
    await tab1.click('#save-button');
    await tab2.click('#save-button');
    
    // Both should show session expired banner
    await expect(tab1.locator('.session-expired-banner')).toBeVisible();
    await expect(tab2.locator('.session-expired-banner')).toBeVisible();
    
    // Verify both have pending changes indicator
    await expect(tab1.locator('.pending-count')).toContainText(/unsaved change/);
    await expect(tab2.locator('.pending-count')).toContainText(/unsaved change/);
    
    await tab1.close();
    await tab2.close();
    await context.close();
  });

  test('Scenario 5: Offline to Online Transition', async () => {
    // Start online and logged out
    await page.goto('http://localhost:3000/invoice/new');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Fill and save
    await page.fill('#amount', '750');
    await page.fill('#customerName', 'Offline Customer');
    await page.click('#save-button');
    
    // Should save locally
    await expect(page.locator('.toast')).toContainText(/saved locally/);
    
    // Come back online but stay logged out
    await page.context().setOffline(false);
    
    // Try to save again
    await page.fill('#amount', '800');
    await page.click('#save-button');
    
    // Should still save locally (not authenticated)
    await expect(page.locator('.toast')).toContainText(/Login to save|saved locally/);
    
    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    
    // Should prompt to sync
    await expect(page.locator('.queued-saves-modal')).toBeVisible();
  });

  test('Auto-save behavior when authenticated vs unauthenticated', async () => {
    // Start logged in
    await page.goto('http://localhost:3000/login');
    await page.fill('#username', 'test');
    await page.fill('#password', 'password123');
    await page.click('#login-button');
    
    await page.goto('http://localhost:3000/invoice/new');
    
    // Track auto-save requests
    let autoSaveCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/v1/invoice/save')) {
        autoSaveCount++;
      }
    });
    
    // Type and wait for auto-save
    await page.fill('#amount', '999');
    await page.waitForTimeout(3000); // Wait for debounced auto-save
    
    // Should have made network request
    expect(autoSaveCount).toBeGreaterThan(0);
    
    // Clear session
    await page.context().clearCookies();
    autoSaveCount = 0;
    
    // Type more
    await page.fill('#description', 'After session expired');
    await page.waitForTimeout(3000);
    
    // Should NOT make network request
    expect(autoSaveCount).toBe(0);
    
    // But should show local save indicator
    await expect(page.locator('.save-indicator')).toContainText(/Saved locally/);
  });
});