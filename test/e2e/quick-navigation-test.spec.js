const { test, expect } = require('@playwright/test');

test.describe('Quick Navigation Test', () => {
  test('should navigate directly to /invoices via URL and verify sidebar href', async ({ page }) => {
    // Navigate directly to invoices page (this serves the updated HTML file)
    await page.goto('http://localhost:3001/invoices');
    await page.waitForTimeout(2000);

    // Check that invoice button exists and has correct href
    const invoiceButton = page.locator('a[title="Invoices"]');
    await expect(invoiceButton).toBeVisible();

    const hrefValue = await invoiceButton.getAttribute('href');
    console.log(`Invoice button href: ${hrefValue}`);

    // This should now be /invoices, not /app
    expect(hrefValue).toBe('/invoices');

    console.log('✅ Fix verified: Invoice button now has correct href="/invoices"');
  });

  test('should manually verify no race condition by checking DOM directly', async ({ page }) => {
    // Navigate to app page
    await page.goto('http://localhost:3001/app');
    await page.waitForTimeout(1000);

    // Check the href attribute directly in the DOM
    const hrefFromDOM = await page.evaluate(() => {
      const button = document.querySelector('a[title="Invoices"]');
      return button ? button.getAttribute('href') : null;
    });

    console.log(`DOM check - Invoice button href: ${hrefFromDOM}`);

    // If this is /invoices, the fix is working
    // If this is /app, the build hasn't updated the served files yet
    expect(hrefFromDOM).toBe('/invoices');

    console.log('✅ DOM verification: Race condition fix is active');
  });
});