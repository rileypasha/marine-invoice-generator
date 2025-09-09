const { chromium } = require('playwright');

async function testAuthenticationLoop() {
  console.log('🔍 Testing authentication loop on mginvoices.com...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down to observe the behavior
  });
  
  const context = await browser.newContext({
    // Clear cookies to start fresh
    storageState: undefined
  });
  
  const page = await context.newPage();
  
  // Track redirects and requests
  const requests = [];
  const redirects = [];
  
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/' || url.pathname === '/app' || url.pathname === '/api/auth/me') {
      requests.push({
        time: new Date().toISOString(),
        method: request.method(),
        path: url.pathname,
        url: request.url()
      });
      console.log(`➡️  ${request.method()} ${url.pathname}`);
    }
  });
  
  page.on('response', response => {
    if (response.status() >= 300 && response.status() < 400) {
      redirects.push({
        from: response.url(),
        status: response.status(),
        location: response.headers()['location']
      });
      console.log(`↪️  Redirect: ${response.status()} from ${new URL(response.url()).pathname}`);
    }
  });
  
  console.log('\n📍 Step 1: Navigate to mginvoices.com\n');
  
  try {
    // Set a timeout to catch infinite loops
    const navigationPromise = page.goto('https://mginvoices.com', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    // Wait for navigation or timeout
    await Promise.race([
      navigationPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Navigation timeout - possible infinite loop')), 10000)
      )
    ]);
    
    console.log('✅ Page loaded successfully');
    
  } catch (error) {
    console.log(`\n❌ Error detected: ${error.message}\n`);
    
    // Analyze the loop pattern
    console.log('📊 Request pattern analysis:');
    console.log('Total requests:', requests.length);
    
    // Find repeating patterns
    const pathCounts = {};
    requests.forEach(req => {
      pathCounts[req.path] = (pathCounts[req.path] || 0) + 1;
    });
    
    console.log('\nRequest counts by path:');
    Object.entries(pathCounts).forEach(([path, count]) => {
      console.log(`  ${path}: ${count} requests`);
    });
    
    // Show last 10 requests to identify the loop
    console.log('\nLast 10 requests:');
    requests.slice(-10).forEach(req => {
      console.log(`  ${req.time.split('T')[1]} - ${req.method} ${req.path}`);
    });
  }
  
  // Check current URL
  console.log(`\n📍 Current URL: ${page.url()}`);
  
  // Check for authentication state
  const cookies = await context.cookies();
  console.log(`\n🍪 Cookies found: ${cookies.length}`);
  cookies.forEach(cookie => {
    console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}... (domain: ${cookie.domain})`);
  });
  
  // Try to check the auth endpoint directly
  console.log('\n📍 Step 2: Check /api/auth/me directly\n');
  
  const authResponse = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      const text = await response.text();
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: text.substring(0, 200)
      };
    } catch (error) {
      return { error: error.message };
    }
  });
  
  console.log('Auth endpoint response:', authResponse);
  
  // Check what JavaScript is running
  console.log('\n📍 Step 3: Check JavaScript errors\n');
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Console error:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('❌ Page error:', error.message);
  });
  
  // Wait a bit to catch any errors
  await page.waitForTimeout(2000);
  
  await browser.close();
  
  console.log('\n✅ Test complete');
}

// Run the test
testAuthenticationLoop().catch(console.error);