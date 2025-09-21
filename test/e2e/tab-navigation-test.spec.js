const { test, expect } = require('@playwright/test');

test.describe('Tab Navigation Functionality', () => {
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

  test('should show only vessel tab content by default', async ({ page }) => {
    console.log('🔍 Testing default tab state...');

    // Navigate to invoice create page
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(3000);

    // Check that vessel tab content is visible
    const vesselContent = page.locator('[data-value="vessel"], #vessel-form-container').first();
    await expect(vesselContent).toBeVisible();

    // Check that other tab contents are not visible
    const customerContent = page.locator('[data-value="customer"]').first();
    const servicesContent = page.locator('[data-value="services"]').first();
    const notesContent = page.locator('[data-value="notes"]').first();

    // These should not be visible since vessel is the default
    await expect(customerContent).not.toBeVisible();
    await expect(servicesContent).not.toBeVisible();
    await expect(notesContent).not.toBeVisible();

    console.log('✅ Default tab state working correctly');
  });

  test('should switch between tabs when clicking tab buttons', async ({ page }) => {
    console.log('🔍 Testing tab button functionality...');

    // Navigate to invoice create page
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(3000);

    // Test clicking on Customer tab
    const customerTab = page.locator('button:has-text("Customer")');
    await customerTab.click();
    await page.waitForTimeout(500);

    // Vessel content should now be hidden, Customer content should be visible
    const vesselContent = page.locator('div:has(#vessel-form-container)');
    const customerContent = page.locator('div:has(#customer-form-container)');

    await expect(vesselContent).not.toBeVisible();
    await expect(customerContent).toBeVisible();

    // Test clicking on Services tab
    const servicesTab = page.locator('button:has-text("Services")');
    await servicesTab.click();
    await page.waitForTimeout(500);

    // Customer content should now be hidden, Services content should be visible
    const servicesContent = page.locator('div:has(#services-form-container)');

    await expect(customerContent).not.toBeVisible();
    await expect(servicesContent).toBeVisible();

    // Test clicking on Notes tab
    const notesTab = page.locator('button:has-text("Notes")');
    await notesTab.click();
    await page.waitForTimeout(500);

    // Services content should now be hidden, Notes content should be visible
    const notesContent = page.locator('div:has(#notes-form-container)');

    await expect(servicesContent).not.toBeVisible();
    await expect(notesContent).toBeVisible();

    // Test clicking back to Vessel tab
    const vesselTab = page.locator('button:has-text("Vessel")');
    await vesselTab.click();
    await page.waitForTimeout(500);

    // Notes content should now be hidden, Vessel content should be visible
    await expect(notesContent).not.toBeVisible();
    await expect(vesselContent).toBeVisible();

    console.log('✅ Tab switching functionality working correctly');
  });

  test('should visually indicate active tab', async ({ page }) => {
    console.log('🔍 Testing active tab visual indication...');

    // Navigate to invoice create page
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(3000);

    // Check that vessel tab is visually active by default
    const vesselTab = page.locator('button:has-text("Vessel")');
    await expect(vesselTab).toHaveClass(/bg-background.*text-foreground.*shadow/);

    // Click on customer tab and check it becomes active
    const customerTab = page.locator('button:has-text("Customer")');
    await customerTab.click();
    await page.waitForTimeout(500);

    await expect(customerTab).toHaveClass(/bg-background.*text-foreground.*shadow/);
    await expect(vesselTab).not.toHaveClass(/bg-background.*text-foreground.*shadow/);

    console.log('✅ Active tab visual indication working correctly');
  });
});