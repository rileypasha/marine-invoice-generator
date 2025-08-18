const { toMatchImageSnapshot } = require('jest-image-snapshot');

expect.extend({ toMatchImageSnapshot });

// Global test setup
beforeAll(async () => {
  console.log('Starting visual regression tests...');
});

afterAll(async () => {
  console.log('Visual regression tests completed.');
});

// Ensure consistent viewport
beforeEach(async () => {
  if (global.page) {
    await page.setViewport({ width: 1440, height: 900 });
  }
});