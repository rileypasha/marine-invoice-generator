const { test, expect } = require('@playwright/test');

test('Debug sidebar click functionality', async ({ page }) => {
  console.log('\n🔍 DEBUGGING SIDEBAR CLICK ISSUES');

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

  // Check sidebar structure
  const sidebar = await page.locator('.sidebar').first();
  const sidebarVisible = await sidebar.isVisible();
  console.log('🎯 Sidebar visible:', sidebarVisible);

  if (sidebarVisible) {
    // Get the invoice list HTML
    const invoiceList = await page.locator('#recent-list').first();
    const listHTML = await invoiceList.innerHTML();

    console.log('\n📄 Invoice list HTML structure:');
    console.log(listHTML.substring(0, 1000));

    // Check for invoice items
    const invoiceItems = await invoiceList.locator('li').all();
    console.log(`\n📋 Found ${invoiceItems.length} invoice items`);

    if (invoiceItems.length > 0) {
      // Analyze first item
      const firstItem = invoiceItems[0];
      const itemHTML = await firstItem.innerHTML();
      console.log('\n🔍 First item HTML:');
      console.log(itemHTML);

      // Check for data attributes
      const hasDataAction = await firstItem.getAttribute('data-action');
      const hasDataId = await firstItem.getAttribute('data-id');
      const hasDataInvoiceId = await firstItem.getAttribute('data-invoice-id');

      console.log('\n📊 Data attributes on first item:');
      console.log(`  data-action: ${hasDataAction}`);
      console.log(`  data-id: ${hasDataId}`);
      console.log(`  data-invoice-id: ${hasDataInvoiceId}`);

      // Check for click handlers
      const hasClickHandler = await firstItem.evaluate(el => {
        // Check if element has direct onclick or any parent does
        let current = el;
        while (current) {
          if (current.onclick || current.hasAttribute('onclick')) {
            return 'Has onclick attribute';
          }
          current = current.parentElement;
        }
        return 'No onclick found';
      });
      console.log(`  Click handler check: ${hasClickHandler}`);

      // Check CSS cursor
      const cursor = await firstItem.evaluate(el => {
        return window.getComputedStyle(el).cursor;
      });
      console.log(`  CSS cursor: ${cursor}`);

      // Try to click and see what happens
      console.log('\n🖱️ Attempting to click first item...');

      // Set up network monitoring
      let navigationOccurred = false;
      page.on('framenavigated', () => {
        navigationOccurred = true;
      });

      try {
        await firstItem.click();
        await page.waitForTimeout(2000);

        console.log(`  Navigation occurred: ${navigationOccurred}`);
        console.log(`  Current URL: ${page.url()}`);

        // Check if any modal opened
        const modalVisible = await page.locator('.modal, [role="dialog"]').isVisible().catch(() => false);
        console.log(`  Modal visible: ${modalVisible}`);

      } catch (error) {
        console.log(`  ❌ Click failed: ${error.message}`);
      }

      // Check what JavaScript sees when clicking
      const clickInfo = await page.evaluate(() => {
        const list = document.querySelector('#recent-list');
        if (!list) return 'No #recent-list found';

        // Check if there are any event listeners
        const listeners = getEventListeners ? getEventListeners(list) : 'getEventListeners not available';

        // Try to find the click handler in the code
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.__eventListeners) {
          return 'Has event listeners via __eventListeners';
        }

        // Check if setupInvoiceItemListeners exists
        if (window.setupInvoiceItemListeners) {
          return 'setupInvoiceItemListeners function exists';
        }

        return { listeners, sidebarFound: !!sidebar };
      });

      console.log('\n🎧 Event listener check:');
      console.log(clickInfo);
    }
  }

  console.log('\n✅ Debug complete');
});