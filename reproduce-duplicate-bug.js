/**
 * Phase 1: Reproduce & Instrument - Duplicate Line Items Bug
 *
 * This test specifically reproduces the bug where clicking "Add Line Item"
 * creates multiple line items instead of just one.
 */

const { chromium } = require('playwright');

async function reproduceDuplicateBug() {
  console.log('🐛 REPRODUCING: Duplicate Line Items Bug');
  console.log('=====================================\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
    devtools: true // Open DevTools to monitor console
  });

  const page = await browser.newPage();

  // Inject our instrumentation script
  await page.addInitScript(() => {
    window.duplicateTracker = {
      events: [],
      lineItemCounts: [],

      trackEvent(source, event, details = {}) {
        const timestamp = Date.now();
        const record = { timestamp, source, event, details };
        this.events.push(record);
        console.log(`🔍 [${timestamp}] ${source}: ${event}`, details);
      },

      trackLineItemCount(source, count) {
        const timestamp = Date.now();
        const record = { timestamp, source, count };
        this.lineItemCounts.push(record);

        if (this.lineItemCounts.length > 1) {
          const previous = this.lineItemCounts[this.lineItemCounts.length - 2];
          const increase = count - previous.count;

          if (increase > 1) {
            console.warn(`⚠️ DUPLICATE DETECTED: ${previous.count} → ${count} (+${increase}) from ${source}`);
          }
        }

        console.log(`📊 [${source}] Line items: ${count}`);
      },

      getReport() {
        return {
          events: this.events,
          lineItemCounts: this.lineItemCounts
        };
      }
    };
  });

  try {
    // Load the application
    console.log('📱 Loading application...');
    await page.goto('http://localhost:3000/app.html');
    await page.waitForTimeout(3000); // Wait for full initialization

    // Navigate to Services tab
    console.log('🔄 Navigating to Services tab...');
    await page.click('[data-tab="scope"]');
    await page.waitForTimeout(1000);

    // Get initial state
    console.log('\n📊 INITIAL STATE');
    let lineItemCount = await page.locator('.line-item-card').count();
    console.log(`Starting line items: ${lineItemCount}`);

    // Instrument the page to track duplicates
    await page.evaluate(() => {
      // Hook into the Add Line Item button click
      const addButton = document.getElementById('add-line-item');
      if (addButton) {
        let clickCount = 0;

        addButton.addEventListener('click', () => {
          clickCount++;
          window.duplicateTracker.trackEvent('Button', 'click', { clickNumber: clickCount });
        }, true); // Capture phase

        // Monitor DOM changes to line items list
        const lineItemsList = document.getElementById('line-items-list');
        if (lineItemsList) {
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                const count = lineItemsList.children.length;
                window.duplicateTracker.trackLineItemCount('DOM-Observer', count);
              }
            });
          });

          observer.observe(lineItemsList, { childList: true });
        }

        // Hook into state if available
        if (window.invoiceState && window.invoiceState.addLineItem) {
          const originalAddLineItem = window.invoiceState.addLineItem;
          window.invoiceState.addLineItem = function(lineItem = {}) {
            window.duplicateTracker.trackEvent('State', 'addLineItem-called', lineItem);

            const beforeCount = this.state.scope.lineItems.length;
            window.duplicateTracker.trackLineItemCount('State-Before', beforeCount);

            const result = originalAddLineItem.call(this, lineItem);

            const afterCount = this.state.scope.lineItems.length;
            window.duplicateTracker.trackLineItemCount('State-After', afterCount);

            return result;
          };
        }
      }
    });

    // Test Scenario 1: Single Click
    console.log('\n🧪 TEST 1: Single Click');
    console.log('===================');

    lineItemCount = await page.locator('.line-item-card').count();
    console.log(`Before single click: ${lineItemCount} items`);

    await page.click('#add-line-item');
    await page.waitForTimeout(1000); // Wait for processing

    lineItemCount = await page.locator('.line-item-card').count();
    console.log(`After single click: ${lineItemCount} items`);

    const report1 = await page.evaluate(() => window.duplicateTracker.getReport());
    console.log('\n📊 Single Click Results:');
    console.log(`Events: ${report1.events.length}`);
    console.log(`State changes: ${report1.lineItemCounts.length}`);

    // Clear tracker for next test
    await page.evaluate(() => {
      window.duplicateTracker.events = [];
      window.duplicateTracker.lineItemCounts = [];
    });

    // Test Scenario 2: Rapid Clicks
    console.log('\n\n🧪 TEST 2: Rapid Clicks (3 clicks within 200ms)');
    console.log('=============================================');

    lineItemCount = await page.locator('.line-item-card').count();
    console.log(`Before rapid clicks: ${lineItemCount} items`);

    // Perform rapid clicks
    await page.click('#add-line-item');
    await page.waitForTimeout(50);
    await page.click('#add-line-item');
    await page.waitForTimeout(50);
    await page.click('#add-line-item');

    await page.waitForTimeout(1500); // Wait for all processing

    lineItemCount = await page.locator('.line-item-card').count();
    console.log(`After rapid clicks: ${lineItemCount} items`);

    const report2 = await page.evaluate(() => window.duplicateTracker.getReport());
    console.log('\n📊 Rapid Clicks Results:');
    console.log(`Events: ${report2.events.length}`);
    console.log(`State changes: ${report2.lineItemCounts.length}`);

    // Analyze for duplicates
    const duplicateEvents = report2.events.filter(e => e.source === 'Button' && e.event === 'click');
    const stateChanges = report2.lineItemCounts;

    console.log(`\n🔍 ANALYSIS:`);
    console.log(`Button clicks detected: ${duplicateEvents.length}`);
    console.log(`State changes: ${stateChanges.length}`);

    if (stateChanges.length > 0) {
      const finalCount = stateChanges[stateChanges.length - 1].count;
      const initialCount = stateChanges[0].count;
      const actualIncrease = finalCount - initialCount;
      console.log(`Actual items added: ${actualIncrease}`);
      console.log(`Expected items added: 3`);

      if (actualIncrease > 3) {
        console.log(`🚨 BUG CONFIRMED: Expected 3 items, got ${actualIncrease} items (+${actualIncrease - 3} duplicates)`);
      } else {
        console.log(`✅ No duplicates detected in rapid click test`);
      }
    }

    // Test Scenario 3: Keyboard Trigger
    console.log('\n\n🧪 TEST 3: Keyboard Trigger (Enter/Space on button)');
    console.log('================================================');

    await page.evaluate(() => {
      window.duplicateTracker.events = [];
      window.duplicateTracker.lineItemCounts = [];
    });

    lineItemCount = await page.locator('.line-item-card').count();
    console.log(`Before keyboard trigger: ${lineItemCount} items`);

    // Focus button and press Enter
    await page.focus('#add-line-item');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    lineItemCount = await page.locator('.line-item-card').count();
    console.log(`After keyboard trigger: ${lineItemCount} items`);

    // Final comprehensive report
    console.log('\n\n📋 COMPREHENSIVE BUG ANALYSIS');
    console.log('============================');

    const finalReport = await page.evaluate(() => window.duplicateTracker.getReport());
    console.log(`Total events tracked: ${finalReport.events.length}`);
    console.log(`Total state changes: ${finalReport.lineItemCounts.length}`);

    // Event timeline
    console.log('\n⏱️  Event Timeline:');
    finalReport.events.forEach((event, index) => {
      const timeFromStart = event.timestamp - finalReport.events[0].timestamp;
      console.log(`${index + 1}. [+${timeFromStart}ms] ${event.source}:${event.event}`);
    });

    // State change timeline
    console.log('\n📈 State Change Timeline:');
    finalReport.lineItemCounts.forEach((change, index) => {
      const timeFromStart = change.timestamp - finalReport.lineItemCounts[0].timestamp;
      console.log(`${index + 1}. [+${timeFromStart}ms] ${change.source}: ${change.count} items`);
    });

    console.log('\n🎯 REPRODUCTION TEST COMPLETE');
    console.log('Check the output above for duplicate detection results.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

// Run the reproduction test
reproduceDuplicateBug().catch(console.error);