const { test, expect } = require('@playwright/test');

test.describe('Quick Container Check', () => {
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

  test('should check what containers exist on the page', async ({ page }) => {
    console.log('🔍 Checking page containers...');

    // Navigate to invoice create page
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(4000);

    // Get page HTML to see what's actually rendered
    const pageContent = await page.content();
    const hasVesselContainer = pageContent.includes('vessel-form-container');
    const hasCustomerContainer = pageContent.includes('customer-form-container');
    const hasServicesContainer = pageContent.includes('services-form-container');
    const hasNotesContainer = pageContent.includes('notes-form-container');

    console.log('📊 Container status:');
    console.log(`  - vessel-form-container: ${hasVesselContainer ? '✅' : '❌'}`);
    console.log(`  - customer-form-container: ${hasCustomerContainer ? '✅' : '❌'}`);
    console.log(`  - services-form-container: ${hasServicesContainer ? '✅' : '❌'}`);
    console.log(`  - notes-form-container: ${hasNotesContainer ? '✅' : '❌'}`);

    // Also check if tabs exist
    const hasVesselTab = pageContent.includes('Vessel');
    const hasCustomerTab = pageContent.includes('Customer');
    const hasServicesTab = pageContent.includes('Services');
    const hasNotesTab = pageContent.includes('Notes');

    console.log('📋 Tab status:');
    console.log(`  - Vessel tab: ${hasVesselTab ? '✅' : '❌'}`);
    console.log(`  - Customer tab: ${hasCustomerTab ? '✅' : '❌'}`);
    console.log(`  - Services tab: ${hasServicesTab ? '✅' : '❌'}`);
    console.log(`  - Notes tab: ${hasNotesTab ? '✅' : '❌'}`);

    // At minimum, we should have all tabs
    expect(hasVesselTab).toBe(true);
    expect(hasCustomerTab).toBe(true);
    expect(hasServicesTab).toBe(true);
    expect(hasNotesTab).toBe(true);

    console.log('✅ Basic tab structure exists');
  });
});