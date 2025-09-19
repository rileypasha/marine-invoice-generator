/**
 * Verify customers page with authentication
 */

const { chromium } = require('playwright');

async function verifyWithLogin() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ [${msg.type()}] ${msg.text()}`);
    } else if (msg.text().includes('PHASE') || msg.text().includes('Customer')) {
      console.log(`🔍 [${msg.type()}] ${msg.text()}`);
    }
  });

  try {
    console.log('🔍 Loading home page for authentication...');
    await page.goto('https://mginvoices.com/', {
      waitUntil: 'networkidle'
    });

    // Check if login form is present
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button[type="submit"]');

    if (await emailInput.isVisible()) {
      console.log('🔑 Login form found, attempting login...');

      // Use the test credentials from the console log
      await emailInput.fill('test@marinegroup.com');
      await passwordInput.fill('password123');
      await loginButton.click();

      // Wait for authentication to complete
      await page.waitForTimeout(3000);

      console.log('✅ Login attempted, checking for success...');
    }

    // Now try to navigate to customers page
    console.log('🔍 Navigating to customers page...');
    await page.goto('https://mginvoices.com/customers', {
      waitUntil: 'networkidle'
    });

    await page.waitForTimeout(5000);

    // Check the page title
    const pageTitle = await page.title();
    console.log(`📑 Page title: "${pageTitle}"`);

    // Check if we're authenticated by looking for our container
    const container = await page.$('#customers-page');
    console.log(`📦 Container #customers-page: ${container ? '✅ Found' : '❌ Missing'}`);

    // Check what's in the container
    if (container) {
      const containerContent = await page.evaluate(() => {
        const container = document.getElementById('customers-page');
        return container ? container.innerHTML : '';
      });
      console.log(`📄 Container has content: ${containerContent.length > 100 ? '✅ Yes' : '❌ No'}`);

      // Check for our mock elements
      const mockContainer = await page.$('.mx-auto.max-w-screen-2xl.p-6');
      console.log(`🎯 Mock container: ${mockContainer ? '✅ Found' : '❌ Missing'}`);

      const customersTitle = await page.$('h2:has-text("Customers")');
      console.log(`🏷️ "Customers" title: ${customersTitle ? '✅ Found' : '❌ Missing'}`);

      const searchInput = await page.$('input[placeholder*="Search customers"]');
      console.log(`🔍 Search input: ${searchInput ? '✅ Found' : '❌ Missing'}`);

      const newCustomerBtn = await page.$('button:has-text("New Customer")');
      console.log(`➕ New Customer button: ${newCustomerBtn ? '✅ Found' : '❌ Missing'}`);
    }

    // Check for JavaScript initialization
    const customersPageInstance = await page.evaluate(() => {
      return window.customersPage ? 'Found' : 'Not found';
    });
    console.log(`🧩 window.customersPage: ${customersPageInstance}`);

    // Take a screenshot
    await page.screenshot({ path: 'customers-authenticated.png', fullPage: true });
    console.log('📸 Screenshot saved as customers-authenticated.png');

    // Check for CSS loading issues
    const cssLoaded = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map(link => ({
        href: link.href,
        loaded: link.sheet !== null
      }));
    });

    console.log('\n🎨 CSS Loading Status:');
    cssLoaded.forEach(css => {
      console.log(`   ${css.loaded ? '✅' : '❌'} ${css.href}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'error-authenticated.png' });
  } finally {
    await browser.close();
  }
}

verifyWithLogin().catch(console.error);