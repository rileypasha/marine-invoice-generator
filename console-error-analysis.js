const { chromium } = require('playwright');
const fs = require('fs');

async function analyzeConsoleErrors() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // Arrays to store captured data
  const consoleMessages = [];
  const networkRequests = [];
  const networkResponses = [];
  const errors = [];

  // Capture console messages
  page.on('console', msg => {
    const timestamp = new Date().toISOString();
    consoleMessages.push({
      timestamp,
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    console.log(`[${timestamp}] CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  // Capture network requests
  page.on('request', request => {
    const timestamp = new Date().toISOString();
    networkRequests.push({
      timestamp,
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      resourceType: request.resourceType()
    });
    console.log(`[${timestamp}] REQUEST: ${request.method()} ${request.url()}`);
  });

  // Capture network responses
  page.on('response', response => {
    const timestamp = new Date().toISOString();
    networkResponses.push({
      timestamp,
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers()
    });
    if (response.status() >= 400) {
      console.log(`[${timestamp}] RESPONSE ERROR: ${response.status()} ${response.url()}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    const timestamp = new Date().toISOString();
    errors.push({
      timestamp,
      message: error.message,
      stack: error.stack
    });
    console.log(`[${timestamp}] PAGE ERROR: ${error.message}`);
  });

  console.log('=== PHASE 1: Initial Page Load ===');
  await page.goto('https://mginvoices.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Allow time for dynamic content

  console.log('=== PHASE 2: Login Flow ===');
  // Wait for login form to be visible
  try {
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Take screenshot before login
    await page.screenshot({ path: 'login-page.png', fullPage: true });

    // Fill login form (assuming standard email/password fields)
    const emailField = await page.$('input[type="email"], input[name="email"]');
    const passwordField = await page.$('input[type="password"], input[name="password"]');

    if (emailField && passwordField) {
      // You'll need to provide actual credentials here
      console.log('Login form found - manual login required');
      console.log('Waiting 30 seconds for manual login...');
      await page.waitForTimeout(30000);
    }
  } catch (error) {
    console.log('Login form not found or timed out:', error.message);
  }

  console.log('=== PHASE 3: Post-Login Analysis ===');
  // Wait for post-login page load
  await page.waitForTimeout(5000);

  // Check for specific error patterns
  console.log('=== PHASE 4: Sidebar Container Analysis ===');
  const sidebarContainer = await page.$('.sidebar-container, #sidebar-container, [class*="sidebar"]');
  if (!sidebarContainer) {
    console.log('ISSUE FOUND: Sidebar container not found');
  }

  console.log('=== PHASE 5: API Call Analysis ===');
  // Monitor for specific API calls
  const invoicesApiCall = networkResponses.find(response =>
    response.url.includes('/api/invoices/user')
  );
  if (invoicesApiCall && invoicesApiCall.status === 500) {
    console.log('ISSUE FOUND: 500 error on /api/invoices/user');
  }

  console.log('=== PHASE 6: Customers Tab Navigation ===');
  try {
    // Look for customers tab/link
    const customersTab = await page.$('a[href*="customers"], button:has-text("Customers"), [data-tab="customers"]');
    if (customersTab) {
      console.log('Clicking Customers tab...');
      await customersTab.click();
      await page.waitForTimeout(3000);
    } else {
      console.log('Customers tab not found');
    }
  } catch (error) {
    console.log('Error navigating to Customers tab:', error.message);
  }

  console.log('=== PHASE 7: Button Element Analysis ===');
  // Check for missing button elements
  const buttons = await page.$$('button');
  console.log(`Found ${buttons.length} button elements`);

  console.log('=== PHASE 8: Final Data Collection ===');
  await page.waitForTimeout(5000);

  // Take final screenshot
  await page.screenshot({ path: 'final-state.png', fullPage: true });

  // Compile comprehensive report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalConsoleMessages: consoleMessages.length,
      totalErrors: errors.length + consoleMessages.filter(m => m.type === 'error').length,
      totalWarnings: consoleMessages.filter(m => m.type === 'warning').length,
      failedNetworkRequests: networkResponses.filter(r => r.status >= 400).length
    },
    phases: {
      initialLoad: {
        consoleMessages: consoleMessages.filter(m =>
          new Date(m.timestamp) <= new Date(Date.now() - 35000)
        ),
        networkErrors: networkResponses.filter(r =>
          r.status >= 400 && new Date(r.timestamp) <= new Date(Date.now() - 35000)
        )
      },
      postLogin: {
        consoleMessages: consoleMessages.filter(m =>
          new Date(m.timestamp) > new Date(Date.now() - 35000)
        ),
        networkErrors: networkResponses.filter(r =>
          r.status >= 400 && new Date(r.timestamp) > new Date(Date.now() - 35000)
        )
      }
    },
    specificIssues: {
      sidebarContainerIssues: consoleMessages.filter(m =>
        m.text.toLowerCase().includes('sidebar') ||
        m.text.toLowerCase().includes('container')
      ),
      invoicesApiErrors: networkResponses.filter(r =>
        r.url.includes('/api/invoices') && r.status >= 400
      ),
      buttonElementErrors: consoleMessages.filter(m =>
        m.text.toLowerCase().includes('button') && m.type === 'error'
      ),
      markAsSavedIssues: consoleMessages.filter(m =>
        m.text.toLowerCase().includes('markassaved') ||
        m.text.toLowerCase().includes('mark as saved')
      )
    },
    allConsoleMessages: consoleMessages,
    allNetworkRequests: networkRequests,
    allNetworkResponses: networkResponses,
    allErrors: errors
  };

  // Save detailed report
  fs.writeFileSync('console-error-report.json', JSON.stringify(report, null, 2));

  // Create human-readable summary
  const summary = `
CONSOLE ERROR ANALYSIS REPORT
============================
Generated: ${report.timestamp}

SUMMARY STATISTICS:
- Total Console Messages: ${report.summary.totalConsoleMessages}
- Total Errors: ${report.summary.totalErrors}
- Total Warnings: ${report.summary.totalWarnings}
- Failed Network Requests: ${report.summary.failedNetworkRequests}

SPECIFIC ISSUES FOUND:

1. SIDEBAR CONTAINER ISSUES:
${report.specificIssues.sidebarContainerIssues.map(issue =>
  `   [${issue.timestamp}] ${issue.type.toUpperCase()}: ${issue.text}`
).join('\n') || '   No sidebar container issues detected'}

2. INVOICES API ERRORS:
${report.specificIssues.invoicesApiErrors.map(error =>
  `   [${error.timestamp}] ${error.status} ${error.statusText}: ${error.url}`
).join('\n') || '   No invoices API errors detected'}

3. BUTTON ELEMENT ERRORS:
${report.specificIssues.buttonElementErrors.map(error =>
  `   [${error.timestamp}] ${error.type.toUpperCase()}: ${error.text}`
).join('\n') || '   No button element errors detected'}

4. MARK AS SAVED ISSUES:
${report.specificIssues.markAsSavedIssues.map(issue =>
  `   [${issue.timestamp}] ${issue.type.toUpperCase()}: ${issue.text}`
).join('\n') || '   No markAsSaved issues detected'}

ALL CONSOLE ERRORS:
${consoleMessages.filter(m => m.type === 'error').map(error =>
  `[${error.timestamp}] ERROR: ${error.text} (${error.location?.url || 'unknown'}:${error.location?.lineNumber || '?'})`
).join('\n') || 'No console errors detected'}

ALL NETWORK ERRORS:
${networkResponses.filter(r => r.status >= 400).map(error =>
  `[${error.timestamp}] ${error.status} ${error.statusText}: ${error.url}`
).join('\n') || 'No network errors detected'}
`;

  fs.writeFileSync('console-error-summary.txt', summary);

  console.log('\n' + summary);
  console.log('\nDetailed JSON report saved to: console-error-report.json');
  console.log('Human-readable summary saved to: console-error-summary.txt');
  console.log('Screenshots saved: login-page.png, final-state.png');

  await browser.close();
}

// Run the analysis
console.log('Starting console error analysis...');
console.log('Note: Manual login may be required during the 30-second wait period');
analyzeConsoleErrors().catch(console.error);