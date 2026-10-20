const fs = require('node:fs')
async function notify(env = process.env, fetcher = fetch) {
  if (env.CI_CONCLUSION !== 'failure') return false
  if (!env.SLACK_WEBHOOK_URL) { console.log('Slack webhook not configured; alert not delivered'); return false }
  const webhook = new URL(env.SLACK_WEBHOOK_URL)
  if (webhook.protocol !== 'https:' || !['hooks.slack.com', 'hooks.slack-gov.com'].includes(webhook.hostname)) throw new Error('Invalid Slack webhook host')
  let summary
  try { summary = JSON.parse(fs.readFileSync(env.CI_RESULTS_PATH || 'test-results/results.json', 'utf8')) } catch {}
  const counts = Number.isInteger(summary?.numTotalTests) ? `${summary.numPassedTests}/${summary.numTotalTests} tests passed; ${summary.numFailedTests} failed` : 'No test artifact available; inspect the failed workflow step.'
  const response = await fetcher(webhook, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `CamCash CI failed: ${env.CI_WORKFLOW || 'verification'}\n${counts}\nBranch: ${env.CI_BRANCH || 'unknown'}\n${env.CI_RUN_URL || ''}` }),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`Slack delivery failed (HTTP ${response.status})`)
  console.log('Slack failure alert delivered')
  return true
}
module.exports = { notify }
if (require.main === module) notify().catch(error => { console.error(error.message); process.exitCode = 1 })
