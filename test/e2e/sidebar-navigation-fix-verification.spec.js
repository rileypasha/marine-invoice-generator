const { test, expect } = require('@playwright/test');

test.describe('Sidebar Navigation Fix Verification', () => {
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

  test('should consistently navigate to /invoices when clicking sidebar invoice button', async ({ page }) => {
    // Test multiple navigation attempts to verify consistency
    for (let i = 0; i < 5; i++) {
      console.log(`🔄 Navigation test attempt ${i + 1}/5`);

      // Start from a known page
      await page.goto('http://localhost:3001/app');
      await page.waitForTimeout(1000);

      // Click the invoice button in sidebar
      const invoiceButton = page.locator('a[title="Invoices"]');
      await expect(invoiceButton).toBeVisible();

      // Verify href attribute is correct
      const hrefValue = await invoiceButton.getAttribute('href');
      expect(hrefValue, `Invoice button should have correct href on attempt ${i + 1}`).toBe('/invoices');

      // Click the button
      await invoiceButton.click();

      // Wait for navigation and verify URL
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      console.log(`  Current URL after click: ${currentUrl}`);

      // Should be on invoices page, not app page
      expect(currentUrl, `Should navigate to invoices page on attempt ${i + 1}`).toContain('/invoices');
      expect(currentUrl, `Should NOT redirect to app page on attempt ${i + 1}`).not.toContain('/app');
    }

    console.log('✅ All 5 navigation attempts consistently went to /invoices');
  });

  test('should have correct href attributes in all HTML pages', async ({ page }) => {
    const pages = [
      { url: 'http://localhost:3001/app', name: 'index.html' },
      { url: 'http://localhost:3001/invoices', name: 'invoices.html' },
      { url: 'http://localhost:3001/customers', name: 'customers.html' },
      { url: 'http://localhost:3001/vessels', name: 'vessels.html' }
    ];

    for (const testPage of pages) {
      console.log(`🔍 Testing ${testPage.name}...`);

      await page.goto(testPage.url);
      await page.waitForTimeout(1000);

      // Check that invoice button exists and has correct href
      const invoiceButton = page.locator('a[title="Invoices"]');
      await expect(invoiceButton).toBeVisible();

      const hrefValue = await invoiceButton.getAttribute('href');
      expect(hrefValue, `${testPage.name} should have correct href`).toBe('/invoices');

      console.log(`  ✅ ${testPage.name}: href="${hrefValue}"`);
    }
  });

  test('should navigate correctly from different starting pages', async ({ page }) => {
    const startingPages = [
      'http://localhost:3001/app',
      'http://localhost:3001/customers',
      'http://localhost:3001/vessels'
    ];

    for (const startingPage of startingPages) {
      console.log(`🚀 Testing navigation from ${startingPage}...`);

      await page.goto(startingPage);
      await page.waitForTimeout(1000);

      // Click invoice button
      const invoiceButton = page.locator('a[title="Invoices"]');
      await invoiceButton.click();

      // Verify navigation
      await page.waitForTimeout(2000);
      const finalUrl = page.url();

      expect(finalUrl, `Should navigate to invoices from ${startingPage}`).toContain('/invoices');
      console.log(`  ✅ ${startingPage} → ${finalUrl}`);
    }
  });
});