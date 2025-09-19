/**
 * Manual verification of Customers page alignment with mock
 */

const { chromium } = require('playwright');

async function verifyCustomersPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  try {
    console.log('🔍 Navigating to production site...');
    await page.goto('https://mginvoices.com/customers', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Take a screenshot for manual inspection
    await page.screenshot({
      path: 'customers-page-current.png',
      fullPage: true
    });

    console.log('📸 Screenshot saved as customers-page-current.png');

    // Check if we need to log in
    const loginForm = page.locator('form[id*="login"], form[class*="login"], input[type="email"]');
    if (await loginForm.isVisible()) {
      console.log('🔑 Login form detected, need authentication');
    } else {
      console.log('✅ Page loaded without login requirement');
    }

    // Check for key elements
    const container = page.locator('.mx-auto.max-w-screen-2xl.p-6');
    const containerExists = await container.count() > 0;
    console.log(`📦 Container with mock classes: ${containerExists ? '✅ Found' : '❌ Missing'}`);

    const title = page.locator('h2:has-text("Customers")');
    const titleExists = await title.count() > 0;
    console.log(`🏷️ "Customers" title: ${titleExists ? '✅ Found' : '❌ Missing'}`);

    const searchInput = page.locator('input[placeholder*="Search customers"]');
    const searchExists = await searchInput.count() > 0;
    console.log(`🔍 Search input: ${searchExists ? '✅ Found' : '❌ Missing'}`);

    const newCustomerBtn = page.locator('button:has-text("New Customer")');
    const btnExists = await newCustomerBtn.count() > 0;
    console.log(`➕ New Customer button: ${btnExists ? '✅ Found' : '❌ Missing'}`);

    const table = page.locator('table.w-full.text-sm');
    const tableExists = await table.count() > 0;
    console.log(`📊 Table with mock classes: ${tableExists ? '✅ Found' : '❌ Missing'}`);

    // Check what's actually on the page
    const pageTitle = await page.title();
    console.log(`📄 Page title: "${pageTitle}"`);

    const mainContent = await page.locator('body').innerHTML();
    const hasCustomersText = mainContent.includes('Customers') || mainContent.includes('customers');
    console.log(`📝 Contains "customers" text: ${hasCustomersText ? '✅ Yes' : '❌ No'}`);

    // Check for error messages
    const errorElements = page.locator('.error, .alert-danger, [class*="error"]');
    const errorCount = await errorElements.count();
    if (errorCount > 0) {
      console.log(`⚠️ Found ${errorCount} error elements on page`);
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const errorText = await errorElements.nth(i).textContent();
        console.log(`   Error ${i + 1}: ${errorText?.trim()}`);
      }
    }

    console.log('\n🎯 Summary:');
    console.log('   - Page loaded successfully');
    console.log('   - Screenshot captured for manual inspection');
    if (containerExists && titleExists && searchExists && btnExists && tableExists) {
      console.log('   - ✅ All key mock elements appear to be present!');
    } else {
      console.log('   - ❌ Some mock elements are missing, needs investigation');
    }

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    await page.screenshot({ path: 'customers-page-error.png' });
    console.log('📸 Error screenshot saved as customers-page-error.png');
  } finally {
    await browser.close();
  }
}

verifyCustomersPage().catch(console.error);