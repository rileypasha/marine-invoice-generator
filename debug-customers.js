/**
 * Debug customers page JavaScript loading
 */

const { chromium } = require('playwright');

async function debugCustomersPage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    console.log(`🔍 [${msg.type()}] ${msg.text()}`);
  });

  // Listen for errors
  page.on('pageerror', error => {
    console.error(`❌ Page Error: ${error.message}`);
  });

  // Listen for network failures
  page.on('requestfailed', request => {
    console.error(`🌐 Failed to load: ${request.url()}`);
  });

  try {
    console.log('🔍 Loading customers page...');
    await page.goto('https://mginvoices.com/customers', {
      waitUntil: 'networkidle'
    });

    // Wait a moment for JavaScript to execute
    await page.waitForTimeout(5000);

    // Check if the container exists
    const container = await page.$('#customers-page');
    console.log(`📦 Container #customers-page: ${container ? '✅ Found' : '❌ Missing'}`);

    // Check if our component was instantiated
    const customersPageInstance = await page.evaluate(() => {
      return window.customersPage ? 'Found' : 'Not found';
    });
    console.log(`🧩 window.customersPage: ${customersPageInstance}`);

    // Check CustomerManager
    const customerManager = await page.evaluate(() => {
      return window.CustomerManager ? 'Found' : 'Not found';
    });
    console.log(`🏗️ window.CustomerManager: ${customerManager}`);

    // Check what's actually in the customers-page container
    const containerContent = await page.evaluate(() => {
      const container = document.getElementById('customers-page');
      return container ? container.innerHTML : 'Container not found';
    });
    console.log(`📄 Container content: ${containerContent.substring(0, 200)}...`);

    // Check if main bundle loaded
    const bundleLoaded = await page.evaluate(() => {
      const scripts = Array.from(document.scripts);
      return scripts.some(script => script.src.includes('bundle'));
    });
    console.log(`📦 Bundle script loaded: ${bundleLoaded ? '✅ Yes' : '❌ No'}`);

    // Check page HTML structure
    const bodyClasses = await page.evaluate(() => document.body.className);
    console.log(`🏷️ Body classes: "${bodyClasses}"`);

    const pageTitle = await page.title();
    console.log(`📑 Page title: "${pageTitle}"`);

    // Take a screenshot for inspection
    await page.screenshot({ path: 'debug-customers.png', fullPage: true });
    console.log('📸 Debug screenshot saved');

  } catch (error) {
    console.error('❌ Debug error:', error.message);
  } finally {
    await browser.close();
  }
}

debugCustomersPage().catch(console.error);