const { test, expect } = require('@playwright/test');

// Helper function to login as master
async function loginAsMaster(page) {
    await page.goto('/');
    await page.fill('#email', 'rpasha@marinegroupbw.com');
    await page.fill('#password', process.env.MASTER_PASSWORD || 'test-password');
    await page.click('#loginBtn');
    await page.waitForURL('/master/dashboard');
}

test.describe('CSP Compliance and Invoice ID Validation', () => {
    test.beforeEach(async ({ page }) => {
        // Monitor for CSP violations
        page.on('console', msg => {
            if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
                console.error('CSP Violation detected:', msg.text());
            }
        });
    });
    
    test('should not trigger CSP violations when viewing invoice', async ({ page }) => {
        const cspViolations = [];
        
        // Capture CSP violations
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('Content Security Policy') || 
                text.includes('CSP') || 
                text.includes('Refused to execute inline')) {
                cspViolations.push(text);
            }
        });
        
        await loginAsMaster(page);
        
        // Click view button on first invoice
        const viewButtons = await page.locator('.btn-view').count();
        if (viewButtons > 0) {
            await page.click('.btn-view:first-child');
            
            // Wait for modal to appear
            await page.waitForSelector('#detailModal', { state: 'visible', timeout: 5000 });
            
            // Check for CSP violations
            expect(cspViolations).toHaveLength(0);
        }
    });
    
    test('should handle valid invoice ID format (inv_timestamp_random)', async ({ page }) => {
        await loginAsMaster(page);
        
        // Intercept API call to verify ID format is accepted
        let apiCalled = false;
        let invoiceId = null;
        
        await page.route('/api/master/invoices/*', async route => {
            apiCalled = true;
            invoiceId = route.request().url().split('/').pop();
            
            // Return valid response for valid ID format
            if (/^inv_\d{13}_[a-z0-9]{9}$/.test(invoiceId)) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: invoiceId,
                        status: 'saved',
                        vesselName: 'Test Vessel',
                        customerName: 'Test Customer',
                        total: 1000,
                        parsedData: {}
                    })
                });
            } else {
                await route.fulfill({
                    status: 400,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'Invalid invoice ID format',
                        expectedFormat: 'inv_<timestamp>_<random>'
                    })
                });
            }
        });
        
        // Simulate viewing invoice with valid format
        await page.evaluate(() => {
            window.masterDashboard.viewInvoice('inv_1756271771724_geg1fza0e');
        });
        
        // Wait for API call
        await page.waitForTimeout(1000);
        
        expect(apiCalled).toBeTruthy();
        expect(invoiceId).toBe('inv_1756271771724_geg1fza0e');
        
        // Should show invoice details, not error
        await expect(page.locator('.invoice-detail')).toBeVisible({ timeout: 5000 });
    });
    
    test('should show user-friendly error for invalid invoice ID format', async ({ page }) => {
        await loginAsMaster(page);
        
        // Try to view invoice with invalid ID
        await page.evaluate(() => {
            window.masterDashboard.viewInvoice('invalid-id-format');
        });
        
        // Should show error state with friendly message
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        
        const errorText = await page.locator('.error-state p').textContent();
        expect(errorText).toContain('invoice ID appears to be invalid');
        expect(errorText).not.toContain('JSON');
        expect(errorText).not.toContain('{"error"');
    });
    
    test('should handle UUID format for backward compatibility', async ({ page }) => {
        await loginAsMaster(page);
        
        // Intercept API call
        await page.route('/api/master/invoices/*', async route => {
            const id = route.request().url().split('/').pop();
            
            // Check if it's a UUID
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: id,
                        status: 'saved',
                        vesselName: 'Legacy Invoice',
                        customerName: 'Legacy Customer',
                        total: 2000,
                        parsedData: {}
                    })
                });
            } else {
                await route.abort('failed');
            }
        });
        
        // Try UUID format
        await page.evaluate(() => {
            window.masterDashboard.viewInvoice('123e4567-e89b-12d3-a456-426614174000');
        });
        
        // Should handle UUID format gracefully
        await expect(page.locator('.invoice-detail')).toBeVisible({ timeout: 5000 });
    });
    
    test('error modal buttons should work without CSP violations', async ({ page }) => {
        const cspViolations = [];
        
        page.on('console', msg => {
            if (msg.text().includes('CSP') || msg.text().includes('inline')) {
                cspViolations.push(msg.text());
            }
        });
        
        await loginAsMaster(page);
        
        // Trigger an error
        await page.route('/api/master/invoices/*', route => {
            route.abort('failed');
        });
        
        // Try to view an invoice (will fail)
        const viewButtons = await page.locator('.btn-view').count();
        if (viewButtons > 0) {
            await page.click('.btn-view:first-child');
        } else {
            // Directly trigger error
            await page.evaluate(() => {
                window.masterDashboard.viewInvoice('test-id');
            });
        }
        
        // Wait for error state
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        
        // Test Close button
        await page.click('#errorCloseBtn');
        await expect(page.locator('#detailModal')).not.toBeVisible();
        
        // No CSP violations should have occurred
        expect(cspViolations).toHaveLength(0);
    });
    
    test('should prevent XSS in error messages', async ({ page }) => {
        await loginAsMaster(page);
        
        // Intercept with XSS attempt in error message
        await page.route('/api/master/invoices/*', route => {
            route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: '<script>alert("XSS")</script>',
                    expectedFormat: 'inv_<timestamp>_<random>'
                })
            });
        });
        
        // Trigger the error
        await page.evaluate(() => {
            window.masterDashboard.viewInvoice('test-xss');
        });
        
        // Wait for error display
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        
        // Check that script tag is escaped
        const errorHtml = await page.locator('.error-state').innerHTML();
        expect(errorHtml).not.toContain('<script>');
        expect(errorHtml).not.toContain('alert(');
        
        // The text should be escaped
        const errorText = await page.locator('.error-state p').textContent();
        expect(errorText).toContain('script'); // The word should be there but escaped
    });
    
    test('should show different error messages for different HTTP status codes', async ({ page }) => {
        await loginAsMaster(page);
        
        const testCases = [
            { status: 400, expectedMessage: 'Invalid invoice ID format' },
            { status: 404, expectedMessage: 'could not be found' },
            { status: 403, expectedMessage: 'do not have permission' },
            { status: 500, expectedMessage: 'Server error' }
        ];
        
        for (const testCase of testCases) {
            // Set up route with specific status
            await page.route('/api/master/invoices/*', route => {
                route.fulfill({
                    status: testCase.status,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'Test error'
                    })
                });
            });
            
            // Trigger error
            await page.evaluate(() => {
                window.masterDashboard.viewInvoice('test-status-codes');
            });
            
            // Check error message
            await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
            const errorText = await page.locator('.error-state p').textContent();
            expect(errorText.toLowerCase()).toContain(testCase.expectedMessage.toLowerCase());
            
            // Close modal for next test
            const closeBtn = page.locator('#errorCloseBtn');
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
            }
        }
    });
    
    test('should validate invoice ID on client side before API call', async ({ page }) => {
        await loginAsMaster(page);
        
        let apiCalled = false;
        await page.route('/api/master/invoices/*', route => {
            apiCalled = true;
            route.abort();
        });
        
        // Try obviously invalid IDs
        const invalidIds = [
            '',
            null,
            'not-an-invoice-id',
            '123',
            'inv_short_id'
        ];
        
        for (const id of invalidIds) {
            apiCalled = false;
            
            await page.evaluate((testId) => {
                window.masterDashboard.viewInvoice(testId);
            }, id);
            
            await page.waitForTimeout(500);
            
            // API should not be called for obviously invalid IDs
            expect(apiCalled).toBeFalsy();
            
            // Should show error immediately
            await expect(page.locator('.error-state')).toBeVisible();
            
            // Close for next test
            const closeBtn = page.locator('#errorCloseBtn');
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
                await page.waitForTimeout(200);
            }
        }
    });
    
    test('Retry button should work and attempt to reload invoice', async ({ page }) => {
        await loginAsMaster(page);
        
        let attemptCount = 0;
        
        await page.route('/api/master/invoices/*', route => {
            attemptCount++;
            if (attemptCount === 1) {
                // First attempt fails
                route.abort('failed');
            } else {
                // Second attempt succeeds
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        id: 'inv_1756271771724_retry123',
                        status: 'saved',
                        vesselName: 'Retry Success',
                        customerName: 'Test Customer',
                        total: 1500,
                        parsedData: {}
                    })
                });
            }
        });
        
        // First attempt
        await page.evaluate(() => {
            window.masterDashboard.viewInvoice('inv_1756271771724_retry123');
        });
        
        // Should show error
        await expect(page.locator('.error-state')).toBeVisible({ timeout: 5000 });
        
        // Click retry
        await page.click('#errorRetryBtn');
        
        // Should now show invoice
        await expect(page.locator('.invoice-detail')).toBeVisible({ timeout: 5000 });
        expect(attemptCount).toBe(2);
    });
});