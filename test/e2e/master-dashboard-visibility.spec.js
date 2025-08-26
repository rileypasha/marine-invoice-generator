/**
 * E2E Tests for Master Dashboard Invoice Visibility
 */

const { test, expect } = require('@playwright/test');

// Helper to generate unique test data
function generateTestData() {
  const timestamp = Date.now();
  return {
    customerName: `E2E Customer ${timestamp}`,
    vesselName: `E2E Vessel ${timestamp}`,
    invoiceNumber: `E2E-${timestamp}`,
    timestamp
  };
}

test.describe('Master Dashboard Invoice Visibility', () => {
  let userPage;
  let masterPage;
  let testData;
  
  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts - one for standard user, one for master
    const userContext = await browser.newContext();
    const masterContext = await browser.newContext();
    
    userPage = await userContext.newPage();
    masterPage = await masterContext.newPage();
    
    // Generate unique test data for this test
    testData = generateTestData();
  });
  
  test('Standard user save appears on Master Dashboard', async () => {
    // Step 1: Standard user logs in and saves invoice
    await userPage.goto('http://localhost:3000');
    
    // Login as standard user
    await userPage.fill('#email', 'standard@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    // Wait for app to load
    await userPage.waitForSelector('#customerName', { timeout: 5000 });
    
    // Fill invoice details
    await userPage.fill('#customerName', testData.customerName);
    await userPage.fill('#vesselName', testData.vesselName);
    await userPage.fill('#invoiceNumber', testData.invoiceNumber);
    
    // Add a line item
    await userPage.click('#addLineItem');
    await userPage.fill('.line-item-description', 'E2E Test Service');
    await userPage.fill('.line-item-quantity', '1');
    await userPage.fill('.line-item-price', '1000');
    
    // Save invoice
    await userPage.click('#saveInvoice');
    
    // Wait for success message
    await userPage.waitForSelector('.success-message', { timeout: 5000 });
    
    // Step 2: Master user logs in and checks dashboard
    await masterPage.goto('http://localhost:3000/master');
    
    // Login as master
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Wait for dashboard to load
    await masterPage.waitForSelector('.invoice-table', { timeout: 5000 });
    
    // Search for the invoice we just created
    await masterPage.fill('#searchInput', testData.invoiceNumber);
    await masterPage.press('#searchInput', 'Enter');
    
    // Wait for search results
    await masterPage.waitForTimeout(1000);
    
    // Verify invoice appears
    const invoiceRow = await masterPage.locator('tr', {
      has: masterPage.locator(`text="${testData.customerName}"`)
    });
    
    await expect(invoiceRow).toBeVisible();
    
    // Verify invoice details
    const invoiceNumber = await invoiceRow.locator('.invoice-number').textContent();
    expect(invoiceNumber).toBe(testData.invoiceNumber);
    
    const vesselName = await invoiceRow.locator('.vessel-name').textContent();
    expect(vesselName).toBe(testData.vesselName);
    
    const status = await invoiceRow.locator('.status-badge').textContent();
    expect(status).toBe('saved');
  });
  
  test('Real-time visibility - invoice appears without refresh', async () => {
    // Master logs in first and stays on dashboard
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    await masterPage.waitForSelector('.invoice-table');
    
    // Count current invoices
    const initialCount = await masterPage.locator('.invoice-row').count();
    
    // Standard user saves new invoice
    await userPage.goto('http://localhost:3000');
    await userPage.fill('#email', 'standard@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    await userPage.waitForSelector('#customerName');
    await userPage.fill('#customerName', testData.customerName);
    await userPage.fill('#invoiceNumber', testData.invoiceNumber);
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Master refreshes data (clicks refresh button or waits for auto-refresh)
    await masterPage.click('#refreshBtn');
    await masterPage.waitForTimeout(1000);
    
    // Verify new invoice appears
    const newCount = await masterPage.locator('.invoice-row').count();
    expect(newCount).toBe(initialCount + 1);
    
    // Find the new invoice
    const newInvoice = await masterPage.locator('tr', {
      has: masterPage.locator(`text="${testData.invoiceNumber}"`)
    });
    await expect(newInvoice).toBeVisible();
  });
  
  test('Updated invoice shows latest data on Master Dashboard', async () => {
    // User creates invoice
    await userPage.goto('http://localhost:3000');
    await userPage.fill('#email', 'standard@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    await userPage.fill('#customerName', 'Original Customer');
    await userPage.fill('#invoiceNumber', testData.invoiceNumber);
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // User updates invoice
    await userPage.fill('#customerName', 'Updated Customer');
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Master checks dashboard
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    await masterPage.fill('#searchInput', testData.invoiceNumber);
    await masterPage.press('#searchInput', 'Enter');
    await masterPage.waitForTimeout(1000);
    
    // Verify updated data appears
    const invoiceRow = await masterPage.locator('tr', {
      has: masterPage.locator(`text="${testData.invoiceNumber}"`)
    });
    
    const customerName = await invoiceRow.locator('.customer-name').textContent();
    expect(customerName).toBe('Updated Customer');
  });
  
  test('Deleted invoice removed from Master Dashboard', async () => {
    // Create invoice
    await userPage.goto('http://localhost:3000');
    await userPage.fill('#email', 'standard@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    await userPage.fill('#customerName', testData.customerName);
    await userPage.fill('#invoiceNumber', testData.invoiceNumber);
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Master verifies invoice exists
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    await masterPage.fill('#searchInput', testData.invoiceNumber);
    await masterPage.press('#searchInput', 'Enter');
    
    const invoiceBeforeDelete = await masterPage.locator('tr', {
      has: masterPage.locator(`text="${testData.invoiceNumber}"`)
    });
    await expect(invoiceBeforeDelete).toBeVisible();
    
    // User deletes invoice
    await userPage.click('.invoice-actions');
    await userPage.click('#deleteInvoice');
    await userPage.click('.confirm-delete');
    await userPage.waitForSelector('.delete-success');
    
    // Master refreshes and verifies deletion
    await masterPage.click('#refreshBtn');
    await masterPage.waitForTimeout(1000);
    
    const invoiceAfterDelete = await masterPage.locator('tr', {
      has: masterPage.locator(`text="${testData.invoiceNumber}"`)
    });
    await expect(invoiceAfterDelete).not.toBeVisible();
  });
  
  test('Multiple concurrent users - all invoices visible', async ({ browser }) => {
    // Create 3 user contexts
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();
    const user3Context = await browser.newContext();
    
    const user1 = await user1Context.newPage();
    const user2 = await user2Context.newPage();
    const user3 = await user3Context.newPage();
    
    // All users login and save invoices concurrently
    const saveInvoice = async (page, userData) => {
      await page.goto('http://localhost:3000');
      await page.fill('#email', userData.email);
      await page.fill('#password', 'password');
      await page.click('#loginBtn');
      
      await page.fill('#customerName', userData.customerName);
      await page.fill('#invoiceNumber', userData.invoiceNumber);
      await page.click('#saveInvoice');
      await page.waitForSelector('.success-message');
    };
    
    await Promise.all([
      saveInvoice(user1, {
        email: 'user1@example.com',
        customerName: `User1 ${testData.timestamp}`,
        invoiceNumber: `U1-${testData.timestamp}`
      }),
      saveInvoice(user2, {
        email: 'user2@example.com',
        customerName: `User2 ${testData.timestamp}`,
        invoiceNumber: `U2-${testData.timestamp}`
      }),
      saveInvoice(user3, {
        email: 'user3@example.com',
        customerName: `User3 ${testData.timestamp}`,
        invoiceNumber: `U3-${testData.timestamp}`
      })
    ]);
    
    // Master verifies all 3 invoices are visible
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Search for this test's timestamp to find all 3 invoices
    await masterPage.fill('#searchInput', testData.timestamp.toString());
    await masterPage.press('#searchInput', 'Enter');
    await masterPage.waitForTimeout(1000);
    
    // Verify all 3 invoices appear
    const invoices = await masterPage.locator('.invoice-row').count();
    expect(invoices).toBeGreaterThanOrEqual(3);
    
    // Verify specific invoices
    await expect(masterPage.locator(`text="U1-${testData.timestamp}"`)).toBeVisible();
    await expect(masterPage.locator(`text="U2-${testData.timestamp}"`)).toBeVisible();
    await expect(masterPage.locator(`text="U3-${testData.timestamp}"`)).toBeVisible();
  });
  
  test('Search and filter work correctly', async () => {
    // Create multiple invoices with different properties
    await userPage.goto('http://localhost:3000');
    await userPage.fill('#email', 'standard@example.com');
    await userPage.fill('#password', 'password');
    await userPage.click('#loginBtn');
    
    // Invoice 1: Saved status
    await userPage.fill('#customerName', `Saved ${testData.timestamp}`);
    await userPage.fill('#invoiceNumber', `SAV-${testData.timestamp}`);
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Invoice 2: Different customer
    await userPage.click('#newInvoice');
    await userPage.fill('#customerName', `Different ${testData.timestamp}`);
    await userPage.fill('#invoiceNumber', `DIF-${testData.timestamp}`);
    await userPage.click('#saveInvoice');
    await userPage.waitForSelector('.success-message');
    
    // Master tests search
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Search by customer name
    await masterPage.fill('#searchInput', `Saved ${testData.timestamp}`);
    await masterPage.press('#searchInput', 'Enter');
    await masterPage.waitForTimeout(1000);
    
    let results = await masterPage.locator('.invoice-row').count();
    expect(results).toBe(1);
    
    // Clear search and search by invoice number
    await masterPage.fill('#searchInput', '');
    await masterPage.fill('#searchInput', `DIF-${testData.timestamp}`);
    await masterPage.press('#searchInput', 'Enter');
    await masterPage.waitForTimeout(1000);
    
    results = await masterPage.locator('.invoice-row').count();
    expect(results).toBe(1);
  });
  
  test('Pagination handles large number of invoices', async () => {
    // This test would create many invoices and test pagination
    // Simplified version:
    
    await masterPage.goto('http://localhost:3000/master');
    await masterPage.fill('#email', 'rpasha@marinegroupbw.com');
    await masterPage.fill('#password', 'masterpassword');
    await masterPage.click('#loginBtn');
    
    // Check pagination controls exist
    await expect(masterPage.locator('.pagination')).toBeVisible();
    
    // If there are multiple pages, test navigation
    const nextButton = masterPage.locator('.pagination-next');
    if (await nextButton.isEnabled()) {
      await nextButton.click();
      await masterPage.waitForTimeout(500);
      
      // Verify different invoices are shown
      const pageNumber = await masterPage.locator('.current-page').textContent();
      expect(parseInt(pageNumber)).toBe(2);
    }
  });
  
  test('Master-only access is enforced', async () => {
    // Regular user tries to access master dashboard
    await userPage.goto('http://localhost:3000/master');
    
    // Should redirect to login or show access denied
    await expect(userPage).toHaveURL(/\/(login|403|$)/);
    
    // Try to access master API directly
    const response = await userPage.request.get('/api/master/invoices');
    expect(response.status()).toBe(403);
  });
});

test.describe('Performance and Load Tests', () => {
  test('Dashboard loads quickly with many invoices', async ({ page }) => {
    await page.goto('http://localhost:3000/master');
    await page.fill('#email', 'rpasha@marinegroupbw.com');
    await page.fill('#password', 'masterpassword');
    await page.click('#loginBtn');
    
    // Measure load time
    const startTime = Date.now();
    await page.waitForSelector('.invoice-table');
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Check that invoices are rendered
    const invoiceCount = await page.locator('.invoice-row').count();
    expect(invoiceCount).toBeGreaterThan(0);
  });
  
  test('Search responds quickly', async ({ page }) => {
    await page.goto('http://localhost:3000/master');
    await page.fill('#email', 'rpasha@marinegroupbw.com');
    await page.fill('#password', 'masterpassword');
    await page.click('#loginBtn');
    await page.waitForSelector('.invoice-table');
    
    // Measure search response time
    const startTime = Date.now();
    await page.fill('#searchInput', 'test');
    await page.press('#searchInput', 'Enter');
    await page.waitForSelector('.search-results', { timeout: 2000 });
    const searchTime = Date.now() - startTime;
    
    // Search should respond within 2 seconds
    expect(searchTime).toBeLessThan(2000);
  });
});