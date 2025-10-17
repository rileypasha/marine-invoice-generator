/**
 * E2E Test: React Router Params Validation
 *
 * Purpose: Verify that navigating to /requests/:id/edit correctly loads
 * the invoice edit page with the proper ID parameter.
 *
 * Test Flow:
 * 1. Login to application
 * 2. Navigate to /requests page
 * 3. Click edit button on first invoice
 * 4. Verify URL contains /requests/:id/edit
 * 5. Verify page loads (not stuck on "Loading...")
 * 6. Verify console shows correct param value
 */

import { test, expect } from '@playwright/test';

test.describe('Router Params Propagation E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@marinegroupboatworks.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button[type="submit"]');

    // Wait for redirect to /requests/new
    await page.waitForURL('/requests/new', { timeout: 5000 });
  });

  test('should propagate :id param when navigating to /requests/:id/edit', async ({ page }) => {
    // Navigate to requests list
    await page.goto('/requests');
    await page.waitForLoadState('networkidle');

    // Click edit button on first row (assumes at least one invoice exists)
    const editButton = page.locator('[data-testid="edit-button"]').first();
    await editButton.click();

    // Wait for navigation to complete
    await page.waitForURL(/\/requests\/[^/]+\/edit/);

    // Extract ID from URL
    const url = page.url();
    const match = url.match(/\/requests\/([^/]+)\/edit/);
    expect(match).toBeTruthy();
    const invoiceId = match![1];

    // Verify page is not stuck on "Loading..."
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 5000 });

    // Check console logs for correct param
    const logs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[CreateInvoice]')) {
        logs.push(msg.text());
      }
    });

    // Reload to trigger console log
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for console log
    await page.waitForTimeout(1000);

    // Verify console log shows correct ID
    const relevantLog = logs.find((log) => log.includes('Component mounted'));
    expect(relevantLog).toBeTruthy();
    expect(relevantLog).toContain(invoiceId);
    expect(relevantLog).not.toContain('id: undefined');
  });

  test('should load invoice data when :id param is present', async ({ page }) => {
    // Navigate to requests list
    await page.goto('/requests');
    await page.waitForLoadState('networkidle');

    // Get first invoice ID from the table
    const firstRow = page.locator('table tbody tr').first();
    const invoiceNumber = await firstRow.locator('td').first().textContent();

    // Click edit button
    await firstRow.locator('[data-testid="edit-button"]').click();

    // Wait for edit page to load
    await page.waitForURL(/\/requests\/[^/]+\/edit/);

    // Verify page loaded with data (not "Loading...")
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 5000 });

    // Verify invoice number is displayed somewhere on the page
    if (invoiceNumber) {
      await expect(page.locator(`text=${invoiceNumber}`)).toBeVisible({ timeout: 5000 });
    }

    // Verify form fields are present (indicating data loaded)
    await expect(page.locator('input, textarea, select').first()).toBeVisible();
  });

  test('should work with direct URL navigation', async ({ page }) => {
    // First, get a valid invoice ID
    await page.goto('/requests');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('table tbody tr').first();
    await firstRow.locator('[data-testid="edit-button"]').click();
    await page.waitForURL(/\/requests\/[^/]+\/edit/);

    const url = page.url();
    const match = url.match(/\/requests\/([^/]+)\/edit/);
    const invoiceId = match![1];

    // Now navigate directly to the URL
    await page.goto(`/requests/${invoiceId}/edit`);

    // Verify page loads correctly
    await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('input, textarea, select').first()).toBeVisible();

    // Verify URL is correct
    expect(page.url()).toContain(`/requests/${invoiceId}/edit`);
  });

  test('should work for contacts/:id/edit route', async ({ page }) => {
    // Navigate to contacts
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    // Check if any contacts exist
    const hasContacts = await page.locator('table tbody tr').count() > 0;

    if (hasContacts) {
      // Click edit on first contact
      await page.locator('[data-testid="edit-button"]').first().click();

      // Wait for edit page
      await page.waitForURL(/\/contacts\/[^/]+\/edit/);

      // Verify page loaded
      await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 5000 });
    } else {
      // Skip test if no contacts exist
      test.skip();
    }
  });

  test('should work for vessels/:id/edit route', async ({ page }) => {
    // Navigate to vessels
    await page.goto('/vessels');
    await page.waitForLoadState('networkidle');

    // Check if any vessels exist
    const hasVessels = await page.locator('table tbody tr').count() > 0;

    if (hasVessels) {
      // Click edit on first vessel
      await page.locator('[data-testid="edit-button"]').first().click();

      // Wait for edit page
      await page.waitForURL(/\/vessels\/[^/]+\/edit/);

      // Verify page loaded
      await expect(page.locator('text=Loading...')).not.toBeVisible({ timeout: 5000 });
    } else {
      // Skip test if no vessels exist
      test.skip();
    }
  });

  test('regression test: should NOT show undefined param', async ({ page }) => {
    // Navigate to requests list
    await page.goto('/requests');
    await page.waitForLoadState('networkidle');

    // Click edit button
    await page.locator('[data-testid="edit-button"]').first().click();
    await page.waitForURL(/\/requests\/[^/]+\/edit/);

    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
    });

    // Reload to trigger console log
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify NO console log contains "id: undefined"
    const hasUndefinedId = consoleLogs.some((log) =>
      log.includes('[CreateInvoice]') && log.includes('id: undefined')
    );
    expect(hasUndefinedId).toBe(false);

    // Verify we DO have a valid ID in logs
    const hasValidId = consoleLogs.some((log) =>
      log.includes('[CreateInvoice]') && log.match(/id: ['"][a-zA-Z0-9-]+['"]/)
    );
    expect(hasValidId).toBe(true);
  });
});
