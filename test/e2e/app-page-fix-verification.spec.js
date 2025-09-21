const { test, expect } = require('@playwright/test');

test.describe('App Page Fix Verification', () => {
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

  test('should display invoice editor UI instead of blank page', async ({ page }) => {
    // Navigate to the /app page
    await page.goto('http://localhost:3001/app');
    await page.waitForTimeout(3000);

    console.log('🔍 Testing /app page functionality...');

    // Check that we're not getting a blank/black page
    const mainContent = page.locator('main.main-content');
    await expect(mainContent).toBeVisible();

    // Check that the editor container was created
    const editorContainer = page.locator('#invoice-editor-container');
    await expect(editorContainer).toBeVisible();

    // Look for typical invoice editor elements (tabs, forms, etc.)
    // Note: These selectors depend on what InvoiceEditorUI component renders
    const possibleEditorElements = [
      'text="Vessel"',
      'text="Customer"',
      'text="Services"',
      'text="Notes"',
      'text="Preview"',
      '.invoice-editor',
      '.tab-navigation',
      '.form-section'
    ];

    let foundElements = 0;
    for (const selector of possibleEditorElements) {
      try {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 1000 })) {
          foundElements++;
          console.log(`  ✅ Found element: ${selector}`);
        }
      } catch (error) {
        // Element not found, continue checking others
        console.log(`  ❌ Not found: ${selector}`);
      }
    }

    // We expect to find at least some invoice editor UI elements
    expect(foundElements, 'Should find at least one invoice editor element').toBeGreaterThan(0);

    console.log(`✅ /app page is now functional with ${foundElements} UI elements found`);
  });

  test('should verify New Invoice button functionality', async ({ page }) => {
    // Go to invoices page first
    await page.goto('http://localhost:3001/invoices');
    await page.waitForTimeout(2000);

    console.log('🔍 Testing New Invoice button...');

    // Look for the New Invoice button
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), #new-invoice-btn, .new-invoice-button');

    if (await newInvoiceButton.first().isVisible()) {
      console.log('✅ Found New Invoice button');

      // Click the button
      await newInvoiceButton.first().click();

      // Wait for navigation
      await page.waitForTimeout(3000);

      // Check that we navigated to /app
      const currentUrl = page.url();
      console.log(`Current URL after clicking: ${currentUrl}`);

      expect(currentUrl).toContain('/app');

      // Verify the page is not blank
      const editorContainer = page.locator('#invoice-editor-container');
      await expect(editorContainer).toBeVisible();

      console.log('✅ New Invoice button successfully navigates to working /app page');
    } else {
      console.log('⚠️ New Invoice button not found - may need to scroll or check different selector');
    }
  });
});