/**
 * Simple validation script to test the duplicate prevention fix
 * This runs outside Jest to avoid the source map issues
 */

// Mock browser APIs
global.requestAnimationFrame = (callback) => {
  setTimeout(callback, 0);
  return 1;
};

// Mock dependencies
global.TaxCalculator = {
  getDefaultTaxConfig: () => ({ taxStatus: 'taxable', taxRate: 0.0875 }),
  calculateLineTax: () => 0
};

global.TaxValidator = {
  validateTaxRate: () => true,
  validateTaxStatus: () => true
};

global.MarkupValidator = {
  validateCustomMarkup: () => ({ isValid: true, sanitizedValue: 2.5 })
};

// Import and test
const { InvoiceState } = require('./src/js/state/InvoiceState.js');

function runValidation() {
  console.log('🧪 VALIDATION: Services Tab Duplicate Prevention Fix');
  console.log('=================================================\n');

  const invoiceState = new InvoiceState();
  let allTestsPassed = true;

  // Test 1: Basic addition
  console.log('TEST 1: Basic Line Item Addition');
  const initialCount = invoiceState.state.scope.lineItems.length;
  const id1 = invoiceState.addLineItem();

  if (id1 !== null && invoiceState.state.scope.lineItems.length === initialCount + 1) {
    console.log('✅ PASS: Single line item added correctly');
  } else {
    console.log('❌ FAIL: Basic addition failed');
    allTestsPassed = false;
  }

  // Test 2: Concurrent protection
  console.log('\nTEST 2: Concurrent Operation Protection');
  invoiceState.isAddingLineItem = true;
  const blockedResult = invoiceState.addLineItem();

  if (blockedResult === null) {
    console.log('✅ PASS: Concurrent operation blocked');
  } else {
    console.log('❌ FAIL: Concurrent operation not blocked');
    allTestsPassed = false;
  }

  invoiceState.isAddingLineItem = false; // Reset

  // Test 3: Unique ID generation
  console.log('\nTEST 3: Unique ID Generation');
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const id = invoiceState.addLineItem();
    if (id !== null) ids.push(id);
  }

  const uniqueIds = [...new Set(ids)];
  if (ids.length === 5 && uniqueIds.length === 5) {
    console.log('✅ PASS: All IDs are unique');
  } else {
    console.log('❌ FAIL: Duplicate IDs detected');
    console.log('IDs:', ids);
    allTestsPassed = false;
  }

  // Test 4: State integrity
  console.log('\nTEST 4: State Integrity Protection');
  invoiceState.state.scope.lineItems = null;
  const id4 = invoiceState.addLineItem();

  if (id4 !== null && Array.isArray(invoiceState.state.scope.lineItems)) {
    console.log('✅ PASS: State corruption handled gracefully');
  } else {
    console.log('❌ FAIL: State corruption not handled');
    allTestsPassed = false;
  }

  // Final result
  console.log('\n' + '='.repeat(50));
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED - Fix is working correctly!');
    console.log('✅ Duplicate line item prevention implemented successfully');
  } else {
    console.log('❌ SOME TESTS FAILED - Fix needs more work');
  }
  console.log('='.repeat(50));

  return allTestsPassed;
}

// Run validation
try {
  runValidation();
} catch (error) {
  console.error('❌ Validation failed with error:', error);
}