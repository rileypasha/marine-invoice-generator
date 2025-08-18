const puppeteer = require('puppeteer');

(async () => {
  console.log('🔥 REAL TEST STARTING');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const page = await browser.newPage();
  
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    console.log(`[CONSOLE] ${text}`);
  });
  
  page.on('error', error => {
    errors.push(error.message);
    console.error(`[ERROR] ${error.message}`);
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.error(`[PAGE ERROR] ${error.message}`);
  });
  
  try {
    console.log('📖 Loading http://localhost:3000');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle0',
      timeout: 15000
    });
    
    console.log('⏳ Waiting 5 seconds for everything to load...');
    await page.waitForTimeout(5000);
    
    // Check what actually exists
    const sidebarExists = await page.$('.app-sidebar');
    const buttonExists = await page.$('.new-invoice-btn');
    const appExists = await page.evaluate(() => !!window.app);
    const testFunctionExists = await page.evaluate(() => !!window.testNewInvoiceButton);
    
    console.log('\n🔍 ACTUAL STATE CHECK:');
    console.log(`  Sidebar element exists: ${!!sidebarExists}`);
    console.log(`  New invoice button exists: ${!!buttonExists}`);
    console.log(`  window.app exists: ${appExists}`);
    console.log(`  window.testNewInvoiceButton exists: ${testFunctionExists}`);
    console.log(`  Total console messages: ${consoleMessages.length}`);
    console.log(`  Total errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errors.forEach((err, i) => console.log(`  ${i + 1}: ${err}`));
    }
    
    if (consoleMessages.length === 0) {
      console.log('\n💀 NO CONSOLE OUTPUT - JAVASCRIPT NOT RUNNING');
      
      // Check if bundle.js loads
      const response = await page.goto('http://localhost:3000/bundle.js');
      console.log(`Bundle.js status: ${response.status()}`);
      
    } else {
      console.log('\n📝 CONSOLE MESSAGES:');
      consoleMessages.slice(0, 10).forEach((msg, i) => {
        console.log(`  ${i + 1}: ${msg}`);
      });
      if (consoleMessages.length > 10) {
        console.log(`  ... and ${consoleMessages.length - 10} more`);
      }
    }
    
    // Try to fill a field and then click button
    if (buttonExists) {
      console.log('\n🧪 TESTING BUTTON FUNCTIONALITY:');
      
      // Fill vessel name field
      await page.type('#vessel-name', 'Test Vessel');
      console.log('✅ Filled vessel name with "Test Vessel"');
      
      // Check value
      const vesselValue = await page.$eval('#vessel-name', el => el.value);
      console.log(`Vessel field value: "${vesselValue}"`);
      
      // Click the button
      console.log('🔥 Clicking new invoice button...');
      await page.click('.new-invoice-btn');
      
      // Wait a moment
      await page.waitForTimeout(2000);
      
      // Check if field was cleared
      const vesselValueAfter = await page.$eval('#vessel-name', el => el.value);
      console.log(`Vessel field value after click: "${vesselValueAfter}"`);
      
      if (vesselValueAfter === '') {
        console.log('✅ BUTTON WORKS - Field was cleared!');
      } else {
        console.log('❌ BUTTON FAILED - Field was not cleared!');
      }
      
    } else {
      console.log('\n❌ CANNOT TEST - Button does not exist');
    }
    
  } catch (error) {
    console.error(`💀 Test failed: ${error.message}`);
  }
  
  console.log('\n🔄 Keeping browser open for 30 seconds for manual inspection...');
  await page.waitForTimeout(30000);
  
  await browser.close();
  console.log('🏁 Test complete');
})();