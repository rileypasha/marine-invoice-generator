const { test, expect } = require('@playwright/test');

test('Check sidebar rendering and invoice list', async ({ page }) => {
  console.log('\n🔍 CHECKING SIDEBAR RENDERING ISSUES');

  // Navigate to the login page
  console.log('📍 Going to https://mginvoices.com/form-login');
  await page.goto('https://mginvoices.com/form-login', { waitUntil: 'networkidle' });

  // Login
  console.log('🔐 Logging in...');
  await page.fill('input[name="email"]', 'test@marinegroupbw.com');
  await page.fill('input[name="password"]', 'TempPassword123!');
  await page.click('button[type="submit"]');

  // Wait for app to load
  console.log('⏳ Waiting for app to load...');
  await page.waitForTimeout(5000);

  // Take a screenshot of the full page
  await page.screenshot({ path: 'test-results/sidebar-full-page.png', fullPage: true });

  // Check the sidebar element
  const sidebar = await page.locator('.sidebar').first();
  const sidebarVisible = await sidebar.isVisible();
  console.log('🎯 Sidebar visible:', sidebarVisible);

  if (sidebarVisible) {
    // Get all invoice list items
    const invoiceItems = await page.locator('#recent-list .invoice-item, #recent-list li, .invoice-list .invoice-item, .invoice-list li').all();

    console.log(`\n📋 Found ${invoiceItems.length} invoice items in sidebar`);

    // Analyze each item
    for (let i = 0; i < Math.min(invoiceItems.length, 10); i++) {
      const item = invoiceItems[i];
      const text = await item.textContent();
      const classList = await item.getAttribute('class');

      console.log(`  Item ${i + 1}:`);
      console.log(`    Text: "${text?.trim()}"`);
      console.log(`    Classes: ${classList}`);

      // Check for corrupted text
      if (text && (text.includes('tre') || text.length < 5)) {
        console.log(`    ⚠️ SUSPICIOUS: Text seems corrupted!`);
      }
    }

    // Get the HTML of the invoice list to see what's being rendered
    const invoiceListElement = await page.locator('#recent-list, .invoice-list').first();
    const invoiceListHTML = await invoiceListElement.innerHTML();

    console.log('\n📄 Invoice list HTML (first 500 chars):');
    console.log(invoiceListHTML.substring(0, 500));

    // Check for duplicate IDs or weird patterns
    const duplicateCheck = invoiceListHTML.match(/data-invoice-id="([^"]+)"/g);
    if (duplicateCheck) {
      const ids = duplicateCheck.map(match => match.replace(/data-invoice-id="([^"]+)"/, '$1'));
      const uniqueIds = [...new Set(ids)];

      console.log(`\n🔍 Invoice IDs found: ${ids.length}`);
      console.log(`   Unique IDs: ${uniqueIds.length}`);

      if (ids.length !== uniqueIds.length) {
        console.log('   ⚠️ DUPLICATE IDS DETECTED!');
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        console.log('   Duplicates:', duplicates);
      }
    }

    // Check localStorage for invoice data
    const localStorageData = await page.evaluate(() => {
      const invoices = localStorage.getItem('invoices');
      return invoices ? JSON.parse(invoices) : null;
    });

    if (localStorageData) {
      console.log(`\n💾 LocalStorage has ${Object.keys(localStorageData).length} invoices`);
      Object.entries(localStorageData).slice(0, 3).forEach(([id, invoice]) => {
        console.log(`  - ${id}: ${invoice.title || 'No title'}`);
      });
    }
  }

  console.log('\n✅ Sidebar analysis complete');
});