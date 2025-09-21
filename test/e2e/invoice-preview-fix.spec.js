const { test, expect } = require('@playwright/test');

test.describe('Invoice Preview Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console error capturing
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    page.errors = errors;

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login with provided credentials
    await page.fill('#email', 'test@marinegroupbw.com');
    await page.fill('#password', 'TempPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to app
    await page.waitForURL('**/app**');
  });

  test('should view invoice without console errors', async ({ page }) => {
    // Navigate to invoices page
    await page.goto('http://localhost:3001/app');

    // Wait for any invoices to load
    await page.waitForTimeout(2000);

    // Look for "view" buttons or links
    const viewButtons = page.locator('button:has-text("view"), a:has-text("view"), button:has-text("View"), a:has-text("View")');

    // Check if any view buttons exist
    const count = await viewButtons.count();
    console.log(`Found ${count} view buttons/links`);

    if (count > 0) {
      // Clear any existing console errors
      page.errors.length = 0;

      // Click the first "view" button
      await viewButtons.first().click();

      // Wait for navigation and page to load
      await page.waitForTimeout(3000);

      // Check for the specific errors we were fixing
      const hasRestoreEditStateError = page.errors.some(error =>
        error.includes("Cannot read properties of undefined (reading 'restoreEditState')")
      );

      const hasSubscribeError = page.errors.some(error =>
        error.includes("Cannot read properties of undefined (reading 'subscribe')")
      );

      // Log all console errors for debugging
      if (page.errors.length > 0) {
        console.log('Console errors found:', page.errors);
      }

      // Assert that the specific errors we fixed are not present
      expect(hasRestoreEditStateError, 'restoreEditState error should not occur').toBe(false);
      expect(hasSubscribeError, 'subscribe error should not occur').toBe(false);

      // Check that the invoice preview component is rendered
      const previewCard = page.locator('[class*="card"], .card, [data-testid="invoice-preview"]');
      const previewTitle = page.locator('text=Invoice Preview, h1:has-text("Invoice"), h2:has-text("Invoice")');

      // Wait for preview to load and verify it's displayed
      await expect(previewCard.or(previewTitle).first()).toBeVisible({ timeout: 10000 });

      // Verify that the page URL contains the view parameter
      const currentUrl = page.url();
      expect(currentUrl).toContain('view=true');

      console.log('✅ Invoice preview loaded successfully without target console errors');
    } else {
      console.log('⚠️ No view buttons found. Checking if we can navigate directly to an invoice view...');

      // Try to navigate directly to a view URL (this would require an existing invoice ID)
      // For now, we'll skip this case but log it
      test.skip('No view buttons found to test');
    }
  });

  test('should load invoice preview component without crashing', async ({ page }) => {
    // Clear console errors
    page.errors.length = 0;

    // Try to navigate to a view URL with a sample invoice ID
    // This tests the component initialization even if the invoice doesn't exist
    await page.goto('http://localhost:3001/app?view=true&invoice=test-invoice-id');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Check that no fatal JavaScript errors occurred
    const hasFatalErrors = page.errors.some(error =>
      error.includes('TypeError') && (
        error.includes('restoreEditState') ||
        error.includes('subscribe') ||
        error.includes('Cannot read properties of undefined')
      )
    );

    expect(hasFatalErrors, 'No fatal JavaScript errors should occur').toBe(false);

    // Check that some form of the page loaded (even if showing "loading" or "not found")
    const bodyExists = await page.locator('body').isVisible();
    expect(bodyExists).toBe(true);

    console.log('✅ Component initialization completed without fatal errors');
  });

  test('should handle missing invoice gracefully', async ({ page }) => {
    // Clear console errors
    page.errors.length = 0;

    // Navigate to view mode with a non-existent invoice ID
    await page.goto('http://localhost:3001/app?view=true&invoice=non-existent-invoice');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Should not have the original errors we were fixing
    const hasTargetErrors = page.errors.some(error =>
      error.includes("Cannot read properties of undefined (reading 'restoreEditState')") ||
      error.includes("Cannot read properties of undefined (reading 'subscribe')")
    );

    expect(hasTargetErrors, 'Target errors should not occur even with missing invoice').toBe(false);

    // Should show some kind of loading or error state, not crash
    const hasContent = await page.locator('body').textContent();
    expect(hasContent).toBeTruthy();

    console.log('✅ Missing invoice handled gracefully');
  });
});