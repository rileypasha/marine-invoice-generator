const { test, expect } = require('@playwright/test');

test.describe('Debug Invoice Calculations', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console capturing
    const logs = [];
    page.on('console', msg => {
      logs.push(`${msg.type()}: ${msg.text()}`);
      console.log(`Browser ${msg.type()}: ${msg.text()}`);
    });
    page.logs = logs;

    // Navigate to login page
    await page.goto('http://localhost:3001/login');

    // Login with provided credentials
    await page.fill('#email', 'test@marinegroupbw.com');
    await page.fill('#password', 'TempPassword123!');
    await page.click('button[type="submit"]');

    // Wait for navigation to app
    await page.waitForURL('**/app**');
  });

  test('should debug invoice calculation data structure', async ({ page }) => {
    // Navigate to the app first to load the invoice list
    await page.goto('http://localhost:3001/app');
    await page.waitForTimeout(2000);

    // Look for any existing invoice IDs in localStorage
    const invoiceIds = await page.evaluate(() => {
      try {
        const invoices = window.app?.invoiceStorage?.getAllInvoices() || [];
        console.log('🔍 Found invoices:', invoices);
        return invoices.map(inv => ({ id: inv.id, title: inv.title }));
      } catch (error) {
        console.error('Error getting invoices:', error);
        return [];
      }
    });

    console.log('Available invoices:', invoiceIds);

    if (invoiceIds.length > 0) {
      // Use the first available invoice
      const firstInvoice = invoiceIds[0];
      console.log(`Testing with invoice: ${firstInvoice.id} - ${firstInvoice.title}`);

      // Navigate to view mode for this invoice
      await page.goto(`http://localhost:3001/app?view=true&invoice=${firstInvoice.id}`);
      await page.waitForTimeout(3000);

      // Wait for React to render
      await page.waitForSelector('.invoice-preview, [data-testid="invoice-preview"], .card', { timeout: 10000 });

      // Let the debug logs accumulate
      await page.waitForTimeout(2000);

      console.log('=== All Browser Console Logs ===');
      page.logs.forEach(log => console.log(log));

      // Check if we can see the invoice content
      const hasInvoiceContent = await page.locator('text="MARINE SERVICES INVOICE"').isVisible();
      const hasEmptyMessage = await page.locator('text="Fill out the vessel information"').isVisible();

      console.log('Invoice content visible:', hasInvoiceContent);
      console.log('Empty message visible:', hasEmptyMessage);

    } else {
      console.log('No invoices found, creating a test invoice in localStorage');

      // Create a test invoice directly in localStorage
      await page.evaluate(() => {
        const testInvoice = {
          id: 'debug-test-invoice',
          title: 'Debug Test Invoice',
          userEmail: 'test@marinegroupbw.com',
          vessel: {
            name: 'Debug Vessel',
            weight: '100',
            beam: '25'
          },
          customer: {
            customerName: 'Debug Customer',
            customerEmail: 'debug@test.com',
            customerPhone: '555-1234',
            customerAddress: '123 Test St'
          },
          scope: {
            lineItems: [
              {
                id: 'item1',
                jobType: 'Manual Entry',
                itemType: 'Service',
                description: 'Debug Service Item',
                manualCost: '500',
                markupRate: '25',
                taxStatus: 'taxable',
                taxRate: 0.0875
              },
              {
                id: 'item2',
                jobType: 'Agent Services',
                itemType: 'Labor',
                description: 'Debug Labor Item',
                laborHours: '4',
                otHours: '2',
                markupRate: '0',
                taxStatus: 'taxable',
                taxRate: 0.0875
              }
            ]
          }
        };

        // Save to localStorage using the InvoiceStorage format
        try {
          const existingInvoices = JSON.parse(localStorage.getItem('marine_invoices') || '[]');
          existingInvoices.push(testInvoice);
          localStorage.setItem('marine_invoices', JSON.stringify(existingInvoices));
          console.log('✅ Test invoice created in localStorage');
        } catch (error) {
          console.error('❌ Error creating test invoice:', error);
        }
      });

      // Now navigate to view this test invoice
      await page.goto('http://localhost:3001/app?view=true&invoice=debug-test-invoice');
      await page.waitForTimeout(3000);

      // Wait for React to render
      await page.waitForSelector('.invoice-preview, [data-testid="invoice-preview"], .card', { timeout: 10000 });

      // Let the debug logs accumulate
      await page.waitForTimeout(2000);

      console.log('=== All Browser Console Logs ===');
      page.logs.forEach(log => console.log(log));
    }

    // The test always passes - we're just debugging
    expect(true).toBe(true);
  });
});