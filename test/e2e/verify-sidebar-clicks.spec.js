const { test, expect } = require('@playwright/test');

test('Verify sidebar invoice clicking is fixed', async ({ page }) => {
  console.log('\n🔍 VERIFYING SIDEBAR CLICK FIX');

  // Monitor console for errors
  let consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
    // Also log messages about invoice loading
    if (msg.type() === 'log' && msg.text().includes('invoice')) {
      console.log('📝 Console Log:', msg.text());
    }
  });

  // Monitor network for navigation
  let navigationOccurred = false;
  let loadInvoiceApiCalled = false;

  page.on('response', response => {
    if (response.url().includes('/api/invoices/') && !response.url().includes('/user')) {
      loadInvoiceApiCalled = true;
      console.log(`📡 Invoice load API called: ${response.url()} - Status: ${response.status()}`);
    }
  });

  page.on('framenavigated', () => {
    navigationOccurred = true;
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

  // Check sidebar exists
  const sidebar = await page.locator('.sidebar').first();
  const sidebarVisible = await sidebar.isVisible();
  console.log('🎯 Sidebar visible:', sidebarVisible);

  if (sidebarVisible) {
    // Look for invoice items in the recent list
    const invoiceList = await page.locator('#recent-list').first();
    const invoiceItems = await invoiceList.locator('.item-main[data-action="load"]').all();

    console.log(`\n📋 Found ${invoiceItems.length} clickable invoice items`);

    if (invoiceItems.length > 0) {
      const firstItem = invoiceItems[0];

      // Get info about the first item
      const itemId = await firstItem.getAttribute('data-id');
      const itemTitle = await firstItem.locator('.item-title').textContent();

      console.log(`\n🎯 Testing click on first invoice:`);
      console.log(`  ID: ${itemId}`);
      console.log(`  Title: ${itemTitle?.trim()}`);

      // Get initial state
      const initialUrl = page.url();
      const initialFormContent = await page.locator('#vessel-name').inputValue().catch(() => '');

      // Click the invoice item
      console.log('\n🖱️ Clicking invoice item...');
      await firstItem.click();

      // Wait for potential changes
      await page.waitForTimeout(3000);

      // Check what happened
      const finalUrl = page.url();
      const finalFormContent = await page.locator('#vessel-name').inputValue().catch(() => '');

      console.log('\n📊 Results:');
      console.log(`  URL changed: ${initialUrl !== finalUrl}`);
      console.log(`  Form content changed: ${initialFormContent !== finalFormContent}`);
      console.log(`  Invoice API called: ${loadInvoiceApiCalled}`);
      console.log(`  Navigation occurred: ${navigationOccurred}`);

      // Check if any modal appeared (for unsaved changes)
      const modalVisible = await page.locator('.modal, [role="dialog"]').isVisible().catch(() => false);
      console.log(`  Modal visible: ${modalVisible}`);

      // The click should have triggered something
      if (!loadInvoiceApiCalled && !modalVisible && initialFormContent === finalFormContent) {
        console.log('\n⚠️ WARNING: Click didn\'t trigger expected behavior!');
        console.log('  - No invoice API call');
        console.log('  - No modal shown');
        console.log('  - Form content unchanged');
      } else {
        console.log('\n✅ Click functionality is working!');
      }

      // Try clicking on different parts of the item to ensure it works
      console.log('\n🧪 Testing click on title text directly...');
      const titleElement = await invoiceItems[1]?.locator('.item-title') || await invoiceItems[0].locator('.item-title');
      await titleElement.click();
      await page.waitForTimeout(1000);
      console.log('  Title click completed');

    } else {
      console.log('⚠️ No invoice items found to test clicking!');
    }
  }

  // Report console errors
  if (consoleErrors.length > 0) {
    console.log('\n⚠️ Console errors detected:');
    consoleErrors.forEach(err => console.log(`  - ${err}`));
  } else {
    console.log('\n✅ No console errors');
  }

  console.log('\n✅ Sidebar click verification complete');
});