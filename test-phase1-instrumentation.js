/**
 * PHASE 1 INSTRUMENTATION TEST
 * Test to reproduce and trace the unsaved changes bugs
 */

const puppeteer = require('puppeteer');

async function testUnsavedChangesBugs() {
  console.log('🔍 PHASE 1: Testing unsaved changes bugs with instrumentation...');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--disable-web-security']
  });

  const page = await browser.newPage();

  // Capture console logs with our instrumentation
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PHASE 1') || text.includes('TRACE:') || text.includes('markAsSaved') || text.includes('detectChanges')) {
      console.log(`📊 BROWSER: ${text}`);
    }
  });

  try {
    // Navigate to app
    await page.goto('http://localhost:3000/app.html');
    await page.waitForSelector('#invoice-form', { timeout: 10000 });

    console.log('\n🔍 TEST 1: Invoice Load False Positive');
    console.log('========================================');

    // Step 1: Create a test invoice first
    console.log('📝 Creating test invoice...');
    await page.type('#vessel-name', 'Test Vessel Phase 1');
    await page.type('#customer-name', 'Test Customer Phase 1');
    await page.waitForTimeout(1000);

    // Save the invoice
    await page.click('#save-invoice');
    await page.waitForTimeout(2000);

    // Step 2: Refresh page to simulate loading saved invoice
    console.log('🔄 Refreshing page to simulate invoice load...');
    await page.reload();
    await page.waitForSelector('#invoice-form', { timeout: 10000 });
    await page.waitForTimeout(3000);

    console.log('\n🔍 TEST 2: Tab Switch Warning Bug');
    console.log('===================================');

    // Step 3: Try to switch tabs within same invoice
    console.log('🔄 Attempting to switch to Services tab...');
    await page.click('[data-tab="services"]');
    await page.waitForTimeout(1000);

    // Check if warning dialog appears (it shouldn't for same invoice navigation)
    const dialogExists = await page.$('.unsaved-changes-dialog') !== null;
    console.log(`📊 WARNING DIALOG APPEARED: ${dialogExists} (should be FALSE)`);

    console.log('\n🔍 TEST 3: Edit and Tab Switch');
    console.log('==============================');

    // Step 4: Make a real edit then try tab switch
    await page.click('[data-tab="details"]');
    await page.waitForTimeout(500);

    console.log('✏️ Making a real edit...');
    await page.focus('#vessel-name');
    await page.keyboard.selectAll();
    await page.type('#vessel-name', 'Modified Vessel Name');
    await page.waitForTimeout(1000);

    // Now try tab switch - this SHOULD show warning
    console.log('🔄 Tab switch after real edit...');
    await page.click('[data-tab="services"]');
    await page.waitForTimeout(1000);

    const dialogExistsAfterEdit = await page.$('.unsaved-changes-dialog') !== null;
    console.log(`📊 WARNING DIALOG AFTER EDIT: ${dialogExistsAfterEdit} (should be TRUE)`);

    console.log('\n✅ Phase 1 instrumentation test completed');

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    // Keep browser open for manual inspection
    console.log('\n📊 Browser kept open for manual inspection of console logs');
    console.log('📊 Check DevTools Console for PHASE 1 instrumentation logs');
    // await browser.close();
  }
}

// Run the test
testUnsavedChangesBugs().catch(console.error);