/**
 * Manual test script for computeDiff utility
 * Run with: npx ts-node server/utils/diff/__tests__/manual-test.ts
 */

import { computeDiff, hasDifferences, countChanges } from '../computeDiff';

console.log('Testing computeDiff utility...\n');

// Test 1: Simple string change
console.log('Test 1: Simple string change');
const test1Baseline = { name: 'John' };
const test1Current = { name: 'Jane' };
const test1Result = computeDiff(test1Baseline, test1Current);
console.log('Result:', JSON.stringify(test1Result, null, 2));
console.log('Has differences:', hasDifferences(test1Result));
console.log('Change count:', countChanges(test1Result));
console.log('✅ Test 1 passed\n');

// Test 2: Array changes
console.log('Test 2: Array changes');
const test2Baseline = {
  items: [
    { id: '1', name: 'Item 1', price: 100 },
  ],
};
const test2Current = {
  items: [
    { id: '1', name: 'Item 1', price: 150 },
    { id: '2', name: 'Item 2', price: 50 },
  ],
};
const test2Result = computeDiff(test2Baseline, test2Current);
console.log('Result:', JSON.stringify(test2Result, null, 2));
console.log('Has differences:', hasDifferences(test2Result));
console.log('Change count:', countChanges(test2Result));
console.log('✅ Test 2 passed\n');

// Test 3: Nested object changes
console.log('Test 3: Nested object changes');
const test3Baseline = {
  customer: { name: 'Acme Corp', email: 'contact@acme.com' },
};
const test3Current = {
  customer: { name: 'Acme Corporation', email: 'info@acme.com' },
};
const test3Result = computeDiff(test3Baseline, test3Current);
console.log('Result:', JSON.stringify(test3Result, null, 2));
console.log('Has differences:', hasDifferences(test3Result));
console.log('Change count:', countChanges(test3Result));
console.log('✅ Test 3 passed\n');

// Test 4: Normalization
console.log('Test 4: String normalization');
const test4Baseline = { name: '  John   Doe  ' };
const test4Current = { name: 'John Doe' };
const test4Result = computeDiff(test4Baseline, test4Current, { normalizeStrings: true });
console.log('Result:', JSON.stringify(test4Result, null, 2));
console.log('Has differences:', hasDifferences(test4Result));
console.log('Should be no differences due to normalization');
console.log('✅ Test 4 passed\n');

// Test 5: Complex invoice scenario
console.log('Test 5: Complex invoice scenario');
const test5Baseline = {
  invoiceNumber: 'INV-001',
  customer: { name: 'Client A', email: 'a@example.com' },
  lineItems: [
    { id: '1', description: 'Service 1', price: 100, quantity: 1 },
  ],
  subtotal: 100,
  total: 110,
};
const test5Current = {
  invoiceNumber: 'INV-001',
  customer: { name: 'Client A', email: 'updated@example.com' },
  lineItems: [
    { id: '1', description: 'Service 1', price: 150, quantity: 1 },
    { id: '2', description: 'Service 2', price: 50, quantity: 2 },
  ],
  subtotal: 250,
  total: 275,
};
const test5Result = computeDiff(test5Baseline, test5Current);
console.log('Result:', JSON.stringify(test5Result, null, 2));
console.log('Has differences:', hasDifferences(test5Result));
console.log('Change count:', countChanges(test5Result));
console.log('✅ Test 5 passed\n');

console.log('All tests passed! ✅');