// Simple console check script
const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting browser...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true
  });
  
  const page = await browser.newPage();
  
  // Collect all console messages
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log(`[BROWSER] ${text}`);
    logs.push(text);
  });
  
  page.on('error', error => {
    console.error('[ERROR]', error);
  });
  
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]', error);
  });
  
  try {
    console.log('📖 Loading page...');
    await page.goto('http://localhost:3000', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000
    });
    
    console.log('⏳ Waiting 5 seconds...');
    await page.waitForTimeout(5000);
    
    // Check if elements exist
    const sidebarExists = await page.$('.app-sidebar');
    const buttonExists = await page.$('.new-invoice-btn');
    
    console.log('🔍 Final Results:');
    console.log('  - Sidebar exists:', !!sidebarExists);
    console.log('  - Button exists:', !!buttonExists);
    console.log('  - Total console messages:', logs.length);
    
    if (logs.length === 0) {
      console.log('❌ NO CONSOLE OUTPUT - JAVASCRIPT NOT RUNNING');
    }
    
  } catch (error) {
    console.error('💀 Failed:', error);
  }
  
  console.log('🔄 Keeping browser open...');
  // Keep open for manual inspection
  await page.waitForTimeout(30000);
  
  await browser.close();
})();