const { test, expect } = require('@playwright/test');

test.describe('Final URL Structure Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login with provided credentials
    await page.fill('#email', 'test@marinegroupbw.com');
    await page.fill('#password', 'TempPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to app
    await page.waitForURL('**/app**');
  });

  test('should verify New Invoice button navigates to /invoice/create', async ({ page }) => {
    console.log('🔍 Testing final URL structure...');

    // Go to invoices page
    await page.goto('http://localhost:3001/invoices');
    await page.waitForTimeout(2000);

    // Find and click New Invoice button
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), #new-invoice-btn, .new-invoice-button');

    if (await newInvoiceButton.first().isVisible()) {
      console.log('✅ Found New Invoice button');

      // Click the button
      await newInvoiceButton.first().click();

      // Wait for navigation
      await page.waitForTimeout(3000);

      // Check URL
      const currentUrl = page.url();
      console.log(`Final URL: ${currentUrl}`);

      // Should now be /invoice/create
      expect(currentUrl).toContain('/invoice/create');

      // Check that editor is working
      const editorContainer = page.locator('#invoice-editor-container');
      await expect(editorContainer).toBeVisible();

      console.log('✅ SUCCESS: New Invoice button now navigates to /invoice/create');
    } else {
      throw new Error('New Invoice button not found');
    }
  });
});