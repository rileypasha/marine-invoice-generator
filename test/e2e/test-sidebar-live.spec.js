const { test, expect } = require('@playwright/test');

test('Test live sidebar clicking on production', async ({ page }) => {
  console.log('\n🔍 TESTING LIVE SIDEBAR CLICKING');

  // Monitor console
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('invoice') || text.includes('load') || text.includes('click')) {
      console.log(`📝 Console: ${text}`);
    }
    if (msg.type() === 'error') {
      console.log(`❌ Error: ${text}`);
    }
  });

  // Navigate to login
  console.log('📍 Going to login page...');
  await page.goto('https://mginvoices.com/form-login', { waitUntil: 'networkidle' });

  // Login
  console.log('🔐 Logging in...');
  await page.fill('input[name="email"]', 'test@marinegroupbw.com');
  await page.fill('input[name="password"]', 'TempPassword123!');
  await page.click('button[type="submit"]');

  // Wait for app
  console.log('⏳ Waiting for app...');
  await page.waitForURL('**/app', { timeout: 10000 });
  await page.waitForTimeout(5000);

  // Check sidebar structure
  console.log('\n🔍 Checking sidebar structure...');

  // Look for the app-sidebar that's in the HTML
  const appSidebar = await page.locator('.app-sidebar').first();
  const appSidebarExists = await appSidebar.count() > 0;
  console.log(`  .app-sidebar exists: ${appSidebarExists}`);

  if (appSidebarExists) {
    const appSidebarVisible = await appSidebar.isVisible();
    console.log(`  .app-sidebar visible: ${appSidebarVisible}`);
  }

  // Look for the dynamic sidebar
  const sidebar = await page.locator('.sidebar').first();
  const sidebarExists = await sidebar.count() > 0;
  console.log(`  .sidebar exists: ${sidebarExists}`);

  if (sidebarExists) {
    const sidebarVisible = await sidebar.isVisible();
    console.log(`  .sidebar visible: ${sidebarVisible}`);
  }

  // Check the invoice list
  const recentList = await page.locator('#recent-list').first();
  const listExists = await recentList.count() > 0;
  console.log(`  #recent-list exists: ${listExists}`);

  if (listExists) {
    const listHTML = await recentList.innerHTML();
    console.log('\n📄 Recent list HTML:');
    console.log(listHTML.substring(0, 500));

    // Look for invoice items
    const invoiceItems = await recentList.locator('li').all();
    console.log(`\n📋 Found ${invoiceItems.length} <li> items`);

    // Also check for elements with data-action="load"
    const clickableItems = await page.locator('[data-action="load"]').all();
    console.log(`📋 Found ${clickableItems.length} elements with data-action="load"`);

    if (clickableItems.length > 0) {
      const firstClickable = clickableItems[0];

      // Get details
      const dataId = await firstClickable.getAttribute('data-id');
      const dataAction = await firstClickable.getAttribute('data-action');

      console.log('\n🎯 First clickable item:');
      console.log(`  data-id: ${dataId}`);
      console.log(`  data-action: ${dataAction}`);

      // Check if it's actually clickable
      const isClickable = await firstClickable.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          pointerEvents: style.pointerEvents,
          cursor: style.cursor,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          zIndex: style.zIndex,
          position: style.position
        };
      });

      console.log('\n🎨 CSS properties:');
      Object.entries(isClickable).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });

      // Try to click
      console.log('\n🖱️ Attempting to click...');

      try {
        // First try regular click
        await firstClickable.click({ timeout: 5000 });
        console.log('  ✅ Click successful!');

        // Wait to see if anything happens
        await page.waitForTimeout(2000);

        // Check if invoice loaded
        const vesselName = await page.locator('#vessel-name').inputValue().catch(() => '');
        console.log(`  Vessel name after click: ${vesselName || '(empty)'}`);

      } catch (error) {
        console.log(`  ❌ Click failed: ${error.message}`);

        // Try force click
        console.log('  🔧 Trying force click...');
        try {
          await firstClickable.click({ force: true });
          console.log('  ✅ Force click successful!');
        } catch (forceError) {
          console.log(`  ❌ Force click also failed: ${forceError.message}`);
        }
      }
    }

    // Check if there are any event listeners
    const hasListeners = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar') || document.querySelector('.app-sidebar');
      if (!sidebar) return 'No sidebar found';

      // Check for click listeners
      const listeners = [];

      // Check sidebar itself
      if (sidebar.onclick) listeners.push('sidebar has onclick');

      // Check recent list
      const list = document.querySelector('#recent-list');
      if (list && list.onclick) listeners.push('list has onclick');

      // Check for jQuery
      if (typeof $ !== 'undefined') {
        const events = $._data(sidebar, 'events');
        if (events) listeners.push('jQuery events found');
      }

      return listeners.length > 0 ? listeners : 'No listeners found';
    });

    console.log('\n🎧 Event listener check:', hasListeners);
  }

  console.log('\n✅ Test complete');
});