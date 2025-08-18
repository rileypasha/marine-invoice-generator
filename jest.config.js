module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/unit/**/*.test.js'],
  collectCoverageFrom: [
    'src/js/**/*.js',
    '!src/js/app.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};