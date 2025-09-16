/**
 * Services Tab Bug Fixes Validation Test
 * Tests the three critical bug fixes:
 * 1. Line item titles appearing in both sidebar and preview
 * 2. Service type dropdown reliably appearing and functioning
 * 3. Smooth scrolling within Services tab
 */

const { chromium } = require('playwright');

async function testServiceTabFixes() {
  console.log('🧪 Starting Services Tab Bug Fixes Validation...\n');

  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();

  try {
    // Navigate to the application
    console.log('📱 Loading application...');
    await page.goto('http://localhost:3000/app.html');
    await page.waitForTimeout(2000);

    // Navigate to Services tab
    console.log('🔄 Navigating to Services tab...');
    await page.click('[data-tab="scope"]');
    await page.waitForTimeout(1000);

    // Test 1: Line Item Title Synchronization
    console.log('\n🔍 TEST 1: Line Item Title Synchronization');

    // Add a line item
    await page.click('#add-line-item');
    await page.waitForTimeout(500);

    // Select a service type but DON'T fill description yet
    console.log('   - Selecting service type without description...');
    await page.selectOption('.job-type-select', 'Pilotage');
    await page.waitForTimeout(1000);

    // Check if line item appears in preview (this was the bug)
    const previewLineItem = await page.locator('#preview-line-items tr').count();
    if (previewLineItem > 0) {
      console.log('   ✅ Line item appears in preview with just service type selected');
    } else {
      console.log('   ❌ Line item still missing from preview');
    }

    // Now add description and verify it updates
    console.log('   - Adding description...');
    await page.fill('.description-input', 'Test pilotage service');
    await page.waitForTimeout(1000);

    const previewText = await page.locator('#preview-line-items tr td').first().textContent();
    if (previewText.includes('Test pilotage service')) {
      console.log('   ✅ Description properly synchronized between sidebar and preview');
    } else {
      console.log('   ❌ Description not properly synchronized');
    }

    // Test 2: Service Type Dropdown Reliability
    console.log('\n🔍 TEST 2: Service Type Dropdown Reliability');

    // Add another line item to test dropdown appears
    await page.click('#add-line-item');
    await page.waitForTimeout(1000);

    // Check if dropdown is visible and functional
    const dropdownCount = await page.locator('.job-type-select').count();
    if (dropdownCount >= 2) {
      console.log('   ✅ Service type dropdown appears for new line items');

      // Test dropdown functionality
      await page.selectOption('.job-type-select >> nth=1', 'Agent Services');
      await page.waitForTimeout(500);

      const selectedValue = await page.locator('.job-type-select >> nth=1').inputValue();
      if (selectedValue === 'Agent Services') {
        console.log('   ✅ Service type dropdown functions properly');
      } else {
        console.log('   ❌ Service type dropdown not functioning');
      }
    } else {
      console.log('   ❌ Service type dropdown not appearing for new line items');
    }

    // Test 3: Scrolling Functionality
    console.log('\n🔍 TEST 3: Scrolling Functionality');

    // Add multiple line items to test scrolling
    console.log('   - Adding multiple line items to test scrolling...');
    for (let i = 0; i < 5; i++) {
      await page.click('#add-line-item');
      await page.waitForTimeout(300);
      await page.selectOption(`.job-type-select >> nth=${i + 2}`, 'Car Rental');
      await page.fill(`.description-input >> nth=${i + 2}`, `Test item ${i + 3}`);
      await page.waitForTimeout(200);
    }

    // Test scrolling behavior
    const lineItemsList = page.locator('#line-items-list');
    const isScrollable = await lineItemsList.evaluate(el => el.scrollHeight > el.clientHeight);

    if (isScrollable) {
      console.log('   ✅ Line items container is scrollable');

      // Test actual scrolling
      await lineItemsList.evaluate(el => el.scrollTo(0, 100));
      await page.waitForTimeout(500);

      const scrollTop = await lineItemsList.evaluate(el => el.scrollTop);
      if (scrollTop > 0) {
        console.log('   ✅ Scrolling functions properly');
      } else {
        console.log('   ❌ Scrolling not working');
      }
    } else {
      console.log('   ℹ️  Not enough content to test scrolling');
    }

    // Final validation: Check all line items in preview
    console.log('\n🔍 FINAL VALIDATION: Preview Synchronization');
    const totalLineItems = await page.locator('.line-item-card').count();
    const previewLineItems = await page.locator('#preview-line-items tr').count();

    console.log(`   - Total line items in sidebar: ${totalLineItems}`);
    console.log(`   - Total line items in preview: ${previewLineItems}`);

    if (totalLineItems === previewLineItems) {
      console.log('   ✅ Perfect synchronization between sidebar and preview');
    } else {
      console.log('   ⚠️  Partial synchronization - may need additional work');
    }

    console.log('\n🎉 Tests completed! Check results above.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the tests
testServiceTabFixes().catch(console.error);