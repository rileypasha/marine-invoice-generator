const { test, expect } = require('@playwright/test');

test.describe('Sidebar Redesign and Invoices Index Verification', () => {
  test('verify sidebar redesign and invoices index page functionality', async ({ page }) => {
    console.log('🧪 Testing sidebar redesign and invoices index on production...');

    // Navigate to production site
    await page.goto('https://mginvoices.com');
    await page.waitForLoadState('networkidle');

    console.log('✅ Navigated to mginvoices.com');

    // Login with correct credentials
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('input[name="email"]');
    await page.fill('input[name="email"]', 'riley@mgmarinegroup.com');
    await page.fill('input[name="password"]', 'TempPassword123!');
    await page.click('button:has-text("Sign In")');

    // Wait for successful login and app to load
    await page.waitForURL('**/app');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.sidebar');

    console.log('✅ Logged in successfully');

    // Verify sidebar elements have been removed per requirements
    console.log('🔍 Checking removed sidebar elements...');

    // Should NOT have search input
    const searchInput = page.locator('.sidebar-search');
    await expect(searchInput).toHaveCount(0);
    console.log('✅ Search input removed');

    // Should NOT have saved invoices list
    const savedInvoicesList = page.locator('.sidebar-items');
    await expect(savedInvoicesList).toHaveCount(0);
    console.log('✅ Saved invoices list removed');

    // Should NOT have empty state messages
    const emptyStateMessage = page.locator('text="No invoices found"');
    await expect(emptyStateMessage).toHaveCount(0);
    console.log('✅ Empty state messages removed');

    // Should NOT have Reports navigation item
    const reportsNav = page.locator('text="Reports"');
    await expect(reportsNav).toHaveCount(0);
    console.log('✅ Reports navigation removed');

    // Should NOT have + button in sidebar footer
    const plusButton = page.locator('.sidebar [aria-label="New Invoice"]');
    await expect(plusButton).toHaveCount(0);
    console.log('✅ + button removed');

    // Verify profile section shows only icon (no name/email text)
    console.log('🔍 Checking simplified profile section...');
    const profileSection = page.locator('.user-profile');
    await expect(profileSection).toBeVisible();

    // Should have profile icon but no user name/email display
    const userAvatar = page.locator('.user-avatar, .profile-icon');
    await expect(userAvatar).toBeVisible();

    // Should not have user name or email text visible
    const userName = page.locator('.user-name, .user-email');
    await expect(userName).toHaveCount(0);
    console.log('✅ Profile section simplified to icon only');

    // Test new navigation flow - Invoices button should navigate to index page
    console.log('🔍 Testing Invoices navigation...');
    const invoicesButton = page.locator('text="Invoices"');
    await expect(invoicesButton).toBeVisible();

    // Click Invoices button - should navigate to /invoices page (not open form)
    await invoicesButton.click();
    await page.waitForURL('**/invoices');
    await page.waitForLoadState('networkidle');

    console.log('✅ Invoices button navigates to index page');

    // Verify we're on the invoices index page with table interface
    await expect(page.locator('h1:has-text("Invoices")')).toBeVisible();

    // Should have "New Invoice" button on the index page
    const newInvoiceButton = page.locator('button:has-text("New Invoice"), a:has-text("New Invoice")');
    await expect(newInvoiceButton).toBeVisible();
    console.log('✅ New Invoice button present on index page');

    // Should have invoice table/grid interface
    const invoiceTable = page.locator('table, .invoice-grid, .invoice-list');
    await expect(invoiceTable).toBeVisible();
    console.log('✅ Invoice table interface present');

    // Test that New Invoice button works
    console.log('🔍 Testing New Invoice button...');
    await newInvoiceButton.click();
    await page.waitForURL('**/app');
    await page.waitForLoadState('networkidle');

    // Should be on new invoice form
    const invoiceForm = page.locator('#invoice-form, .invoice-form');
    await expect(invoiceForm).toBeVisible();
    console.log('✅ New Invoice button navigates to form');

    // Check for console errors
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    // Navigate back to invoices to check for any errors
    await page.goto('https://mginvoices.com/invoices');
    await page.waitForLoadState('networkidle');

    // Check for console errors
    if (consoleLogs.length > 0) {
      console.log('⚠️ Console errors detected:');
      consoleLogs.forEach(log => console.log('   ', log));
    } else {
      console.log('✅ No console errors detected');
    }

    console.log('🎉 Sidebar redesign verification complete!');
  });
});