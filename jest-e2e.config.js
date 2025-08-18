module.exports = {
  preset: 'jest-puppeteer',
  testEnvironment: 'jest-environment-puppeteer',
  testMatch: ['**/test/e2e/**/*.test.js'],
  setupFilesAfterEnv: ['./test/setup.js'],
  testTimeout: 30000,
  verbose: true
};