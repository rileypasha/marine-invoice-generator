const puppeteer = require('puppeteer');

describe('Comment Persistence Tests', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new', // Use new headless mode
      executablePath: '/snap/bin/chromium',
      slowMo: 100,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('🔧 Browser launched, navigating to app...');
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('Comments persist after logout/login', async () => {
    console.log('🧪 Starting comment persistence test...');
    
    // Navigate to the app
    await page.goto('https://mginvoices.com/app', { waitUntil: 'networkidle2' });
    
    // Should auto-login as test user
    console.log('🔑 Waiting for auto-login...');
    await page.waitForSelector('.user-section', { timeout: 10000 });
    
    // Find and click on the "dsadsa" invoice
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
    
    // Wait for invoice to load
    await page.waitForTimeout(2000);
    
    // Navigate to Notes tab
    console.log('📝 Clicking Notes tab...');
    await page.click('[data-tab="notes"]');
    await page.waitForTimeout(1000);
    
    // Add a test comment
    const testComment = `TEST_PERSISTENCE_${Date.now()}`;
    console.log(`💬 Adding test comment: ${testComment}`);
    
    await page.click('#new-comment-text');
    await page.type('#new-comment-text', testComment);
    await page.click('#add-comment-btn');
    
    // Wait for comment to appear
    await page.waitForTimeout(2000);
    
    // Verify comment appears in UI
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
    
    if (!commentFound) {
      throw new Error('Comment not found in UI after adding');
    }
    
    console.log('✅ Comment appears in UI');
    
    // Logout
    console.log('🚪 Logging out...');
    await page.click('.user-section');
    await page.waitForSelector('#sign-out-btn', { timeout: 5000 });
    await page.click('#sign-out-btn');
    
    // Wait for redirect to landing page
    await page.waitForSelector('body', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    // Navigate back to app (should auto-login)
    console.log('🔄 Navigating back to app...');
    await page.goto('https://mginvoices.com/app', { waitUntil: 'networkidle2' });
    
    // Wait for auto-login
    await page.waitForSelector('.user-section', { timeout: 10000 });
    
    // Open dsadsa invoice again
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
    
    // Navigate to Notes tab
    await page.click('[data-tab="notes"]');
    await page.waitForTimeout(1000);
    
    // Check if comment still exists
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
    
    console.log(`💬 Comment found after reload: ${commentFoundAfterReload}`);
    
    // This should pass once we fix the issue
    expect(commentFoundAfterReload).toBe(true);
    
  }, 60000); // 60 second timeout
  
  test('Verify comment API endpoint works', async () => {
    console.log('🧪 Testing comment API endpoint...');
    
    // This test will make direct API calls to verify the backend works
    const response = await page.evaluate(async () => {
      try {
        // First get an invoice ID - use the dsadsa invoice
        const invoiceElements = document.querySelectorAll('.invoice-item');
        let invoiceId = null;
        
        for (let elem of invoiceElements) {
          const title = elem.querySelector('.invoice-title')?.textContent;
          if (title && title.includes('dsadsa')) {
            invoiceId = elem.dataset.id;
            break;
          }
        }
        
        if (!invoiceId) {
          return { error: 'No invoice ID found' };
        }
        
        // Make API call to add comment
        const response = await fetch(`/api/invoices/${invoiceId}/comment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            comment: 'API_TEST_COMMENT',
            author: 'Test User',
            authorEmail: 'test@marinegroup.com',
            timestamp: new Date().toISOString()
          })
        });
        
        return {
          status: response.status,
          ok: response.ok,
          data: await response.json()
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('📡 API Response:', response);
    
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
  }, 30000);
});