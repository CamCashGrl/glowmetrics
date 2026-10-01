#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const logsDir = path.join(rootDir, 'logs', 'tests')
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const logFile = path.join(logsDir, `${timestamp}.log`)

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

console.log(`🧪 CamCash Test Suite - ${new Date().toLocaleString()}`)
console.log(`📝 Logging to: ${logFile}\n`)

const testConfig = {
  api: 'npm run test -- app/api',
  ui: 'npm run test -- app/components',
  formulas: 'npm run test -- lib/analytics',
  all: 'npm run test:ci',
}

const suite = process.argv[2] || 'all'
const testCmd = testConfig[suite] || testConfig.all

if (!testConfig[suite]) {
  console.warn(`⚠️  Unknown suite: ${suite}. Running full test suite.`)
}

try {
  const startTime = Date.now()

  // Run tests and capture output
  const output = execSync(testCmd, {
    cwd: path.join(rootDir, 'glowmetrics_fresh'),
    encoding: 'utf-8',
    stdio: 'pipe',
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  const logEntry = {
    timestamp: new Date().toISOString(),
    suite,
    status: 'PASS',
    duration: `${duration}s`,
    output: output.slice(-500), // Last 500 chars
  }

  fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n')

  console.log(`✅ Tests passed in ${duration}s`)
  console.log(`📊 Results saved to: ${logFile}`)

  process.exit(0)
} catch (error) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  const logEntry = {
    timestamp: new Date().toISOString(),
    suite,
    status: 'FAIL',
    duration: `${duration}s`,
    error: error.stderr?.toString() || error.message,
    output: error.stdout?.toString().slice(-500) || '',
  }

  fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n')

  console.error(`❌ Tests failed after ${duration}s`)
  console.error(`📊 Results saved to: ${logFile}`)
  console.error(`\n${error.message}`)

  process.exit(1)
}
