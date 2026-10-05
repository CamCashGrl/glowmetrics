import '@testing-library/jest-dom'
import fs from 'fs'
import path from 'path'

// Load environment variables from .env.local for tests
const envPath = path.resolve(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match && !line.startsWith('#')) {
      process.env[match[1]] = match[2]
    }
  })
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}))

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Suppress console errors during tests unless explicitly needed
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}
