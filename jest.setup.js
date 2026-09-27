import '@testing-library/jest-dom'
import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs', 'tests')

beforeAll(() => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
})

// Suppress console errors/warnings in tests unless explicitly testing for them
const originalError = console.error
const originalWarn = console.warn

beforeEach(() => {
  console.error = jest.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return
    }
    originalError.call(console, ...args)
  })

  console.warn = jest.fn((...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning:')
    ) {
      return
    }
    originalWarn.call(console, ...args)
  })
})

afterEach(() => {
  console.error = originalError
  console.warn = originalWarn
  jest.clearAllMocks()
})

global.matchMedia = global.matchMedia || function () {
  return {
    matches: false,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }
}
