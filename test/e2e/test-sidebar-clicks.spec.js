const { test, expect } = require('@playwright/test');

test('Test sidebar invoice clicking functionality', async ({ page }) => {
  console.log('\n🔍 TESTING SIDEBAR CLICK FUNCTIONALITY');

  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console Error:', msg.text());
    }
  });

  // Navigate and login
  console.log('📍 Going to login page...');
  await page.goto('https://mginvoices.com/form-login', { waitUntil: 'networkidle' });

  console.log('🔐 Logging in...');
  await page.fill('input[name="email"]', 'test@marinegroupbw.com');
  await page.fill('input[name="password"]', 'TempPassword123!');
  await page.click('button[type="submit"]');

  // Wait for app to load
  console.log('⏳ Waiting for app to load...');
  await page.waitForURL('**/app', { timeout: 10000 });
  await page.waitForTimeout(3000);

  // Check if sidebar exists
  const sidebar = await page.locator('.sidebar').first();
  const sidebarVisible = await sidebar.isVisible();
  console.log('🎯 Sidebar visible:', sidebarVisible);

  if (sidebarVisible) {
    // Look for invoice items
    const invoiceItemSelectors = [
      '.invoice-item',
      '.sidebar-invoice-item',
      '#recent-list li',
      '.invoice-list li',
      '.sidebar [data-invoice-id]',
      '.sidebar button',
      '.sidebar a'
    ];

    let itemsFound = false;
    for (const selector of invoiceItemSelectors) {
      const items = await page.locator(selector).all();
      if (items.length > 0) {
        console.log(`\n📋 Found ${items.length} items with selector: ${selector}`);
        itemsFound = true;

        // Test the first item
        const firstItem = items[0];
        const text = await firstItem.textContent();
        console.log(`  First item text: "${text?.trim()}"`);

        // Check if it has click handlers
        const hasOnClick = await firstItem.evaluate(el => {
          return el.onclick !== null ||
                 el.hasAttribute('onclick') ||
                 el.style.cursor === 'pointer' ||
                 el.tagName === 'BUTTON' ||
                 el.tagName === 'A';
        });
        console.log(`  Has onClick handler or is clickable element: ${hasOnClick}`);

        // Check for data attributes
        const dataInvoiceId = await firstItem.getAttribute('data-invoice-id');
        if (dataInvoiceId) {
          console.log(`  Has data-invoice-id: ${dataInvoiceId}`);
        }

        // Try to click it
        console.log('  🖱️ Attempting to click first item...');
        try {
          await firstItem.click({ timeout: 5000 });
          console.log('  ✅ Click successful!');

          // Check if anything changed
          await page.waitForTimeout(2000);
          const newUrl = page.url();
          console.log(`  Current URL after click: ${newUrl}`);
        } catch (error) {
          console.log(`  ❌ Click failed: ${error.message}`);
        }

        break; // Only test first working selector
      }
    }

    if (!itemsFound) {
      console.log('\n⚠️ No invoice items found in sidebar!');
    }

    // Check for event listeners on the sidebar
    const hasEventDelegation = await sidebar.evaluate(el => {
      // Check if sidebar has event listeners
      const listeners = el._addEventListener || el.onclick || el.addEventListener;
      return listeners !== undefined;
    });
    console.log(`\n🎯 Sidebar has event delegation setup: ${hasEventDelegation}`);

    // Check the invoice list container specifically
    const invoiceList = await page.locator('#recent-list, .invoice-list').first();
    if (await invoiceList.count() > 0) {
      const listHTML = await invoiceList.innerHTML();
      console.log('\n📄 Invoice list HTML structure (first 300 chars):');
      console.log(listHTML.substring(0, 300));

      // Check if setupInvoiceItemListeners was called
      const listenersSetup = await page.evaluate(() => {
        return window.invoiceListenersSetup || false;
      });
      console.log(`\n🎧 Invoice listeners setup: ${listenersSetup}`);
    }
  }

  console.log('\n✅ Sidebar click test complete');
});