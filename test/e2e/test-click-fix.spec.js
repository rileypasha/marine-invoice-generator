const { test, expect } = require('@playwright/test');

test.only('Test sidebar click fix', async ({ browser }) => {
  // Use chromium only for this test
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n🔍 TESTING SIDEBAR CLICK FIX');

  // Navigate directly to app page (will redirect to login if needed)
  console.log('📍 Going to app page...');
  await page.goto('https://mginvoices.com/app', { waitUntil: 'domcontentloaded' });

  // Check if we need to login
  const currentUrl = page.url();
  console.log('📍 Current URL:', currentUrl);

  if (currentUrl.includes('login') || currentUrl === 'https://mginvoices.com/' || currentUrl === 'https://mginvoices.com/form-login') {
    console.log('🔐 Need to login...');

    // Look for login form
    const emailInput = await page.locator('input[name="email"], input[type="email"]').first();
    const passwordInput = await page.locator('input[name="password"], input[type="password"]').first();

    await emailInput.fill('test@marinegroupbw.com');
    await passwordInput.fill('TempPassword123!');

    const submitButton = await page.locator('button[type="submit"]').first();
    await submitButton.click();

    console.log('⏳ Waiting for redirect to app...');
    await page.waitForURL('**/app', { timeout: 10000 });
  }

  // Wait for app to fully load
  console.log('⏳ Waiting for app to stabilize...');
  await page.waitForTimeout(5000);

  // Take a screenshot to see current state
  await page.screenshot({ path: 'test-results/sidebar-state.png', fullPage: true });

  // Check for sidebar
  const sidebar = await page.locator('.sidebar').first();
  const sidebarExists = await sidebar.count() > 0;
  console.log('🎯 Sidebar exists:', sidebarExists);

  if (sidebarExists) {
    const sidebarVisible = await sidebar.isVisible();
    console.log('🎯 Sidebar visible:', sidebarVisible);

    // Get the sidebar HTML to debug
    const sidebarHTML = await sidebar.innerHTML();
    console.log('\n📄 Sidebar HTML (first 500 chars):');
    console.log(sidebarHTML.substring(0, 500));

    // Look for invoice items with the fixed selector
    const clickableItems = await page.locator('[data-action="load"]').all();
    console.log(`\n📋 Found ${clickableItems.length} clickable items with data-action="load"`);

    if (clickableItems.length > 0) {
      const firstItem = clickableItems[0];

      // Get item details
      const itemId = await firstItem.getAttribute('data-id');
      const itemHTML = await firstItem.innerHTML();

      console.log(`\n🎯 First clickable item:`);
      console.log(`  ID: ${itemId}`);
      console.log(`  HTML: ${itemHTML.substring(0, 200)}`);

      // Monitor console for loading messages
      page.on('console', msg => {
        if (msg.text().includes('invoice') || msg.text().includes('load')) {
          console.log(`  📝 Console: ${msg.text()}`);
        }
      });

      // Try clicking
      console.log('\n🖱️ Attempting click on first item...');
      try {
        await firstItem.click();
        console.log('  ✅ Click successful!');

        // Wait for any response
        await page.waitForTimeout(2000);

        // Check if anything happened
        const newUrl = page.url();
        console.log(`  📍 URL after click: ${newUrl}`);

        // Check form content
        const vesselName = await page.locator('#vessel-name').inputValue().catch(() => null);
        if (vesselName) {
          console.log(`  📝 Vessel name in form: ${vesselName}`);
        }

      } catch (error) {
        console.log(`  ❌ Click failed: ${error.message}`);
      }

      // Also test clicking on the title directly
      console.log('\n🖱️ Testing click on title text...');
      const titleElement = await firstItem.locator('.item-title').first();
      if (await titleElement.count() > 0) {
        const titleText = await titleElement.textContent();
        console.log(`  Title text: ${titleText}`);

        try {
          await titleElement.click();
          console.log('  ✅ Title click successful!');
          await page.waitForTimeout(2000);
        } catch (error) {
          console.log(`  ❌ Title click failed: ${error.message}`);
        }
      }
    }

    // Check the recent list specifically
    const recentList = await page.locator('#recent-list').first();
    if (await recentList.count() > 0) {
      const listItems = await recentList.locator('li').all();
      console.log(`\n📋 Recent list has ${listItems.length} items`);

      if (listItems.length > 0) {
        const firstLi = listItems[0];
        const liHTML = await firstLi.innerHTML();
        console.log('  First list item HTML:');
        console.log('  ' + liHTML.substring(0, 300));
      }
    }
  }

  console.log('\n✅ Click fix test complete');
  await context.close();
});