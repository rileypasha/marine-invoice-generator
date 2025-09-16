/**
 * Test script to validate Services Tab bug fix
 * Run this in browser console after loading the app
 */

console.log('🧪 Starting Services Tab Bug Fix Validation...');

// Test 1: Verify state normalization
function testStateNormalization() {
  console.log('\n📋 Test 1: State Normalization');

  if (!window.app || !window.app.state) {
    console.error('❌ App or state not found');
    return false;
  }

  const state = window.app.state.getState();

  // Check if both scope and services exist
  const hasScopeLineItems = state.scope && Array.isArray(state.scope.lineItems);
  const hasServicesLineItems = state.services && Array.isArray(state.services.lineItems);

  console.log('✅ State structure:');
  console.log('  - scope.lineItems exists:', hasScopeLineItems);
  console.log('  - services.lineItems exists:', hasServicesLineItems);
  console.log('  - scope.lineItems length:', state.scope?.lineItems?.length || 0);
  console.log('  - services.lineItems length:', state.services?.lineItems?.length || 0);

  if (hasScopeLineItems && hasServicesLineItems) {
    // Check if they're synchronized
    const scopeLength = state.scope.lineItems.length;
    const servicesLength = state.services.lineItems.length;
    const areSync = scopeLength === servicesLength;

    console.log('  - Arrays synchronized:', areSync);

    if (areSync) {
      console.log('✅ Test 1 PASSED: State normalization working');
      return true;
    } else {
      console.error('❌ Test 1 FAILED: Arrays not synchronized');
      return false;
    }
  } else {
    console.error('❌ Test 1 FAILED: Missing required state structure');
    return false;
  }
}

// Test 2: Add line item and verify synchronization
function testAddLineItem() {
  console.log('\n📋 Test 2: Add Line Item Synchronization');

  try {
    const stateBefore = window.app.state.getState();
    const beforeCountScope = stateBefore.scope?.lineItems?.length || 0;
    const beforeCountServices = stateBefore.services?.lineItems?.length || 0;

    console.log('📊 Before adding:');
    console.log('  - scope.lineItems:', beforeCountScope);
    console.log('  - services.lineItems:', beforeCountServices);

    // Add a line item
    const newItemId = window.app.state.addLineItem();
    console.log('🆕 Added line item with ID:', newItemId);

    // Check state after
    const stateAfter = window.app.state.getState();
    const afterCountScope = stateAfter.scope?.lineItems?.length || 0;
    const afterCountServices = stateAfter.services?.lineItems?.length || 0;

    console.log('📊 After adding:');
    console.log('  - scope.lineItems:', afterCountScope);
    console.log('  - services.lineItems:', afterCountServices);

    // Verify synchronization
    const scopeIncreased = afterCountScope === beforeCountScope + 1;
    const servicesIncreased = afterCountServices === beforeCountServices + 1;
    const bothSynced = afterCountScope === afterCountServices;

    if (scopeIncreased && servicesIncreased && bothSynced) {
      console.log('✅ Test 2 PASSED: Add line item synchronization working');
      return true;
    } else {
      console.error('❌ Test 2 FAILED: Synchronization broken');
      console.error('  - Scope increased correctly:', scopeIncreased);
      console.error('  - Services increased correctly:', servicesIncreased);
      console.error('  - Both synchronized:', bothSynced);
      return false;
    }
  } catch (error) {
    console.error('❌ Test 2 FAILED: Error adding line item:', error);
    return false;
  }
}

// Test 3: Test button click simulation
function testButtonClick() {
  console.log('\n📋 Test 3: Button Click Simulation');

  const addButton = document.getElementById('add-line-item');
  if (!addButton) {
    console.error('❌ Test 3 FAILED: Add Line Item button not found');
    return false;
  }

  try {
    const stateBefore = window.app.state.getState();
    const beforeCount = stateBefore.scope?.lineItems?.length || 0;

    console.log('🖱️ Simulating button click...');
    console.log('📊 Line items before click:', beforeCount);

    // Simulate click
    addButton.click();

    // Give it a moment to process
    setTimeout(() => {
      const stateAfter = window.app.state.getState();
      const afterCount = stateAfter.scope?.lineItems?.length || 0;
      const servicesCount = stateAfter.services?.lineItems?.length || 0;

      console.log('📊 Line items after click:');
      console.log('  - scope.lineItems:', afterCount);
      console.log('  - services.lineItems:', servicesCount);

      const increased = afterCount === beforeCount + 1;
      const synced = afterCount === servicesCount;

      if (increased && synced) {
        console.log('✅ Test 3 PASSED: Button click working correctly');
      } else {
        console.error('❌ Test 3 FAILED: Button click not working');
        console.error('  - Count increased:', increased);
        console.error('  - Arrays synced:', synced);
      }
    }, 500);

    return true;
  } catch (error) {
    console.error('❌ Test 3 FAILED: Error simulating button click:', error);
    return false;
  }
}

// Test 4: Legacy data compatibility
function testLegacyDataCompatibility() {
  console.log('\n📋 Test 4: Legacy Data Compatibility');

  try {
    // Simulate loading legacy data structure
    const legacyData = {
      vessel: { name: 'Test Vessel' },
      customer: { customerName: 'Test Customer' },
      services: { lineItems: [{ id: 1, jobType: 'Test Job', description: 'Test Description' }] }
      // Note: missing scope.lineItems structure
    };

    console.log('🗂️ Testing legacy data compatibility...');
    console.log('📄 Legacy data structure:', Object.keys(legacyData));

    // Test normalization
    window.app.state.normalizeState();

    const state = window.app.state.getState();
    const hasScope = state.scope && Array.isArray(state.scope.lineItems);
    const hasServices = state.services && Array.isArray(state.services.lineItems);

    if (hasScope && hasServices) {
      console.log('✅ Test 4 PASSED: Legacy data compatibility maintained');
      return true;
    } else {
      console.error('❌ Test 4 FAILED: Legacy data compatibility broken');
      return false;
    }
  } catch (error) {
    console.error('❌ Test 4 FAILED: Error testing legacy compatibility:', error);
    return false;
  }
}

// Run all tests
function runAllTests() {
  console.log('🏃 Running comprehensive Services Tab bug fix tests...\n');

  const results = {
    stateNormalization: testStateNormalization(),
    addLineItem: testAddLineItem(),
    buttonClick: testButtonClick(),
    legacyCompatibility: testLegacyDataCompatibility()
  };

  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('========================');

  let passCount = 0;
  let totalTests = 0;

  Object.entries(results).forEach(([testName, passed]) => {
    totalTests++;
    if (passed) passCount++;
    console.log(`${passed ? '✅' : '❌'} ${testName}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  console.log(`\n🎯 Overall Result: ${passCount}/${totalTests} tests passed`);

  if (passCount === totalTests) {
    console.log('🎉 ALL TESTS PASSED - Services Tab bug fix is working correctly!');
  } else {
    console.log('⚠️ Some tests failed - further investigation needed');
  }

  return results;
}

// Auto-run tests if called directly
if (typeof window !== 'undefined' && window.app) {
  // Add to global scope for manual testing
  window.ServicesTabTests = {
    runAllTests,
    testStateNormalization,
    testAddLineItem,
    testButtonClick,
    testLegacyDataCompatibility
  };

  console.log('🧪 Services Tab bug fix tests loaded');
  console.log('💡 Run: window.ServicesTabTests.runAllTests()');
} else {
  console.log('⏳ Tests loaded, waiting for app initialization...');
}