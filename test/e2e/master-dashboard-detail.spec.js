const { test, expect } = require('@playwright/test');

// Helper function to login and navigate
async function loginAndNavigateToDashboard(page) {
    await page.goto('/');
    await page.fill('#email', 'rpasha@marinegroupbw.com');
    await page.fill('#password', process.env.MASTER_PASSWORD || 'test-password');
    await page.click('#loginBtn');
    await page.waitForURL('/master/dashboard');
    await page.waitForSelector('[data-testid="invoice-table"], .invoice-table', { timeout: 10000 });
}

test.describe('Master Dashboard Invoice Detail View', () => {
    test.beforeEach(async ({ page }) => {
        // Set up any necessary test data or mocks
        console.log('Starting test:', test.info().title);
    });
    
    test('Happy path: View invoice details', async ({ page }) => {
        // Login and navigate
        await loginAndNavigateToDashboard(page);
        
        // Ensure there's at least one invoice in the table
        const viewButtons = await page.locator('.btn-view').count();
        if (viewButtons === 0) {
            console.log('No invoices found in table, skipping test');
            test.skip();
        }
        
        // Click first View button
        await page.click('.btn-view:first-child');
        
        // Assert detail modal visible with content
        await expect(page.locator('#detailModal')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="invoice-detail"]')).toBeVisible();
        
        // Verify key fields present
        await expect(page.locator('.detail-section:has-text("Invoice")')).toContainText(/Status/);
        await expect(page.locator('.detail-section:has-text("Vessel")')).toBeVisible();
        await expect(page.locator('.detail-section:has-text("Customer")')).toBeVisible();
        await expect(page.locator('.detail-section:has-text("Financials")')).toContainText(/Total/);
        
        // Check modal is properly styled
        const modal = page.locator('#detailModal');
        await expect(modal).toHaveCSS('display', 'block');
        await expect(modal).toHaveCSS('z-index', '10000');
        
        // Close modal
        await page.click('#closeModalBtn');
        await expect(modal).not.toBeVisible();
    });
    
    test('Loading state is shown immediately', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Intercept the API call to delay it
        await page.route('/api/master/invoices/*', async route => {
            await page.waitForTimeout(1000); // Delay to see loading state
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-123',
                    status: 'saved',
                    vesselName: 'Test Vessel',
                    customerName: 'Test Customer',
                    total: 1000,
                    parsedData: {}
                })
            });
        });
        
        // Click View button
        const viewButton = page.locator('.btn-view').first();
        await viewButton.click();
        
        // Should see loading state
        await expect(page.locator('.loading-state')).toBeVisible({ timeout: 500 });
        await expect(page.locator('.loading-state')).toContainText(/Loading invoice details/);
        
        // Eventually should show the content
        await expect(page.locator('.invoice-detail')).toBeVisible({ timeout: 2000 });
    });
    
    test('Error case: Network failure shows error state', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Intercept and fail the API call
        await page.route('/api/master/invoices/*', route => {
            route.abort('failed');
        });
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Should show error state
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.error-state')).toContainText(/Error/);
        await expect(page.locator('.error-state')).toContainText(/Failed to load/);
        
        // Retry button should be present
        await expect(page.locator('button:has-text("Retry")')).toBeVisible();
        await expect(page.locator('button:has-text("Close")')).toBeVisible();
    });
    
    test('Error case: 404 shows appropriate error', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Intercept and return 404
        await page.route('/api/master/invoices/*', route => {
            route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Invoice not found' })
            });
        });
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Should show error state with 404 message
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.error-state')).toContainText(/404/);
    });
    
    test('Error case: Empty response shows validation error', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Intercept and return empty object
        await page.route('/api/master/invoices/*', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({}) // Missing required fields
            });
        });
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Should show error for invalid data
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.error-state')).toContainText(/Invalid invoice data/);
    });
    
    test('Retry functionality works', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        let callCount = 0;
        
        // First call fails, second succeeds
        await page.route('/api/master/invoices/*', route => {
            callCount++;
            if (callCount === 1) {
                route.abort('failed');
            } else {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'test-123',
                        status: 'saved',
                        vesselName: 'Retry Success Vessel',
                        customerName: 'Retry Customer',
                        total: 1500,
                        parsedData: {}
                    })
                });
            }
        });
        
        // Click View button (first attempt fails)
        await page.click('.btn-view:first-child');
        
        // Should show error state
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        
        // Click Retry button
        await page.click('button:has-text("Retry")');
        
        // Should now show the invoice details
        await expect(page.locator('.invoice-detail')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.invoice-detail')).toContainText(/Retry Success Vessel/);
    });
    
    test('Modal has proper z-index and visibility', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Wait for modal
        const modal = page.locator('#detailModal');
        await expect(modal).toBeVisible({ timeout: 5000 });
        
        // Check CSS properties
        await expect(modal).toHaveCSS('position', 'fixed');
        await expect(modal).toHaveCSS('z-index', '10000');
        await expect(modal).toHaveCSS('display', 'block');
        await expect(modal).toHaveCSS('visibility', 'visible');
        
        // Check overlay
        const overlay = page.locator('.invoice-detail-overlay');
        await expect(overlay).toBeVisible();
        
        // Check panel
        const panel = page.locator('.invoice-detail-panel');
        await expect(panel).toBeVisible();
    });
    
    test('Console logs show debug information', async ({ page }) => {
        const consoleLogs = [];
        
        // Capture console logs
        page.on('console', msg => {
            if (msg.type() === 'log') {
                consoleLogs.push(msg.text());
            }
        });
        
        await loginAndNavigateToDashboard(page);
        
        // Setup successful response
        await page.route('/api/master/invoices/*', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-debug',
                    status: 'saved',
                    vesselName: 'Debug Vessel',
                    customerName: 'Debug Customer',
                    total: 2000,
                    parsedData: {}
                })
            });
        });
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Wait for modal
        await expect(page.locator('#detailModal')).toBeVisible({ timeout: 5000 });
        
        // Check that debug logs were generated
        const hasDebugLogs = consoleLogs.some(log => 
            log.includes('Fetching invoice details') || 
            log.includes('Response status') ||
            log.includes('Invoice data received') ||
            log.includes('Modal rendered successfully')
        );
        
        expect(hasDebugLogs).toBeTruthy();
    });
    
    test('Performance: Detail view loads within 2 seconds', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Setup normal response
        await page.route('/api/master/invoices/*', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-perf',
                    status: 'saved',
                    vesselName: 'Performance Test Vessel',
                    customerName: 'Performance Customer',
                    total: 3000,
                    parsedData: {
                        vessel: {},
                        customer: {},
                        scope: { lineItems: [] }
                    }
                })
            });
        });
        
        const startTime = Date.now();
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Wait for detail content
        await page.waitForSelector('[data-testid="invoice-detail"]:visible', { timeout: 2000 });
        
        const loadTime = Date.now() - startTime;
        console.log(`Detail view loaded in ${loadTime}ms`);
        
        expect(loadTime).toBeLessThan(2000);
    });
    
    test('Export CSV button is present in detail view', async ({ page }) => {
        await loginAndNavigateToDashboard(page);
        
        // Setup successful response
        await page.route('/api/master/invoices/*', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-export',
                    status: 'saved',
                    vesselName: 'Export Test Vessel',
                    customerName: 'Export Customer',
                    total: 4000,
                    parsedData: {}
                })
            });
        });
        
        // Click View button
        await page.click('.btn-view:first-child');
        
        // Wait for modal
        await expect(page.locator('#detailModal')).toBeVisible({ timeout: 5000 });
        
        // Check Export CSV button exists
        await expect(page.locator('#exportCsv')).toBeVisible();
        await expect(page.locator('#exportCsv')).toHaveText('Export CSV');
    });
});