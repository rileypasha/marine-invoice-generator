module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['**/test/visual/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/setup.js'],
  testTimeout: 30000,
  verbose: true,
  rootDir: '.'
};