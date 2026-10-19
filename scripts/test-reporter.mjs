import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'glowmetrics_fresh', 'test-results')
fs.mkdirSync(dir, { recursive: true })
let results
try { results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8')) }
catch { console.error('No Jest results available; tests did not produce a report.'); process.exit(1) }
const durationMs = (results.testResults || []).reduce((sum, suite) => sum + Math.max(0, (suite.endTime || suite.perfStats?.end || 0) - (suite.startTime || suite.perfStats?.start || 0)), 0)
const summary = {
  generatedAt: new Date().toISOString(), success: results.success === true,
  numTotalTests: results.numTotalTests, numPassedTests: results.numPassedTests,
  numFailedTests: results.numFailedTests, numPendingTests: results.numPendingTests,
  numTodoTests: results.numTodoTests, durationMs,
}
fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2))
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>CamCash test results</title><style>body{background:#050713;color:#D7D9EA;font:16px system-ui;padding:32px}h1{color:#16F4FF}pre{white-space:pre-wrap}</style><h1>CamCash test results</h1><p>${escape(summary.numPassedTests)} / ${escape(summary.numTotalTests)} passed; ${escape(summary.numFailedTests)} failed; ${escape(summary.numPendingTests)} pending.</p><pre>${escape(JSON.stringify(summary, null, 2))}</pre></html>`
fs.writeFileSync(path.join(dir, 'report.html'), html)
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\nCamCash: ${summary.numPassedTests}/${summary.numTotalTests} tests passed; ${summary.numFailedTests} failed, ${summary.numPendingTests} pending.\n`)
console.log(JSON.stringify(summary))
