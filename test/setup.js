const puppeteer = require('puppeteer');

// Increase timeout for all tests
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  console.log('Starting E2E tests...');
});

// Global teardown
afterAll(async () => {
  console.log('E2E tests completed.');
});