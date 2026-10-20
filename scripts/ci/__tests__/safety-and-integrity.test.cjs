const { test } = require('node:test')
const assert = require('node:assert/strict')
const { assertTestEnvironment, TESTING, PRODUCTION } = require('../assert-test-environment.cjs')
const { checkPatch, checkResults } = require('../verify-test-integrity.cjs')
const { notify } = require('../notify-slack.cjs')
const stage = () => ({ CI: 'true', NEXT_PUBLIC_SUPABASE_URL: `https://${TESTING}.supabase.co`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-placeholder', SUPABASE_SERVICE_ROLE_KEY: 'test-placeholder' })
test('CI requires staging and both secrets', () => {
  assert.equal(assertTestEnvironment(stage()), TESTING)
  assert.throws(() => assertTestEnvironment({ CI: 'true' }), /Live Mode Testing/)
  assert.throws(() => assertTestEnvironment({ ...stage(), SUPABASE_SERVICE_ROLE_KEY: '' }), /Missing staging/)
  assert.throws(() => assertTestEnvironment({ ...stage(), NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' }), /Live Mode Testing/)
})
test('production endpoints are rejected even offline', () => {
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'DATABASE_URL', 'PGHOST', 'SUPABASE_PROJECT_ID']) assert.throws(() => assertTestEnvironment({ [name]: PRODUCTION }), /Production/)
  assert.throws(() => assertTestEnvironment({ ...stage(), DATABASE_URL: 'postgres://unknown/db' }), /Unverified/)
  assert.equal(assertTestEnvironment({}), 'offline')
})
test('production JWT cannot hide behind staging URL', () => {
  const key = `header.${Buffer.from(JSON.stringify({ ref: PRODUCTION })).toString('base64url')}.signature`
  assert.throws(() => assertTestEnvironment({ ...stage(), SUPABASE_SERVICE_ROLE_KEY: key }), /Non-testing/)
})
test('integrity rejects focused, skipped and tautological tests', () => {
  for (const pattern of ["test.skip('a')", "it.only('a')", "xit('a')", 'expect(true).toBe(true)']) assert.throws(() => checkPatch(`+${pattern}`))
  assert.doesNotThrow(() => checkPatch('+expect(response.status).toBe(200)'))
})
test('complete results must meet the floor and pass without skips', () => {
  const good = { numTotalTests: 500, numPassedTests: 500, numFailedTests: 0, success: true }
  assert.equal(checkResults(good), 500)
  for (const change of [{ numTotalTests: 426 }, { numPendingTests: 1 }, { numFailedTests: 1 }, { success: false }]) assert.throws(() => checkResults({ ...good, ...change }))
})
test('Slack sends failures only and tolerates missing artifacts', async () => {
  let calls = 0
  const send = async () => { calls++; return { ok: true } }
  const env = { CI_CONCLUSION: 'success', SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/test' }
  assert.equal(await notify(env, send), false)
  assert.equal(calls, 0)
  assert.equal(await notify({ ...env, CI_CONCLUSION: 'failure', CI_RESULTS_PATH: 'missing-fixture.json' }, send), true)
  assert.equal(calls, 1)
})
