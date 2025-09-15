const puppeteer = require('puppeteer');

(async () => {
  console.log('🧪 Starting comment persistence test...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Let me see what's happening
    executablePath: '/snap/bin/chromium',
    slowMo: 500,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    // Step 1: Navigate to landing page
    console.log('🌐 Navigating to landing page...');
    await page.goto('https://mginvoices.com/', { waitUntil: 'networkidle2' });
    
    // Step 2: Click "Access Invoice System"
    console.log('🔘 Clicking Access Invoice System...');
    const accessBtn = await page.waitForSelector('text=Access Invoice System', { timeout: 10000 });
    await accessBtn.click();
    
    // Step 3: Wait for app to load and auto-login
    console.log('⏳ Waiting for app to load and auto-login...');
    await page.waitForTimeout(5000);
    
    // Check if we're logged in
    const userSection = await page.$('.user-section');
    if (!userSection) {
      console.log('❌ Auto-login failed, trying manual login...');
      
      // Try to find and click sign in
      const signInBtn = await page.$('text=Sign In');
      if (signInBtn) {
        await signInBtn.click();
        await page.waitForTimeout(2000);
        
        // Fill in test credentials
        await page.type('input[type="email"]', 'test@marinegroupbw.com');
        await page.type('input[type="password"]', 'password34220');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      }
    }
    
    // Verify we're logged in
    await page.waitForSelector('.user-section', { timeout: 10000 });
    console.log('✅ Successfully logged in!');
    
    // Step 4: Find and open dsadsa invoice
    console.log('📄 Looking for dsadsa invoice...');
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
      throw new Error('Could not find dsadsa invoice');
    }
    
    console.log('✅ Found dsadsa invoice, clicking to open...');
    await targetInvoice.click();
    await page.waitForTimeout(2000);
    
    // Step 5: Navigate to Notes tab
    console.log('📝 Clicking Notes tab...');
    await page.click('[data-tab="notes"]');
    await page.waitForTimeout(1000);
    
    // Step 6: Add test comment
    const testComment = `PERSISTENCE_TEST_${Date.now()}`;
    console.log(`💬 Adding test comment: ${testComment}`);
    
    await page.click('#new-comment-text');
    await page.type('#new-comment-text', testComment);
    await page.click('#add-comment-btn');
    
    // Step 7: Wait for comment to appear
    console.log('⏳ Waiting for comment to appear...');
    await page.waitForTimeout(3000);
    
    // Step 8: Verify comment appears in UI
    const commentElements = await page.$$('.comment-item');
    let commentFoundInitially = false;
    
    for (let comment of commentElements) {
      const textElement = await comment.$('.comment-text');
      if (textElement) {
        const text = await page.evaluate(el => el.textContent, textElement);
        if (text.includes(testComment)) {
          commentFoundInitially = true;
          break;
        }
      }
    }
    
    if (!commentFoundInitially) {
      throw new Error('Comment not found in UI after adding');
    }
    
    console.log('✅ Comment appears in UI immediately');
    
    // Step 9: Logout
    console.log('🚪 Logging out...');
    await page.click('.user-section');
    await page.waitForSelector('#sign-out-btn', { timeout: 5000 });
    await page.click('#sign-out-btn');
    
    // Wait for redirect to landing page
    await page.waitForTimeout(5000);
    
    // Step 10: Login again
    console.log('🔄 Logging back in...');
    await page.click('text=Access Invoice System');
    await page.waitForTimeout(5000);
    
    // Should auto-login or may need manual login again
    const userSectionAfterRelogin = await page.$('.user-section');
    if (!userSectionAfterRelogin) {
      console.log('🔑 Manual login required...');
      const signInBtn = await page.$('text=Sign In');
      if (signInBtn) {
        await signInBtn.click();
        await page.waitForTimeout(2000);
        await page.type('input[type="email"]', 'test@marinegroupbw.com');
        await page.type('input[type="password"]', 'password34220');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
      }
    }
    
    await page.waitForSelector('.user-section', { timeout: 10000 });
    console.log('✅ Logged back in successfully');
    
    // Step 11: Open dsadsa invoice again
    console.log('📄 Opening dsadsa invoice again...');
    await page.waitForSelector('.invoice-item');
    
    const invoiceItems2 = await page.$$('.invoice-item');
    let targetInvoice2 = null;
    
    for (let item of invoiceItems2) {
      const titleElement = await item.$('.invoice-title');
      if (titleElement) {
        const title = await page.evaluate(el => el.textContent, titleElement);
        if (title.includes('dsadsa')) {
          targetInvoice2 = item;
          break;
        }
      }
    }
    
    if (!targetInvoice2) {
      throw new Error('Could not find dsadsa invoice after re-login');
    }
    
    await targetInvoice2.click();
    await page.waitForTimeout(2000);
    
    // Step 12: Navigate to Notes tab
    await page.click('[data-tab="notes"]');
    await page.waitForTimeout(1000);
    
    // Step 13: Check if comment still exists
    console.log(`🔍 Looking for comment: ${testComment}`);
    const commentElements2 = await page.$$('.comment-item');
    let commentFoundAfterReload = false;
    
    for (let comment of commentElements2) {
      const textElement = await comment.$('.comment-text');
      if (textElement) {
        const text = await page.evaluate(el => el.textContent, textElement);
        if (text.includes(testComment)) {
          commentFoundAfterReload = true;
          break;
        }
      }
    }
    
    console.log(`💬 Comment found after logout/login: ${commentFoundAfterReload}`);
    
    if (commentFoundAfterReload) {
      console.log('🎉 ✅ COMMENT PERSISTENCE TEST PASSED! 🎉');
      console.log('✅ Comments now persist across logout/login sessions!');
    } else {
      console.log('❌ ⚠️ COMMENT PERSISTENCE TEST FAILED! ⚠️');
      console.log('❌ Comments are still disappearing after logout/login');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  } finally {
    await browser.close();
  }
})();