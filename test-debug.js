const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false, // Let me see what's happening
    executablePath: '/snap/bin/chromium',
    slowMo: 1000,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('🌐 Navigating to app...');
  await page.goto('https://mginvoices.com/app', { waitUntil: 'networkidle2' });
  
  // Take screenshot to see what we get
  await page.screenshot({ path: '/tmp/debug-login.png' });
  console.log('📸 Screenshot saved to /tmp/debug-login.png');
  
  // Wait a bit longer for auto-login
  console.log('⏳ Waiting for login...');
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: '/tmp/debug-after-wait.png' });
  console.log('📸 After wait screenshot saved');
  
  // Check what elements exist
  const userSection = await page.$('.user-section');
  const authSection = await page.$('.auth-section');
  
  console.log('🔍 User section found:', !!userSection);
  console.log('🔍 Auth section found:', !!authSection);
  
  if (userSection) {
    console.log('✅ Successfully logged in!');
    // Test comment persistence
    await testCommentPersistence(page);
  } else {
    console.log('❌ Not logged in, need to debug login flow');
  }
  
  await browser.close();
})();

async function testCommentPersistence(page) {
  console.log('🧪 Testing comment persistence...');
  
  // Look for dsadsa invoice
  await page.waitForSelector('.invoice-item');
  const invoiceItems = await page.$$('.invoice-item');
  
  let targetInvoice = null;
  for (let item of invoiceItems) {
    const titleElement = await item.$('.invoice-title');
    if (titleElement) {
      const title = await page.evaluate(el => el.textContent, titleElement);
      if (title.includes('dsadsa')) {
        targetInvoice = item;
        break;
      }
    }
  }
  
  if (!targetInvoice) {
    console.log('❌ Could not find dsadsa invoice');
    return;
  }
  
  console.log('✅ Found dsadsa invoice, clicking...');
  await targetInvoice.click();
  await page.waitForTimeout(2000);
  
  // Go to Notes tab
  console.log('📝 Clicking Notes tab...');
  await page.click('[data-tab="notes"]');
  await page.waitForTimeout(1000);
  
  // Add test comment
  const testComment = `PUPPETEER_TEST_${Date.now()}`;
  console.log(`💬 Adding comment: ${testComment}`);
  
  await page.click('#new-comment-text');
  await page.type('#new-comment-text', testComment);
  await page.click('#add-comment-btn');
  
  // Wait for comment to appear
  await page.waitForTimeout(3000);
  
  // Verify comment appears
  const commentElements = await page.$$('.comment-item');
  let commentFound = false;
  
  for (let comment of commentElements) {
    const textElement = await comment.$('.comment-text');
    if (textElement) {
      const text = await page.evaluate(el => el.textContent, textElement);
      if (text.includes(testComment)) {
        commentFound = true;
        break;
      }
    }
  }
  
  console.log(`💬 Comment found in UI: ${commentFound}`);
  
  if (commentFound) {
    console.log('🎉 Comment persistence test PASSED!');
  } else {
    console.log('❌ Comment persistence test FAILED!');
  }
}