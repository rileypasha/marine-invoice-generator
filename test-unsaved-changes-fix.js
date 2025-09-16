/**
 * COMPREHENSIVE TEST: Unsaved Changes Bug Fixes
 * Tests both Issue 1 (False Positive on Load) and Issue 2 (Tab Switch Warning)
 */

const puppeteer = require('puppeteer');

async function testUnsavedChangesFixes() {
  console.log('🧪 TESTING: Unsaved Changes Bug Fixes');
  console.log('=====================================\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--disable-web-security']
  });

  const page = await browser.newPage();

  // Set viewport for consistent testing
  await page.setViewport({ width: 1200, height: 800 });

  // Capture console logs for debugging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('PHASE 2') || text.includes('markAsSaved') || text.includes('TAB ANALYSIS') || text.includes('WARNING')) {
      console.log(`📊 BROWSER: ${text}`);
    }
  });

  const results = {
    test1_invoice_load_false_positive: null,
    test2_tab_switch_within_invoice: null,
    test3_real_edit_and_navigation: null,
    test4_save_resets_dirty_state: null
  };

  try {
    // Navigate to app
    console.log('🌐 Navigating to application...');
    await page.goto('http://localhost:3000/app.html', { waitUntil: 'networkidle2' });

    // Wait for app to load
    await page.waitForSelector('#invoice-form', { timeout: 15000 });
    await page.waitForTimeout(2000); // Allow unsaved changes system to initialize

    // ==========================================
    // TEST 1: Invoice Load False Positive Fix
    // ==========================================
    console.log('\n🧪 TEST 1: Invoice Load False Positive');
    console.log('======================================');

    // Create and save a test invoice
    console.log('📝 Creating test invoice...');
    await page.type('#vessel-name', 'Test Vessel for Fix Validation');
    await page.type('#customer-name', 'Test Customer for Fix Validation');
    await page.waitForTimeout(1500);

    // Save the invoice
    console.log('💾 Saving invoice...');
    await page.click('#save-invoice');
    await page.waitForTimeout(3000);

    // Accept the save dialog
    try {
      await page.waitForSelector('.prompt-modal', { timeout: 2000 });
      await page.type('.prompt-modal input', 'Test Invoice Fix Validation');
      await page.click('.prompt-modal .btn-primary');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('ℹ️ No save dialog (edit mode)');
    }

    // Clear forms and simulate loading saved invoice
    console.log('🔄 Simulating invoice load...');
    await page.evaluate(() => {
      // Clear forms
      document.getElementById('vessel-name').value = '';
      document.getElementById('customer-name').value = '';

      // Trigger change events to update state
      document.getElementById('vessel-name').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('customer-name').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(1000);

    // Repopulate forms (simulating invoice load)
    await page.evaluate(() => {
      document.getElementById('vessel-name').value = 'Test Vessel for Fix Validation';
      document.getElementById('customer-name').value = 'Test Customer for Fix Validation';

      // Trigger change events
      document.getElementById('vessel-name').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('customer-name').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(2000);

    // After invoice load, there should be NO unsaved changes warning
    const hasUnsavedAfterLoad = await page.evaluate(() => {
      return window.app?.unsavedChangesManager?.getHasUnsavedChanges() || false;
    });

    results.test1_invoice_load_false_positive = !hasUnsavedAfterLoad;
    console.log(`📊 RESULT 1: Invoice load false positive = ${hasUnsavedAfterLoad ? 'FAILED (still has bug)' : 'FIXED ✅'}`);

    // ==========================================
    // TEST 2: Tab Switch Within Invoice
    // ==========================================
    console.log('\n🧪 TEST 2: Tab Switch Within Same Invoice');
    console.log('==========================================');

    // Ensure we're on details tab
    await page.click('[data-tab="details"]');
    await page.waitForTimeout(500);

    // Try to switch to services tab (should NOT show warning)
    console.log('🔄 Switching to Services tab...');
    await page.click('[data-tab="services"]');
    await page.waitForTimeout(1000);

    // Check if warning dialog appeared (it shouldn't)
    const warningAfterTabSwitch = await page.$('.unsaved-changes-dialog') !== null;
    results.test2_tab_switch_within_invoice = !warningAfterTabSwitch;
    console.log(`📊 RESULT 2: Tab switch warning = ${warningAfterTabSwitch ? 'FAILED (still shows warning)' : 'FIXED ✅'}`);

    // Switch back to details
    await page.click('[data-tab="details"]');
    await page.waitForTimeout(500);

    // ==========================================
    // TEST 3: Real Edit and Navigation Warning
    // ==========================================
    console.log('\n🧪 TEST 3: Real Edit Should Show Warning');
    console.log('=======================================');

    // Make a real edit
    console.log('✏️ Making a real edit...');
    await page.focus('#vessel-name');
    await page.keyboard.selectAll();
    await page.type('#vessel-name', 'Modified Vessel Name - Real Edit');
    await page.waitForTimeout(1500);

    // Check unsaved changes state
    const hasUnsavedAfterEdit = await page.evaluate(() => {
      return window.app?.unsavedChangesManager?.getHasUnsavedChanges() || false;
    });

    console.log(`📊 Has unsaved changes after real edit: ${hasUnsavedAfterEdit}`);

    // Try to switch tabs - this SHOULD show warning
    console.log('🔄 Attempting tab switch after real edit...');
    await page.click('[data-tab="services"]');
    await page.waitForTimeout(1000);

    // Check if warning dialog appeared (it should)
    const warningAfterRealEdit = await page.$('.unsaved-changes-dialog') !== null;
    results.test3_real_edit_and_navigation = warningAfterRealEdit;
    console.log(`📊 RESULT 3: Warning after real edit = ${warningAfterRealEdit ? 'CORRECT ✅' : 'FAILED (no warning shown)'}`);

    // Cancel the dialog if it appeared
    if (warningAfterRealEdit) {
      await page.click('.unsaved-changes-dialog .btn-cancel');
      await page.waitForTimeout(500);
    }

    // ==========================================
    // TEST 4: Save Resets Dirty State
    // ==========================================
    console.log('\n🧪 TEST 4: Save Should Reset Dirty State');
    console.log('=======================================');

    // Save the changes
    console.log('💾 Saving changes...');
    await page.click('#save-invoice');
    await page.waitForTimeout(2000);

    // Accept success dialog
    try {
      await page.waitForSelector('.prompt-modal', { timeout: 2000 });
      await page.click('.prompt-modal .btn-primary');
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('ℹ️ No save success dialog');
    }

    // Check if unsaved changes is cleared
    const hasUnsavedAfterSave = await page.evaluate(() => {
      return window.app?.unsavedChangesManager?.getHasUnsavedChanges() || false;
    });

    results.test4_save_resets_dirty_state = !hasUnsavedAfterSave;
    console.log(`📊 RESULT 4: Dirty state after save = ${hasUnsavedAfterSave ? 'FAILED (still dirty)' : 'FIXED ✅'}`);

    // ==========================================
    // FINAL RESULTS
    // ==========================================
    console.log('\n📊 FINAL TEST RESULTS');
    console.log('=====================');
    console.log(`✅ Issue 1 - Invoice Load False Positive: ${results.test1_invoice_load_false_positive ? 'FIXED' : 'FAILED'}`);
    console.log(`✅ Issue 2 - Tab Switch Within Invoice: ${results.test2_tab_switch_within_invoice ? 'FIXED' : 'FAILED'}`);
    console.log(`✅ Issue 3 - Real Edit Shows Warning: ${results.test3_real_edit_and_navigation ? 'WORKING' : 'BROKEN'}`);
    console.log(`✅ Issue 4 - Save Resets Dirty State: ${results.test4_save_resets_dirty_state ? 'WORKING' : 'BROKEN'}`);

    const allTestsPassed = Object.values(results).every(result => result === true);
    console.log(`\n🎯 OVERALL RESULT: ${allTestsPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);

    if (allTestsPassed) {
      console.log('\n🎉 SUCCESS: Both critical bugs have been fixed!');
      console.log('✅ No false positives on invoice load');
      console.log('✅ No warnings on intra-invoice tab switches');
      console.log('✅ Real unsaved changes properly detected');
    } else {
      console.log('\n⚠️ Some issues remain - check individual test results above');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n📊 Browser kept open for manual inspection');
    console.log('📊 Check DevTools Console for detailed logs');
    // await browser.close();
  }
}

// Run the comprehensive test
testUnsavedChangesFixes().catch(console.error);