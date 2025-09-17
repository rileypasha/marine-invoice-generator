const { test, expect } = require('@playwright/test');

test('Direct check of sidebar on main app page', async ({ page }) => {
  console.log('\n🔍 DIRECT SIDEBAR CHECK ON MAIN APP');

  // Go directly to the app page
  console.log('📍 Going directly to https://mginvoices.com/app');
  await page.goto('https://mginvoices.com/app', { waitUntil: 'networkidle' });

  // Wait a bit for page to load
  await page.waitForTimeout(3000);

  // Check current URL (might redirect to login)
  const currentUrl = page.url();
  console.log('📍 Current URL:', currentUrl);

  // If not logged in, do the login
  if (currentUrl.includes('login') || currentUrl === 'https://mginvoices.com/') {
    console.log('🔐 Need to login first...');

    // Check for login modal
    const loginModal = await page.locator('#loginModal').isVisible().catch(() => false);

    if (loginModal) {
      console.log('  Found login modal, filling credentials...');
      await page.fill('#loginEmail', 'test@marinegroupbw.com');
      await page.fill('#loginPassword', 'TempPassword123!');
      await page.click('#loginBtn');
    } else {
      // Try the auth section on main page
      const authSection = await page.locator('.auth-section').isVisible().catch(() => false);
      if (authSection) {
        console.log('  Found auth section, filling credentials...');
        const emailInput = await page.locator('input[type="email"], input[placeholder*="email"]').first();
        const passwordInput = await page.locator('input[type="password"]').first();
        await emailInput.fill('test@marinegroupbw.com');
        await passwordInput.fill('TempPassword123!');

        const loginBtn = await page.locator('button:has-text("Login"), button[type="submit"]').first();
        await loginBtn.click();
      }
    }

    console.log('  Waiting for login to complete...');
    await page.waitForTimeout(5000);
  }

  // Now check the sidebar
  console.log('\n🎯 Checking sidebar...');

  // Take screenshot
  await page.screenshot({ path: 'test-results/app-page-with-sidebar.png', fullPage: true });

  // Check various sidebar selectors
  const sidebarSelectors = ['.sidebar', '#sidebar', '[class*="sidebar"]', 'aside'];
  let sidebarFound = false;

  for (const selector of sidebarSelectors) {
    const elements = await page.locator(selector).all();
    if (elements.length > 0) {
      console.log(`  Found ${elements.length} elements with selector: ${selector}`);
      sidebarFound = true;

      for (let i = 0; i < Math.min(elements.length, 2); i++) {
        const elem = elements[i];
        const visible = await elem.isVisible();
        const classList = await elem.getAttribute('class');
        console.log(`    Element ${i + 1}: visible=${visible}, class="${classList}"`);

        if (visible) {
          // Get the text content
          const text = await elem.textContent();
          console.log(`    Text preview (first 200 chars): "${text?.substring(0, 200)}"`);

          // Look for invoice items
          const invoiceItems = await elem.locator('li, .invoice-item, [class*="invoice"]').all();
          console.log(`    Contains ${invoiceItems.length} invoice-related items`);

          if (invoiceItems.length > 0) {
            console.log('\n    📋 First 5 invoice items:');
            for (let j = 0; j < Math.min(invoiceItems.length, 5); j++) {
              const itemText = await invoiceItems[j].textContent();
              console.log(`      ${j + 1}. "${itemText?.trim()}"`);
            }
          }
        }
      }
    }
  }

  if (!sidebarFound) {
    console.log('  ⚠️ No sidebar elements found!');
  }

  // Check the page structure
  console.log('\n📄 Page structure check:');
  const mainContent = await page.locator('main, .main, #app, .app-container').first();
  if (await mainContent.count() > 0) {
    const mainClass = await mainContent.getAttribute('class');
    console.log(`  Main content area found with class: ${mainClass}`);
  }

  // Check if there's any invoice data in the DOM
  const invoiceElements = await page.locator('[class*="invoice"], [id*="invoice"]').all();
  console.log(`  Total elements with "invoice" in class/id: ${invoiceElements.length}`);

  console.log('\n✅ Direct sidebar check complete');
});