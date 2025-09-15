const puppeteer = require('puppeteer');

(async () => {
  console.log('🔑 Testing login flow...');
  
  const browser = await puppeteer.launch({ 
    headless: false, 
    executablePath: '/snap/bin/chromium',
    slowMo: 1000,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  try {
    console.log('🌐 Navigate to landing page...');
    await page.goto('https://mginvoices.com/', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: '/tmp/1-landing.png' });
    
    console.log('🔘 Click Access Invoice System...');
    await page.evaluate(() => {
      const button = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent && el.textContent.includes('Access Invoice System')
      );
      if (button) button.click();
    });
    
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/2-after-access-click.png' });
    console.log('📍 Current URL:', page.url());
    
    // Look for Sign In button in top right corner
    console.log('🔍 Looking for Sign In button...');
    const signInButton = await page.$eval('*', () => {
      const elements = Array.from(document.querySelectorAll('button, a'));
      return elements.find(el => el.textContent && el.textContent.trim() === 'Sign In');
    }).catch(() => null);
    
    if (signInButton) {
      console.log('✅ Found Sign In button with evaluate');
    } else {
      console.log('🔍 Trying alternative method...');
      // Try clicking the blue sign in button visible in screenshot
      await page.click('button:contains("Sign In")').catch(async () => {
        await page.evaluate(() => {
          const buttons = document.querySelectorAll('button');
          for (let btn of buttons) {
            if (btn.textContent.includes('Sign In')) {
              btn.click();
              return;
            }
          }
        });
      });
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/3-after-signin-click.png' });
    
    console.log('📝 Looking for login form...');
    
    // Wait for login form to appear
    try {
      await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
      console.log('✅ Found email input');
      
      const emailInput = await page.$('input[type="email"]') || await page.$('input[name="email"]');
      const passwordInput = await page.$('input[type="password"]') || await page.$('input[name="password"]');
      
      if (emailInput && passwordInput) {
        console.log('📧 Filling email...');
        await emailInput.click();
        await emailInput.type('test@marinegroupbw.com');
        
        console.log('🔒 Filling password...');
        await passwordInput.click();
        await passwordInput.type('password34220');
        
        await page.screenshot({ path: '/tmp/4-credentials-filled.png' });
        
        console.log('🚀 Clicking submit...');
        const submitButton = await page.$('button[type="submit"]') || 
                            await page.$('input[type="submit"]') ||
                            await page.$('button:contains("Login")') ||
                            await page.$('button:contains("Sign In")');
        
        if (submitButton) {
          await submitButton.click();
          console.log('✅ Submitted login form');
          
          await page.waitForTimeout(5000);
          await page.screenshot({ path: '/tmp/5-after-submit.png' });
          console.log('📍 URL after login:', page.url());
          
          // Check if we're now in the app
          const userSection = await page.$('.user-section');
          const invoiceItems = await page.$$('.invoice-item');
          
          console.log('👤 User section found:', !!userSection);
          console.log('📄 Invoice items found:', invoiceItems.length);
          
          if (userSection || invoiceItems.length > 0) {
            console.log('🎉 ✅ LOGIN SUCCESSFUL!');
            console.log('🎯 Ready to test comment persistence!');
          } else {
            console.log('❌ Login may have failed - no user section or invoices found');
          }
          
        } else {
          console.log('❌ Could not find submit button');
        }
      } else {
        console.log('❌ Could not find email/password inputs');
        console.log('Email input found:', !!emailInput);
        console.log('Password input found:', !!passwordInput);
      }
    } catch (error) {
      console.log('❌ Login form not found:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: '/tmp/error.png' });
  }
  
  console.log('⏳ Keeping browser open for 20 seconds...');
  await page.waitForTimeout(20000);
  
  await browser.close();
})();
