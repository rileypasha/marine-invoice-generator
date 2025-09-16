/**
 * Phase 4: Playwright E2E Tests - Services Tab Duplicate Prevention
 *
 * MANDATORY: These tests MUST prevent CI regression by detecting duplicate line items.
 * If any test fails, CI must fail to prevent deployment of the bug.
 */

const { test, expect } = require('@playwright/test');

test.describe('Services Tab - Duplicate Line Item Prevention', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000/app.html');
    await page.waitForTimeout(2000); // Wait for app initialization

    // Navigate to Services tab
    await page.click('[data-tab="scope"]');
    await page.waitForTimeout(500);
  });

  test('addsExactlyOneItemOnClick - Single click creates exactly one item', async ({ page }) => {
    console.log('🧪 Testing: Single click creates exactly one line item');

    // Get initial count
    const initialCount = await page.locator('.line-item-card').count();
    console.log(`Initial line items: ${initialCount}`);

    // Get initial button state
    const buttonText = await page.locator('#add-line-item').textContent();
    const buttonDisabled = await page.locator('#add-line-item').isDisabled();

    expect(buttonText.trim()).toBe('Add Line Item');
    expect(buttonDisabled).toBe(false);

    // Click the add button once
    await page.click('#add-line-item');

    // Wait for the operation to complete
    await page.waitForTimeout(1000);

    // Verify exactly one item was added
    const finalCount = await page.locator('.line-item-card').count();
    console.log(`Final line items: ${finalCount}`);

    expect(finalCount).toBe(initialCount + 1);

    // Verify button is re-enabled
    const finalButtonText = await page.locator('#add-line-item').textContent();
    const finalButtonDisabled = await page.locator('#add-line-item').isDisabled();

    expect(finalButtonText.trim()).toBe('Add Line Item');
    expect(finalButtonDisabled).toBe(false);
  });

  test('preventsDuplicateOnRapidClicks - Rapid clicking prevention', async ({ page }) => {
    console.log('🧪 Testing: Rapid clicking prevention');

    const initialCount = await page.locator('.line-item-card').count();
    console.log(`Initial line items: ${initialCount}`);

    // Perform rapid clicks (3 clicks within 100ms)
    await page.click('#add-line-item');
    await page.waitForTimeout(30);
    await page.click('#add-line-item');
    await page.waitForTimeout(30);
    await page.click('#add-line-item');

    // Wait for all operations to complete
    await page.waitForTimeout(1500);

    // Should only add ONE item despite multiple clicks
    const finalCount = await page.locator('.line-item-card').count();
    console.log(`Final line items: ${finalCount} (expected: ${initialCount + 1})`);

    expect(finalCount).toBe(initialCount + 1);

    // Verify no extra items were created
    if (finalCount > initialCount + 1) {
      throw new Error(`🚨 DUPLICATE DETECTED: Expected ${initialCount + 1}, got ${finalCount} (+${finalCount - initialCount - 1} duplicates)`);
    }
  });

  test('noDuplicateFromEnterKeyOrBubbling - Keyboard and event bubbling protection', async ({ page }) => {
    console.log('🧪 Testing: Keyboard trigger and event bubbling protection');

    const initialCount = await page.locator('.line-item-card').count();
    console.log(`Initial line items: ${initialCount}`);

    // Test 1: Enter key on focused button
    await page.focus('#add-line-item');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    let currentCount = await page.locator('.line-item-card').count();
    expect(currentCount).toBe(initialCount + 1);
    console.log(`After Enter key: ${currentCount} items`);

    // Test 2: Ensure no double-triggering from both click and keypress
    await page.focus('#add-line-item');

    // Simulate potential event bubbling scenario
    await Promise.all([
      page.click('#add-line-item'),
      page.keyboard.press('Enter')
    ]);

    await page.waitForTimeout(1000);

    const finalCount = await page.locator('.line-item-card').count();
    expect(finalCount).toBe(currentCount + 1); // Should only add ONE more
    console.log(`After simultaneous click+Enter: ${finalCount} items`);
  });

  test('re-enablesAddButtonAfterSuccess - Button state management validation', async ({ page }) => {
    console.log('🧪 Testing: Button state management during operations');

    // Initial state check
    const initialText = await page.locator('#add-line-item').textContent();
    const initialDisabled = await page.locator('#add-line-item').isDisabled();

    expect(initialText.trim()).toBe('Add Line Item');
    expect(initialDisabled).toBe(false);

    // Start the add operation
    await page.click('#add-line-item');

    // Immediately check if button is disabled and text changed
    await page.waitForTimeout(50); // Small delay to catch the disabled state

    const duringText = await page.locator('#add-line-item').textContent();
    const duringDisabled = await page.locator('#add-line-item').isDisabled();

    // During operation, button should be disabled with "Adding..." text
    expect(duringDisabled).toBe(true);
    expect(duringText.trim()).toBe('Adding...');

    // Wait for operation to complete
    await page.waitForTimeout(1000);

    // After operation, button should be re-enabled
    const finalText = await page.locator('#add-line-item').textContent();
    const finalDisabled = await page.locator('#add-line-item').isDisabled();

    expect(finalText.trim()).toBe('Add Line Item');
    expect(finalDisabled).toBe(false);

    console.log('✅ Button state management validated');
  });

  test('handlesValidationConstraints - Respects existing validation rules', async ({ page }) => {
    console.log('🧪 Testing: Integration with existing validation');

    // Add first line item
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    // Don't fill any fields (leave incomplete)
    const firstItemCount = await page.locator('.line-item-card').count();
    expect(firstItemCount).toBe(1);

    // Try to add second item without completing first
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    // Should be blocked by validation
    const blockedCount = await page.locator('.line-item-card').count();
    expect(blockedCount).toBe(1); // No new item should be added

    // Complete the first item
    await page.selectOption('.job-type-select', 'Pilotage');
    await page.waitForTimeout(300);
    await page.fill('.description-input', 'Test pilotage service');
    await page.waitForTimeout(300);
    await page.fill('.manual-cost-input', '500');
    await page.waitForTimeout(500);

    // Now try to add second item
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    const finalCount = await page.locator('.line-item-card').count();
    expect(finalCount).toBe(2); // Should now allow second item

    console.log('✅ Validation integration working correctly');
  });

  test('stressTestRapidClicking - Stress test with extreme rapid clicking', async ({ page }) => {
    console.log('🧪 Testing: Stress test with extreme rapid clicking');

    const initialCount = await page.locator('.line-item-card').count();

    // Perform 10 rapid clicks
    const clickPromises = [];
    for (let i = 0; i < 10; i++) {
      clickPromises.push(
        page.click('#add-line-item', { timeout: 100 }).catch(() => {
          // Ignore click failures due to disabled state
        })
      );
    }

    // Execute all clicks simultaneously
    await Promise.allSettled(clickPromises);

    // Wait for all operations to settle
    await page.waitForTimeout(2000);

    const finalCount = await page.locator('.line-item-card').count();
    console.log(`Stress test result: ${finalCount} items (expected: ${initialCount + 1})`);

    // Should only add ONE item despite 10 clicks
    expect(finalCount).toBe(initialCount + 1);

    if (finalCount > initialCount + 1) {
      throw new Error(`🚨 STRESS TEST FAILED: Expected max ${initialCount + 1}, got ${finalCount} (${finalCount - initialCount - 1} duplicates)`);
    }
  });

  test('maintainsSyncBetweenSidebarAndPreview - Validates line item sync', async ({ page }) => {
    console.log('🧪 Testing: Line item synchronization after adding');

    // Add a line item
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    // Fill the line item
    await page.selectOption('.job-type-select', 'Pilotage');
    await page.waitForTimeout(300);
    await page.fill('.description-input', 'Test service');
    await page.waitForTimeout(300);
    await page.fill('.manual-cost-input', '1000');
    await page.waitForTimeout(500);

    // Check sidebar count
    const sidebarCount = await page.locator('.line-item-card').count();

    // Check preview count
    const previewCount = await page.locator('#preview-line-items tr').count();

    console.log(`Sidebar items: ${sidebarCount}, Preview items: ${previewCount}`);

    // Should have exactly one item in both places
    expect(sidebarCount).toBe(1);
    expect(previewCount).toBe(1);

    // Verify content sync
    const previewText = await page.locator('#preview-line-items tr td').first().textContent();
    expect(previewText).toContain('Test service');

    console.log('✅ Sidebar-Preview synchronization maintained');
  });

  test('recoverFromErrorState - Error recovery validation', async ({ page }) => {
    console.log('🧪 Testing: Error recovery and state consistency');

    // Inject JavaScript to simulate an error condition
    await page.evaluate(() => {
      // Temporarily break the addLineItem function to test error recovery
      if (window.invoiceState && window.invoiceState.addLineItem) {
        const original = window.invoiceState.addLineItem;
        let callCount = 0;

        window.invoiceState.addLineItem = function(...args) {
          callCount++;
          if (callCount === 1) {
            // First call fails
            throw new Error('Simulated error for testing');
          }
          // Subsequent calls work normally
          return original.apply(this, args);
        };
      }
    });

    const initialCount = await page.locator('.line-item-card').count();

    // Try to add item (should fail internally but not crash UI)
    await page.click('#add-line-item').catch(() => {
      // Expected to potentially throw
    });

    await page.waitForTimeout(1000);

    // System should recover and button should be enabled
    const buttonDisabled = await page.locator('#add-line-item').isDisabled();
    expect(buttonDisabled).toBe(false);

    // Second attempt should work
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    const finalCount = await page.locator('.line-item-card').count();
    expect(finalCount).toBe(initialCount + 1);

    console.log('✅ Error recovery working correctly');
  });

});

test.describe('Services Tab - Regression Prevention', () => {

  test('ensureNoPreviousBugsRegressed - Verify previous fixes still work', async ({ page }) => {
    console.log('🧪 Testing: Regression prevention for previous Services tab fixes');

    await page.goto('http://localhost:3000/app.html');
    await page.waitForTimeout(2000);
    await page.click('[data-tab="scope"]');
    await page.waitForTimeout(500);

    // Add line item and verify previous fixes
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    // Test 1: Service type dropdown should appear (previous bug fix)
    const dropdownVisible = await page.locator('.job-type-select').isVisible();
    expect(dropdownVisible).toBe(true);

    // Test 2: Line item should appear in preview with just service type (previous bug fix)
    await page.selectOption('.job-type-select', 'Pilotage');
    await page.waitForTimeout(1000);

    const previewItems = await page.locator('#preview-line-items tr').count();
    expect(previewItems).toBeGreaterThan(0);

    // Test 3: Scrolling should work (previous bug fix)
    // Add multiple items to test scrolling
    for (let i = 0; i < 3; i++) {
      await page.click('#add-line-item');
      await page.waitForTimeout(300);
      await page.selectOption(`.job-type-select >> nth=${i + 1}`, 'Car Rental');
      await page.fill(`.description-input >> nth=${i + 1}`, `Test item ${i + 2}`);
      await page.fill(`.manual-cost-input >> nth=${i + 1}`, '100');
      await page.waitForTimeout(200);
    }

    const totalItems = await page.locator('.line-item-card').count();
    expect(totalItems).toBe(4); // 1 original + 3 new

    console.log('✅ All previous fixes still working - no regression detected');
  });

});