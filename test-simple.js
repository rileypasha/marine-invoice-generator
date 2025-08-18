const puppeteer = require('puppeteer');

async function testButton() {
  console.log('🚀 Starting browser test...');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[${type.toUpperCase()}] ${text}`);
  });
  
  // Listen for errors
  page.on('error', error => {
    console.error('❌ Page error:', error);
  });
  
  page.on('pageerror', error => {
    console.error('❌ Page error:', error);
  });
  
  try {
    console.log('📖 Loading page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    console.log('⏳ Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    // Check if sidebar exists
    const sidebarExists = await page.$('.app-sidebar');
    console.log('🔍 Sidebar exists:', !!sidebarExists);
    
    // Check if button exists
    const buttonExists = await page.$('.new-invoice-btn');
    console.log('🔍 Button exists:', !!buttonExists);
    
    if (buttonExists) {
      console.log('🔥 Clicking button...');
      await page.click('.new-invoice-btn');
      console.log('✅ Button clicked!');
      
      // Wait and check results
      await page.waitForTimeout(2000);
      console.log('📝 Checking if forms cleared...');
      
    } else {
      console.error('❌ Button not found!');
    }
    
    // Keep browser open for manual testing
    console.log('🔄 Browser staying open for manual testing...');
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('💀 Test failed:', error);
  }
  
  await browser.close();
}

testButton().catch(console.error);