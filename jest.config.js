const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './glowmetrics_fresh',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/glowmetrics_fresh/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'glowmetrics_fresh/**/*.{js,jsx,ts,tsx}',
    '!glowmetrics_fresh/**/*.d.ts',
    '!glowmetrics_fresh/**/*.stories.{js,jsx,ts,tsx}',
    '!glowmetrics_fresh/**/__tests__/**',
    '!glowmetrics_fresh/.next/**',
    '!glowmetrics_fresh/node_modules/**',
    '!glowmetrics_fresh/coverage/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'glowmetrics_fresh/test-results',
        outputName: 'junit.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathAsClassName: true,
      },
    ],
  ],
  testTimeout: 10000,
  verbose: true,
  bail: false,
}

module.exports = createJestConfig(customJestConfig)
