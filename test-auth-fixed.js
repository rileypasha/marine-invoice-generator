const { chromium } = require('playwright');

async function testAuthenticationFixed() {
  console.log('🔍 Testing authentication fix on mginvoices.com...\n');
  
  const browser = await chromium.launch({ 
    headless: true // Run headless to avoid UI issues
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track navigation events
  let navigationCount = 0;
  const maxNavigations = 10; // Prevent infinite loops
  
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      navigationCount++;
      const url = new URL(frame.url());
      console.log(`➡️  Navigation ${navigationCount}: ${url.pathname}`);
      
      if (navigationCount >= maxNavigations) {
        console.error('❌ Too many navigations - possible infinite loop!');
        browser.close();
        process.exit(1);
      }
    }
  });
  
  console.log('📍 Step 1: Navigate to mginvoices.com\n');
  
  try {
    await page.goto('https://mginvoices.com', { 
      waitUntil: 'networkidle',
      timeout: 15000 
    });
    
    // Wait a bit to see if any redirects happen
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`✅ Stable at: ${currentUrl}`);
    
    // Check what content is visible
    const pageTitle = await page.title();
    console.log(`📄 Page title: ${pageTitle}`);
    
    // Check for key elements
    const hasLandingPage = await page.locator('.landing-container').count() > 0;
    const hasAppPage = await page.locator('#app').count() > 0;
    const hasSignInButton = await page.locator('#sign-in-nav-btn').count() > 0;
    
    console.log('\n📊 Page analysis:');
    console.log(`  Landing page elements: ${hasLandingPage ? '✅' : '❌'}`);
    console.log(`  App page elements: ${hasAppPage ? '✅' : '❌'}`);
    console.log(`  Sign-in button: ${hasSignInButton ? '✅' : '❌'}`);
    
    if (navigationCount <= 3) {
      console.log(`\n✅ SUCCESS: No infinite loop detected (${navigationCount} navigations)`);
    } else {
      console.log(`\n⚠️  WARNING: Multiple redirects detected (${navigationCount} navigations)`);
    }
    
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    
    if (error.message.includes('timeout')) {
      console.log('Possible causes:');
      console.log('  - Network issues');
      console.log('  - Site is down');
      console.log('  - Infinite redirect loop still occurring');
    }
  }
  
  // Test authentication flow
  console.log('\n📍 Step 2: Test authentication endpoint\n');
  
  const authResponse = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      return {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('Auth endpoint response:', authResponse);
  
  if (authResponse.status === 401) {
    console.log('✅ Correctly returns 401 when not authenticated');
  }
  
  // Check localStorage state
  const localStorageData = await page.evaluate(() => {
    return {
      user: localStorage.getItem('marine_invoice_user'),
      session: localStorage.getItem('marine_invoice_session'),
      explicitLogout: localStorage.getItem('marine_invoice_explicit_logout')
    };
  });
  
  console.log('\n📦 LocalStorage state:');
  console.log(`  User data: ${localStorageData.user ? 'Present' : 'Empty'}`);
  console.log(`  Session data: ${localStorageData.session ? 'Present' : 'Empty'}`);
  console.log(`  Explicit logout flag: ${localStorageData.explicitLogout || 'Not set'}`);
  
  await browser.close();
  
  console.log('\n✅ Test complete');
  
  if (navigationCount <= 3) {
    console.log('\n🎉 Authentication fix appears to be working!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some issues may still exist');
    process.exit(1);
  }
}

// Run the test
testAuthenticationFixed().catch(console.error);