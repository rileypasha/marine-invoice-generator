const { test, expect } = require('@playwright/test');

test.describe('Form Container Initialization', () => {
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

  test('should find all 4 form containers after tab fix', async ({ page }) => {
    console.log('🔍 Testing form container availability...');

    // Navigate to invoice create page
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(4000); // Wait for form initialization

    // Check console logs for container initialization
    const logs = [];
    page.on('console', (msg) => {
      if (msg.text().includes('form container') || msg.text().includes('Found') || msg.text().includes('Initializing form containers')) {
        logs.push(msg.text());
      }
    });

    // Refresh to trigger initialization and capture logs
    await page.reload();
    await page.waitForTimeout(4000);

    // Check that all containers exist in the DOM (even if hidden)
    const vesselContainer = page.locator('#vessel-form-container');
    const customerContainer = page.locator('#customer-form-container');
    const servicesContainer = page.locator('#services-form-container');
    const notesContainer = page.locator('#notes-form-container');

    await expect(vesselContainer).toBeAttached();
    await expect(customerContainer).toBeAttached();
    await expect(servicesContainer).toBeAttached();
    await expect(notesContainer).toBeAttached();

    console.log('✅ All form containers found in DOM');

    // Test that vessel tab is visible by default
    await expect(vesselContainer).toBeVisible();
    await expect(customerContainer).not.toBeVisible();
    await expect(servicesContainer).not.toBeVisible();
    await expect(notesContainer).not.toBeVisible();

    console.log('✅ Default tab visibility working correctly');

    // Test tab switching makes correct container visible
    await page.click('button:has-text("Customer")');
    await page.waitForTimeout(500);

    await expect(vesselContainer).not.toBeVisible();
    await expect(customerContainer).toBeVisible();
    await expect(servicesContainer).not.toBeVisible();
    await expect(notesContainer).not.toBeVisible();

    console.log('✅ Tab switching working correctly');
  });
});