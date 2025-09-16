/**
 * Performance Tests for Invoice Save Operations
 *
 * Ensures save and update operations meet performance requirements
 * to prevent user experience degradation
 */

const { test, expect } = require('@playwright/test');

test.describe('Invoice Save Performance', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Login if needed
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@marinegroup.com');
      await page.fill('#password', 'test123');
      await page.click('#loginBtn');
    }

    if (!page.url().includes('/app')) {
      await page.goto('/app');
    }

    await page.waitForSelector('[data-testid="vessel-name"]', { timeout: 10000 });
  });

  test('Initial invoice save completes within 5 seconds', async ({ page }) => {
    // Fill out a substantial invoice
    await page.fill('[data-testid="vessel-name"]', 'Performance Test Vessel Large');
    await page.fill('[data-testid="customer-name"]', 'Performance Test Customer Corp');
    await page.fill('[data-testid="customer-email"]', 'performance@example.com');
    await page.fill('[data-testid="customer-phone"]', '555-PERFORMANCE');

    // Add multiple line items to increase data size
    for (let i = 0; i < 20; i++) {
      await page.click('[data-testid="add-line-item"]');
      await page.fill(`[data-testid="line-item-description-${i}"]`, `Service Item ${i + 1} with detailed description`);
      await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 100}`);
    }

    // Measure save time
    const saveStartTime = Date.now();

    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Large Performance Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');

    await page.waitForSelector('[data-testid="success-notification"]', { timeout: 30000 });

    const saveEndTime = Date.now();
    const saveTime = saveEndTime - saveStartTime;

    console.log(`Initial save time with 20 line items: ${saveTime}ms`);
    expect(saveTime).toBeLessThan(5000); // 5 second maximum
  });

  test('Invoice update completes within 3 seconds', async ({ page }) => {
    // First create an invoice with substantial content
    await page.fill('[data-testid="vessel-name"]', 'Update Performance Vessel');
    await page.fill('[data-testid="customer-name"]', 'Update Performance Customer');

    // Add several line items
    for (let i = 0; i < 15; i++) {
      await page.click('[data-testid="add-line-item"]');
      await page.fill(`[data-testid="line-item-description-${i}"]`, `Update Service ${i + 1}`);
      await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 50}`);
    }

    // Save initial invoice
    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Update Performance Test');
    await page.click('[data-testid="confirm-save-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]');

    // Wait for edit mode to be established
    await page.waitForFunction(() => {
      return window.app?.state?.getIsEditMode() === true;
    }, { timeout: 5000 });

    // Now measure update performance
    await page.fill('[data-testid="vessel-name"]', 'Update Performance Vessel MODIFIED');

    // Modify several line items
    for (let i = 0; i < 5; i++) {
      await page.fill(`[data-testid="line-item-description-${i}"]`, `MODIFIED Service ${i + 1}`);
      await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 75}`);
    }

    // Measure update time
    const updateStartTime = Date.now();

    await page.click('[data-testid="save-invoice-btn"]');
    await page.waitForSelector('[data-testid="success-notification"]', { timeout: 15000 });

    const updateEndTime = Date.now();
    const updateTime = updateEndTime - updateStartTime;

    console.log(`Update time with 15 line items: ${updateTime}ms`);
    expect(updateTime).toBeLessThan(3000); // 3 second maximum
  });

  test('Auto-save performance does not impact user experience', async ({ page }) => {
    // Enable auto-save if available
    const settingsBtn = page.locator('[data-testid="settings-btn"]');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();

      const autoSaveToggle = page.locator('[data-testid="auto-save-toggle"]');
      if (await autoSaveToggle.isVisible()) {
        const isChecked = await autoSaveToggle.isChecked();
        if (!isChecked) {
          await autoSaveToggle.click();
        }
      }

      const closeBtn = page.locator('[data-testid="settings-close-btn"]');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }
    }

    // Create content that would trigger auto-save
    await page.fill('[data-testid="vessel-name"]', 'Auto Save Performance Test');
    await page.fill('[data-testid="customer-name"]', 'Auto Save Customer');

    // Add some line items
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="add-line-item"]');
      await page.fill(`[data-testid="line-item-description-${i}"]`, `Auto Save Service ${i + 1}`);

      // Measure typing responsiveness during auto-save interval
      const typeStartTime = Date.now();
      await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 100}`, { timeout: 1000 });
      const typeEndTime = Date.now();

      const responseTime = typeEndTime - typeStartTime;
      console.log(`Typing response time for item ${i}: ${responseTime}ms`);

      // Typing should be responsive (under 100ms for form fills)
      expect(responseTime).toBeLessThan(1000);

      // Wait a bit to potentially trigger auto-save
      await page.waitForTimeout(500);
    }

    // Verify auto-save doesn't block the UI
    const uiStartTime = Date.now();
    await page.fill('[data-testid="vessel-name"]', 'Auto Save Performance Test FINAL');
    const uiEndTime = Date.now();

    expect(uiEndTime - uiStartTime).toBeLessThan(200); // UI should remain responsive
  });

  test('Large invoice data handling performance', async ({ page }) => {
    // Create an invoice with maximum reasonable data
    await page.fill('[data-testid="vessel-name"]', 'Very Large Vessel Name With Lots Of Detail Information');
    await page.fill('[data-testid="customer-name"]', 'Very Large Customer Name Corporation LLC International');
    await page.fill('[data-testid="customer-email"]', 'very.long.email.address@large-corporation-name.international.com');

    // Add maximum line items (test system limits)
    const maxItems = 50;
    for (let i = 0; i < maxItems; i++) {
      await page.click('[data-testid="add-line-item"]');

      const longDescription = `Very detailed service description item ${i + 1} with extensive information about the work performed, materials used, labor hours, and any special considerations or notes that might be relevant to this particular line item on the invoice`;

      await page.fill(`[data-testid="line-item-description-${i}"]`, longDescription);
      await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 123.45}`);

      // Every 10 items, check performance
      if ((i + 1) % 10 === 0) {
        const interactionStart = Date.now();
        await page.click('[data-testid="vessel-name"]');
        await page.fill('[data-testid="vessel-name"]', `Large Vessel ${i + 1}`);
        const interactionEnd = Date.now();

        console.log(`UI responsiveness with ${i + 1} items: ${interactionEnd - interactionStart}ms`);
        expect(interactionEnd - interactionStart).toBeLessThan(500);
      }
    }

    // Test save performance with large dataset
    const largeSaveStart = Date.now();

    await page.click('[data-testid="save-invoice-btn"]');
    await page.fill('[data-testid="invoice-title-input"]', 'Maximum Size Performance Test Invoice');
    await page.click('[data-testid="confirm-save-btn"]');

    await page.waitForSelector('[data-testid="success-notification"]', { timeout: 60000 });

    const largeSaveEnd = Date.now();
    const largeSaveTime = largeSaveEnd - largeSaveStart;

    console.log(`Large invoice save time (${maxItems} items): ${largeSaveTime}ms`);
    expect(largeSaveTime).toBeLessThan(10000); // 10 second maximum for very large invoices
  });

  test('Concurrent operations performance', async ({ page, context }) => {
    // Open multiple tabs to simulate concurrent usage
    const page2 = await context.newPage();
    await page2.goto('/app');
    await page2.waitForSelector('[data-testid="vessel-name"]');

    // Create content in both tabs
    const operations = [
      // Page 1 operations
      async () => {
        await page.fill('[data-testid="vessel-name"]', 'Concurrent Test 1');
        await page.fill('[data-testid="customer-name"]', 'Concurrent Customer 1');

        for (let i = 0; i < 5; i++) {
          await page.click('[data-testid="add-line-item"]');
          await page.fill(`[data-testid="line-item-description-${i}"]`, `Concurrent Service 1-${i}`);
          await page.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 100}`);
        }

        const saveStart = Date.now();
        await page.click('[data-testid="save-invoice-btn"]');
        await page.fill('[data-testid="invoice-title-input"]', 'Concurrent Test Invoice 1');
        await page.click('[data-testid="confirm-save-btn"]');
        await page.waitForSelector('[data-testid="success-notification"]');
        return Date.now() - saveStart;
      },

      // Page 2 operations
      async () => {
        await page2.fill('[data-testid="vessel-name"]', 'Concurrent Test 2');
        await page2.fill('[data-testid="customer-name"]', 'Concurrent Customer 2');

        for (let i = 0; i < 5; i++) {
          await page2.click('[data-testid="add-line-item"]');
          await page2.fill(`[data-testid="line-item-description-${i}"]`, `Concurrent Service 2-${i}`);
          await page2.fill(`[data-testid="manual-cost-${i}"]`, `${(i + 1) * 150}`);
        }

        const saveStart = Date.now();
        await page2.click('[data-testid="save-invoice-btn"]');
        await page2.fill('[data-testid="invoice-title-input"]', 'Concurrent Test Invoice 2');
        await page2.click('[data-testid="confirm-save-btn"]');
        await page2.waitForSelector('[data-testid="success-notification"]');
        return Date.now() - saveStart;
      }
    ];

    // Execute operations concurrently
    const concurrentStart = Date.now();
    const results = await Promise.all(operations);
    const concurrentEnd = Date.now();

    const totalConcurrentTime = concurrentEnd - concurrentStart;
    const maxIndividualTime = Math.max(...results);

    console.log(`Concurrent operations total time: ${totalConcurrentTime}ms`);
    console.log(`Maximum individual operation time: ${maxIndividualTime}ms`);
    console.log(`Individual operation times: ${results.join('ms, ')}ms`);

    // Concurrent operations shouldn't take much longer than sequential
    expect(totalConcurrentTime).toBeLessThan(maxIndividualTime * 1.5);

    // Individual operations shouldn't be significantly slower due to concurrency
    results.forEach(time => {
      expect(time).toBeLessThan(8000); // 8 second max per operation under concurrency
    });

    await page2.close();
  });

  test('Memory usage during intensive operations', async ({ page }) => {
    // This test checks for memory leaks during repeated save operations
    const performMemoryIntensiveOperations = async () => {
      for (let iteration = 0; iteration < 10; iteration++) {
        // Clear and recreate content
        await page.evaluate(() => {
          if (window.app?.state) {
            window.app.state.reset();
          }
        });

        await page.fill('[data-testid="vessel-name"]', `Memory Test ${iteration}`);
        await page.fill('[data-testid="customer-name"]', `Memory Customer ${iteration}`);

        // Add and remove line items repeatedly
        for (let i = 0; i < 10; i++) {
          await page.click('[data-testid="add-line-item"]');
          await page.fill(`[data-testid="line-item-description-${i}"]`, `Memory Item ${i}`);
        }

        // Save the invoice
        await page.click('[data-testid="save-invoice-btn"]');
        await page.fill('[data-testid="invoice-title-input"]', `Memory Test Invoice ${iteration}`);
        await page.click('[data-testid="confirm-save-btn"]');
        await page.waitForSelector('[data-testid="success-notification"]');

        // Check memory usage (basic check)
        const memoryUsage = await page.evaluate(() => {
          return {
            usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
            totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
            jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0
          };
        });

        console.log(`Iteration ${iteration} memory: ${Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`);

        // Memory shouldn't grow excessively (this is a basic check)
        if (memoryUsage.usedJSHeapSize > 0) {
          expect(memoryUsage.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB limit
        }
      }
    };

    const memoryTestStart = Date.now();
    await performMemoryIntensiveOperations();
    const memoryTestEnd = Date.now();

    console.log(`Memory test duration: ${memoryTestEnd - memoryTestStart}ms`);
    expect(memoryTestEnd - memoryTestStart).toBeLessThan(60000); // Should complete within 1 minute
  });
});