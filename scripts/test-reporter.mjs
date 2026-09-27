#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const logsDir = path.join(rootDir, 'logs', 'tests')
const resultsDir = path.join(rootDir, 'glowmetrics_fresh', 'test-results')

console.log('📊 CamCash Test Reporter\n')

// Ensure directories exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true })
}

// Read all test logs
const logs = fs.readdirSync(logsDir)
  .filter(f => f.endsWith('.log'))
  .sort()
  .reverse()
  .slice(0, 50) // Last 50 runs

const report = {
  generatedAt: new Date().toISOString(),
  totalRuns: logs.length,
  recentRuns: [],
  summary: {
    passed: 0,
    failed: 0,
    averageDuration: 0,
  },
}

let totalDuration = 0

logs.forEach(logFile => {
  try {
    const content = fs.readFileSync(path.join(logsDir, logFile), 'utf-8')
    const entry = JSON.parse(content.split('\n')[0])

    report.recentRuns.push({
      timestamp: entry.timestamp,
      suite: entry.suite,
      status: entry.status,
      duration: entry.duration,
    })

    if (entry.status === 'PASS') {
      report.summary.passed++
    } else {
      report.summary.failed++
    }

    const durationNum = parseFloat(entry.duration)
    totalDuration += durationNum
  } catch (err) {
    console.warn(`⚠️  Failed to parse ${logFile}: ${err.message}`)
  }
})

report.summary.averageDuration = (totalDuration / logs.length).toFixed(2) + 's'

// Write summary JSON
fs.writeFileSync(
  path.join(resultsDir, 'summary.json'),
  JSON.stringify(report, null, 2)
)

// Write HTML report
const htmlReport = `
<!DOCTYPE html>
<html>
<head>
  <title>CamCash Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #050713; color: #D7D9EA; margin: 0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #16F4FF; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
    .stat { background: rgba(12, 16, 34, 0.78); border: 1px solid rgba(255,255,255,0.09); border-radius: 12px; padding: 20px; }
    .stat-value { font-size: 2em; font-weight: bold; color: #16F4FF; }
    .stat-label { color: #8D93AA; font-size: 0.9em; margin-top: 5px; }
    .pass { color: #00D968; }
    .fail { color: #FF2BAE; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.09); }
    th { background: rgba(22,244,255,0.1); color: #16F4FF; font-weight: 600; }
    tr:hover { background: rgba(22,244,255,0.05); }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 CamCash Test Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>

    <div class="summary">
      <div class="stat">
        <div class="stat-value">${report.recentRuns.length}</div>
        <div class="stat-label">Total Runs</div>
      </div>
      <div class="stat">
        <div class="stat-value pass">${report.summary.passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value fail">${report.summary.failed}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${report.summary.averageDuration}</div>
        <div class="stat-label">Avg Duration</div>
      </div>
    </div>

    <h2>Recent Runs</h2>
    <table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Suite</th>
          <th>Status</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${report.recentRuns.map(run => `
          <tr>
            <td>${new Date(run.timestamp).toLocaleString()}</td>
            <td>${run.suite}</td>
            <td class="${run.status === 'PASS' ? 'pass' : 'fail'}">${run.status}</td>
            <td>${run.duration}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
`

fs.writeFileSync(
  path.join(resultsDir, 'report.html'),
  htmlReport
)

console.log(`✅ Report generated:`)
console.log(`   Summary: ${path.join(resultsDir, 'summary.json')}`)
console.log(`   HTML: ${path.join(resultsDir, 'report.html')}`)
console.log(`\n📈 Summary:`)
console.log(`   Total runs: ${report.recentRuns.length}`)
console.log(`   Passed: ${report.summary.passed}`)
console.log(`   Failed: ${report.summary.failed}`)
console.log(`   Avg duration: ${report.summary.averageDuration}`)
