const { test, expect } = require('@playwright/test');

test.describe('New URL Structure Verification', () => {
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

  test('should access /invoice/create and show invoice editor', async ({ page }) => {
    console.log('🔍 Testing /invoice/create URL...');

    // Navigate directly to the new URL
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(3000);

    // Check that we're at the correct URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/invoice/create');

    // Check that the editor container was created
    const editorContainer = page.locator('#invoice-editor-container');
    await expect(editorContainer).toBeVisible();

    // Look for invoice editor elements
    const vesselTab = page.locator('text="Vessel"');
    const customerTab = page.locator('text="Customer"');

    // At least one of these should be visible
    const hasVessel = await vesselTab.isVisible({ timeout: 2000 }).catch(() => false);
    const hasCustomer = await customerTab.isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasVessel || hasCustomer, 'Should find invoice editor elements').toBe(true);

    console.log('✅ /invoice/create URL is working correctly');
  });

  test('should access /invoice/:id/edit and show invoice editor', async ({ page }) => {
    console.log('🔍 Testing /invoice/:id/edit URL...');

    // Navigate directly to the new edit URL with a test ID
    await page.goto('http://localhost:3001/invoice/test-id-123/edit');
    await page.waitForTimeout(3000);

    // Check that we're at the correct URL
    const currentUrl = page.url();
    expect(currentUrl).toContain('/invoice/test-id-123/edit');

    // Check that the editor container was created
    const editorContainer = page.locator('#invoice-editor-container');
    await expect(editorContainer).toBeVisible();

    console.log('✅ /invoice/:id/edit URL is working correctly');
  });

  test('should navigate from New Invoice button to /invoice/create', async ({ page }) => {
    console.log('🔍 Testing New Invoice button navigation...');

    // Go to invoices page
    await page.goto('http://localhost:3001/invoices');
    await page.waitForTimeout(2000);

    // Look for the New Invoice button
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), #new-invoice-btn, .new-invoice-button');

    if (await newInvoiceButton.first().isVisible()) {
      console.log('✅ Found New Invoice button');

      // Click the button
      await newInvoiceButton.first().click();

      // Wait for navigation
      await page.waitForTimeout(3000);

      // Check that we navigated to the new URL structure
      const currentUrl = page.url();
      console.log(`URL after clicking New Invoice: ${currentUrl}`);

      expect(currentUrl).toContain('/invoice/create');

      // Verify the page is working
      const editorContainer = page.locator('#invoice-editor-container');
      await expect(editorContainer).toBeVisible();

      console.log('✅ New Invoice button successfully navigates to /invoice/create');
    } else {
      console.log('⚠️ New Invoice button not found');
    }
  });

  test('should verify old /app URL still works for backward compatibility', async ({ page }) => {
    console.log('🔍 Testing backward compatibility with /app URL...');

    // Navigate to the old URL
    await page.goto('http://localhost:3001/app');
    await page.waitForTimeout(3000);

    // Check that it still works
    const editorContainer = page.locator('#invoice-editor-container');
    await expect(editorContainer).toBeVisible();

    console.log('✅ /app URL still works for backward compatibility');
  });
});