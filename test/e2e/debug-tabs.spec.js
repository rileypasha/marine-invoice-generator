const { test, expect } = require('@playwright/test');

test.describe('Debug Tabs', () => {
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

  test('should show console logs from TabsContent', async ({ page }) => {
    console.log('🔍 Checking TabsContent console logs...');

    // Capture console logs
    const logs = [];
    page.on('console', (msg) => {
      if (msg.text().includes('TabsContent rendering')) {
        console.log('📝 Console:', msg.text());
        logs.push(msg.text());
      }
    });

    // Navigate to invoice create page
    await page.goto('http://localhost:3001/invoice/create');
    await page.waitForTimeout(3000);

    // Check if we got any TabsContent logs
    console.log(`🔢 Total TabsContent logs captured: ${logs.length}`);

    if (logs.length === 0) {
      console.log('❌ No TabsContent logs found - component might not be used');
    } else {
      console.log('✅ TabsContent component is being used');
      logs.forEach(log => console.log('  📄', log));
    }

    // Check if all tab contents exist in DOM regardless of visibility
    const allTabContents = await page.locator('[data-tab-content]').count();
    const visibleTabContents = await page.locator('[data-tab-content]:visible').count();

    console.log(`📊 Total tab contents: ${allTabContents}`);
    console.log(`👁️ Visible tab contents: ${visibleTabContents}`);

    // This test mainly serves to capture console output
    expect(logs.length).toBeGreaterThanOrEqual(0);
  });
});