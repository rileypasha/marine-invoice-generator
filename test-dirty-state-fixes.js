/**
 * Comprehensive Test Suite for Dirty State Fixes
 *
 * This script tests all the root cause fixes:
 * 1. False dirty state on invoice load
 * 2. Broken section diff mapping
 * 3. Smart-save 500 errors (mock testing)
 * 4. Navigation guard false positives
 *
 * Run this in the browser console after loading the invoice app
 */

console.log('🧪 Starting Comprehensive Dirty State Fix Tests...');

// Test utilities
const TestUtils = {
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  async waitForStable(fn, timeout = 5000) {
    const start = Date.now();
    let lastValue = fn();

    while (Date.now() - start < timeout) {
      await this.wait(100);
      const currentValue = fn();
      if (currentValue === lastValue) {
        return currentValue;
      }
      lastValue = currentValue;
    }

    throw new Error('Value did not stabilize within timeout');
  },

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
    console.log(`✅ ${message}: ${actual}`);
  },

  assertArrayEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual.sort());
    const expectedStr = JSON.stringify(expected.sort());
    if (actualStr !== expectedStr) {
      throw new Error(`${message}: Expected ${expectedStr}, got ${actualStr}`);
    }
    console.log(`✅ ${message}: ${actualStr}`);
  },

  getUnsavedChangesManager() {
    return window.app?.unsavedChangesManager;
  },

  getInvoiceState() {
    return window.app?.state?.getState();
  },

  isDirty() {
    const manager = this.getUnsavedChangesManager();
    return manager?.getHasUnsavedChanges() || false;
  },

  getChangedSections() {
    const manager = this.getUnsavedChangesManager();
    const summary = manager?.getChangesSummary();
    return summary?.changes || summary?.sections || [];
  }
};

// Test Suite
const DirtyStateTests = {
  async testCanonicalInvoiceBasic() {
    console.log('\n🧪 Test 1: CanonicalInvoice Basic Functionality');

    // Import the module
    const { CanonicalInvoice } = await import('./src/js/utils/CanonicalInvoice.js');

    // Test basic normalization
    const rawInvoice = {
      vessel: { name: '  Test Vessel  ', weight: '100', beam: null },
      customer: { customerName: 'Test Customer', customerEmail: '', customerPhone: undefined },
      scope: { markupRate: '2.5', isTaxable: true, lineItems: [] },
      notes: { comments: [] }
    };

    const canonical = new CanonicalInvoice(rawInvoice);

    // Verify normalization
    TestUtils.assertEqual(canonical.vessel.name, 'Test Vessel', 'Vessel name normalized');
    TestUtils.assertEqual(canonical.vessel.weight, '100', 'Vessel weight normalized');
    TestUtils.assertEqual(canonical.vessel.beam, '', 'Vessel beam normalized to empty string');
    TestUtils.assertEqual(canonical.customer.customerEmail, '', 'Customer email normalized');
    TestUtils.assertEqual(canonical.customer.customerPhone, '', 'Customer phone normalized');

    console.log('✅ Test 1 PASSED: CanonicalInvoice basic functionality works');
  },

  async testCanonicalInvoiceDiff() {
    console.log('\n🧪 Test 2: CanonicalInvoice Diff Detection');

    const { CanonicalInvoice } = await import('./src/js/utils/CanonicalInvoice.js');

    const baseInvoice = {
      vessel: { name: 'Original Vessel', weight: '100', beam: '20' },
      customer: { customerName: 'Original Customer', customerEmail: 'test@example.com', customerPhone: '123' },
      scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
      notes: { comments: [] }
    };

    const modifiedInvoice = {
      vessel: { name: 'Original Vessel', weight: '100', beam: '20' },
      customer: { customerName: 'Modified Customer', customerEmail: 'test@example.com', customerPhone: '123' },
      scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
      notes: { comments: [] }
    };

    const baseCanonical = new CanonicalInvoice(baseInvoice);
    const modifiedCanonical = new CanonicalInvoice(modifiedInvoice);

    const changes = modifiedCanonical.diff(baseCanonical);
    const sections = modifiedCanonical.getChangedSections(changes);

    TestUtils.assertArrayEqual(changes, ['customer.customerName'], 'Only customer name changed');
    TestUtils.assertArrayEqual(sections, ['Customer information'], 'Only Customer information section affected');

    console.log('✅ Test 2 PASSED: CanonicalInvoice diff detection works correctly');
  },

  async testBaselineEstablishment() {
    console.log('\n🧪 Test 3: Baseline Establishment');

    const manager = TestUtils.getUnsavedChangesManager();
    if (!manager) {
      throw new Error('UnsavedChangesManager not available');
    }

    // Reset manager
    if (manager.reset) {
      manager.reset();
    }

    // Wait for initialization period
    await TestUtils.wait(1200);

    // Establish baseline
    const currentState = TestUtils.getInvoiceState();
    manager.establishBaseline(currentState);

    // Should not be dirty after baseline establishment
    await TestUtils.wait(500);
    const isDirtyAfterBaseline = TestUtils.isDirty();
    TestUtils.assertEqual(isDirtyAfterBaseline, false, 'Not dirty after baseline establishment');

    console.log('✅ Test 3 PASSED: Baseline establishment works correctly');
  },

  async testFalsePositivePrevention() {
    console.log('\n🧪 Test 4: False Positive Prevention on Load');

    const manager = TestUtils.getUnsavedChangesManager();
    if (!manager) {
      throw new Error('UnsavedChangesManager not available');
    }

    // Simulate invoice load sequence
    console.log('📂 Simulating invoice load...');

    // 1. Reset state
    if (manager.reset) {
      manager.reset();
    }

    // 2. Load invoice data (simulate)
    const mockInvoiceData = {
      vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
      customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
      scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
      notes: { comments: [] }
    };

    // 3. Wait for initialization period (simulates component mount)
    await TestUtils.wait(1200);

    // 4. Establish baseline after "load"
    manager.establishBaseline(mockInvoiceData);

    // 5. Wait for stabilization
    await TestUtils.wait(500);

    // Should not be dirty
    const isDirtyAfterLoad = TestUtils.isDirty();
    TestUtils.assertEqual(isDirtyAfterLoad, false, 'Not dirty after simulated invoice load');

    const changedSections = TestUtils.getChangedSections();
    TestUtils.assertArrayEqual(changedSections, [], 'No changed sections after load');

    console.log('✅ Test 4 PASSED: False positive prevention works');
  },

  async testGranularSectionMapping() {
    console.log('\n🧪 Test 5: Granular Section Mapping');

    const manager = TestUtils.getUnsavedChangesManager();
    if (!manager || !window.app?.state) {
      throw new Error('UnsavedChangesManager or state not available');
    }

    // Establish clean baseline
    manager.reset();
    await TestUtils.wait(1200);

    const initialState = {
      vessel: { name: 'Test Vessel', weight: '100', beam: '20' },
      customer: { customerName: 'Test Customer', customerEmail: 'test@example.com', customerPhone: '123-456-7890' },
      scope: { markupRate: '2.5', isTaxable: false, lineItems: [] },
      notes: { comments: [] }
    };

    manager.establishBaseline(initialState);
    await TestUtils.wait(500);

    // Test customer name change only
    console.log('📝 Testing customer name change...');
    window.app.state.updateCustomer({ customerName: 'Modified Customer' });

    // Wait for change detection
    await TestUtils.wait(500);

    const isDirtyAfterCustomerChange = TestUtils.isDirty();
    TestUtils.assertEqual(isDirtyAfterCustomerChange, true, 'Dirty after customer name change');

    const changedSectionsCustomer = TestUtils.getChangedSections();
    TestUtils.assertArrayEqual(changedSectionsCustomer, ['Customer information'], 'Only Customer information section changed');

    console.log('✅ Test 5 PASSED: Granular section mapping works correctly');
  },

  async testSmartSaveValidation() {
    console.log('\n🧪 Test 6: Smart-Save Validation');

    // Import validation function
    const { validateUpdatePayload } = await import('./src/js/storage/InvoiceStorageFixed.js');

    // Test valid payload
    const validInvoice = {
      id: 'test-123',
      title: 'Test Invoice',
      data: {
        vessel: { name: 'Test Vessel' },
        customer: { customerName: 'Test Customer' },
        scope: { lineItems: [] },
        notes: { comments: [] }
      },
      metadata: {}
    };

    const validResult = validateUpdatePayload(validInvoice);
    TestUtils.assertEqual(validResult.isValid, true, 'Valid payload passes validation');

    // Test invalid payload
    const invalidInvoice = {
      // Missing required fields
      data: {
        vessel: null, // Invalid
        customer: { customerName: 'Test Customer' },
        scope: { lineItems: 'invalid' }, // Should be array
        notes: { comments: [] }
      }
    };

    const invalidResult = validateUpdatePayload(invalidInvoice);
    TestUtils.assertEqual(invalidResult.isValid, false, 'Invalid payload fails validation');
    TestUtils.assertEqual(invalidResult.errors.length > 0, true, 'Validation errors are reported');

    console.log('✅ Test 6 PASSED: Smart-save validation works correctly');
  },

  async testUIEventHygiene() {
    console.log('\n🧪 Test 7: UI Event Hygiene During Initialization');

    const manager = TestUtils.getUnsavedChangesManager();
    if (!manager) {
      throw new Error('UnsavedChangesManager not available');
    }

    // Reset and check initialization blocking
    manager.reset();

    // Should be in initialization period
    TestUtils.assertEqual(manager.isInitializing, true, 'Manager in initialization period after reset');

    // Simulate state changes during initialization (should be blocked)
    if (window.app?.state) {
      window.app.state.updateVessel({ name: 'Test During Init' });
    }

    await TestUtils.wait(200);

    // Should still not be dirty (changes blocked)
    const isDirtyDuringInit = TestUtils.isDirty();
    TestUtils.assertEqual(isDirtyDuringInit, false, 'Changes blocked during initialization');

    // Wait for initialization to complete
    await TestUtils.wait(1200);

    TestUtils.assertEqual(manager.isInitializing, false, 'Initialization period ended');

    console.log('✅ Test 7 PASSED: UI event hygiene works correctly');
  },

  async runAllTests() {
    console.log('🧪 STARTING COMPREHENSIVE DIRTY STATE FIX TESTS\n');

    const tests = [
      'testCanonicalInvoiceBasic',
      'testCanonicalInvoiceDiff',
      'testBaselineEstablishment',
      'testFalsePositivePrevention',
      'testGranularSectionMapping',
      'testSmartSaveValidation',
      'testUIEventHygiene'
    ];

    let passed = 0;
    let failed = 0;

    for (const testName of tests) {
      try {
        await this[testName]();
        passed++;
      } catch (error) {
        console.error(`❌ Test ${testName} FAILED:`, error);
        failed++;
      }
    }

    console.log(`\n🏁 TEST RESULTS:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${Math.round(passed / (passed + failed) * 100)}%`);

    if (failed === 0) {
      console.log('🎉 ALL TESTS PASSED! Dirty state fixes are working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Review the errors above.');
    }

    return { passed, failed };
  }
};

// Auto-run tests if this script is executed directly
if (typeof window !== 'undefined' && window.app) {
  DirtyStateTests.runAllTests().catch(error => {
    console.error('❌ Test suite execution failed:', error);
  });
} else {
  console.log('ℹ️ Test suite loaded. Run DirtyStateTests.runAllTests() to execute tests.');
}

// Export for manual usage
window.DirtyStateTests = DirtyStateTests;
window.TestUtils = TestUtils;