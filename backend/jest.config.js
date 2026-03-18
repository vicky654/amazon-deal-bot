/** @type {import('jest').Config} */
module.exports = {
  testEnvironment:       'node',
  setupFiles: ['./jest.setup.js'],
  testMatch:             ['**/__tests__/**/*.test.js'],
  testTimeout:           30000,
  collectCoverageFrom: [
    'src/**/*.js',
    'utils/**/*.js',
    '!src/**/__mocks__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: { lines: 70, functions: 70, branches: 60 },
  },
  // Isolate modules between test files
  clearMocks:   true,
  resetMocks:   false,
  restoreMocks: true,
  // Verbose output for CI
  verbose: true,
};
