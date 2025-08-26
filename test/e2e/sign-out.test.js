const puppeteer = require('puppeteer');

describe('Sign Out Modal Integration', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Go to app
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Setup test user session
    await page.evaluate(() => {
      const testUser = {
        id: 'test_user_123',
        email: 'test@marinegroup.com',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      localStorage.setItem('marine_invoice_user', JSON.stringify(testUser));
      localStorage.setItem('marine_invoice_session', JSON.stringify({
        userId: testUser.id,
        timestamp: Date.now(),
        rememberMe: true
      }));
    });
    
    // Reload to apply session
    await page.reload({ waitUntil: 'networkidle0' });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    // Ensure we're on the main page
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  });

  test('should show custom modal instead of browser confirm', async () => {
    // Mock window.confirm to track if it's called
    await page.evaluateOnNewDocument(() => {
      window.confirmCalled = false;
      const originalConfirm = window.confirm;
      window.confirm = () => {
        window.confirmCalled = true;
        return originalConfirm.apply(this, arguments);
      };
    });
    
    // Open settings modal
    await page.click('.settings-btn');
    await page.waitForSelector('.settings-modal', { visible: true });
    
    // Click sign out button
    await page.click('.sign-out-btn');
    
    // Wait for custom modal to appear
    await page.waitForSelector('.prompt-modal-overlay', { visible: true });
    
    // Verify browser confirm was not called
    const confirmCalled = await page.evaluate(() => window.confirmCalled);
    expect(confirmCalled).toBe(false);
    
    // Verify modal content
    const modalTitle = await page.$eval('.prompt-modal-title', el => el.textContent);
    const modalMessage = await page.$eval('.prompt-modal-message', el => el.textContent);
    
    expect(modalTitle).toBe('Sign Out');
    expect(modalMessage).toBe('Are you sure you want to sign out?');
    
    // Verify custom button text
    const confirmBtnText = await page.$eval('.prompt-modal-confirm', el => el.textContent);
    const cancelBtnText = await page.$eval('.prompt-modal-cancel', el => el.textContent);
    
    expect(confirmBtnText).toBe('Yes, Sign Out');
    expect(cancelBtnText).toBe('Cancel');
  });

  test('should sign out on confirm', async () => {
    // Open settings modal
    await page.click('.settings-btn');
    await page.waitForSelector('.settings-modal', { visible: true });
    
    // Click sign out button
    await page.click('.sign-out-btn');
    await page.waitForSelector('.prompt-modal-overlay', { visible: true });
    
    // Click confirm button
    await page.click('.prompt-modal-confirm');
    
    // Wait for modal to close
    await page.waitForSelector('.prompt-modal-overlay', { hidden: true });
    await page.waitForSelector('.settings-modal', { hidden: true });
    
    // Verify user is logged out
    const session = await page.evaluate(() => {
      return localStorage.getItem('marine_invoice_session');
    });
    
    expect(session).toBeNull();
    
    // Verify auth modal appears (user needs to sign in again)
    await page.waitForSelector('.auth-modal', { visible: true, timeout: 5000 });
  });

  test('should cancel sign out on cancel button click', async () => {
    // Setup session again
    await page.evaluate(() => {
      const testUser = {
        id: 'test_user_123',
        email: 'test@marinegroup.com',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      localStorage.setItem('marine_invoice_user', JSON.stringify(testUser));
      localStorage.setItem('marine_invoice_session', JSON.stringify({
        userId: testUser.id,
        timestamp: Date.now(),
        rememberMe: true
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle0' });
    
    // Open settings modal
    await page.click('.settings-btn');
    await page.waitForSelector('.settings-modal', { visible: true });
    
    // Click sign out button
    await page.click('.sign-out-btn');
    await page.waitForSelector('.prompt-modal-overlay', { visible: true });
    
    // Click cancel button
    await page.click('.prompt-modal-cancel');
    
    // Wait for prompt modal to close
    await page.waitForSelector('.prompt-modal-overlay', { hidden: true });
    
    // Verify settings modal is still open
    const settingsModalVisible = await page.evaluate(() => {
      const modal = document.querySelector('.settings-modal');
      return modal && window.getComputedStyle(modal).display !== 'none';
    });
    expect(settingsModalVisible).toBe(true);
    
    // Verify user is still logged in
    const session = await page.evaluate(() => {
      return localStorage.getItem('marine_invoice_session');
    });
    expect(session).not.toBeNull();
  });

  test('should cancel sign out on Escape key', async () => {
    // Setup session
    await page.evaluate(() => {
      const testUser = {
        id: 'test_user_123',
        email: 'test@marinegroup.com',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      localStorage.setItem('marine_invoice_user', JSON.stringify(testUser));
      localStorage.setItem('marine_invoice_session', JSON.stringify({
        userId: testUser.id,
        timestamp: Date.now(),
        rememberMe: true
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle0' });
    
    // Open settings modal
    await page.click('.settings-btn');
    await page.waitForSelector('.settings-modal', { visible: true });
    
    // Click sign out button
    await page.click('.sign-out-btn');
    await page.waitForSelector('.prompt-modal-overlay', { visible: true });
    
    // Press Escape key
    await page.keyboard.press('Escape');
    
    // Wait for prompt modal to close
    await page.waitForSelector('.prompt-modal-overlay', { hidden: true });
    
    // Verify user is still logged in
    const session = await page.evaluate(() => {
      return localStorage.getItem('marine_invoice_session');
    });
    expect(session).not.toBeNull();
  });

  test('should cancel sign out on click outside', async () => {
    // Setup session
    await page.evaluate(() => {
      const testUser = {
        id: 'test_user_123',
        email: 'test@marinegroup.com',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      localStorage.setItem('marine_invoice_user', JSON.stringify(testUser));
      localStorage.setItem('marine_invoice_session', JSON.stringify({
        userId: testUser.id,
        timestamp: Date.now(),
        rememberMe: true
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle0' });
    
    // Open settings modal
    await page.click('.settings-btn');
    await page.waitForSelector('.settings-modal', { visible: true });
    
    // Click sign out button
    await page.click('.sign-out-btn');
    await page.waitForSelector('.prompt-modal-overlay', { visible: true });
    
    // Click outside the modal (on overlay)
    await page.evaluate(() => {
      const overlay = document.querySelector('.prompt-modal-overlay');
      overlay.click();
    });
    
    // Wait for prompt modal to close
    await page.waitForSelector('.prompt-modal-overlay', { hidden: true });
    
    // Verify user is still logged in
    const session = await page.evaluate(() => {
      return localStorage.getItem('marine_invoice_session');
    });
    expect(session).not.toBeNull();
  });
});

describe('Regression Tests - Unsaved Changes Modal', () => {
  let browser;
  let page;
  
  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  test('should still show unsaved changes warning', async () => {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Setup user session
    await page.evaluate(() => {
      const testUser = {
        id: 'test_user_123',
        email: 'test@marinegroup.com',
        name: 'Test User',
        preferences: {
          theme: 'dark',
          autoSave: true
        }
      };
      
      localStorage.setItem('marine_invoice_user', JSON.stringify(testUser));
      localStorage.setItem('marine_invoice_session', JSON.stringify({
        userId: testUser.id,
        timestamp: Date.now(),
        rememberMe: true
      }));
    });
    
    await page.reload({ waitUntil: 'networkidle0' });
    
    // Make changes to invoice
    const vesselNameInput = await page.$('#vessel-name');
    if (vesselNameInput) {
      await page.type('#vessel-name', 'Test Vessel');
    }
    
    // Try to create new invoice
    const newInvoiceBtn = await page.$('.new-invoice-btn');
    if (newInvoiceBtn) {
      await newInvoiceBtn.click();
      
      // Wait for a modal to appear
      await page.waitForSelector('[class*="modal"]', { visible: true, timeout: 3000 });
      
      // Check modal content to ensure it's about unsaved changes
      const modalText = await page.evaluate(() => {
        const modals = document.querySelectorAll('[class*="modal"]');
        for (const modal of modals) {
          const text = modal.textContent;
          if (text && text.toLowerCase().includes('unsaved')) {
            return text;
          }
        }
        return '';
      });
      
      expect(modalText.toLowerCase()).toContain('unsaved');
    }
  });
});