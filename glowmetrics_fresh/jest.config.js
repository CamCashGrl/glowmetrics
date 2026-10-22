// Pin the host timezone for date-sensitive tests and aggregate fingerprints.
process.env.TZ = 'UTC'

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.jsx',
    '**/*.test.js',
    '**/*.test.jsx',
  ],
  collectCoverageFrom: [
    'lib/**/*.js',
    'app/**/*.js',
    'app/**/*.jsx',
    '!app/**/page.js',
    '!app/**/layout.js',
    '!**/*.test.js',
  ],
}

module.exports = createJestConfig(customJestConfig)
