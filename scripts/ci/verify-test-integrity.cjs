const fs = require('node:fs')
const { execFileSync } = require('node:child_process')
const TEST_FILE = /\.test\.(?:js|jsx|ts|tsx)$/

function checkPatch(patch) {
  const added = patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n')
  if (/\b(?:test|it|describe)\s*\.\s*(?:skip|only)\b|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(/.test(added)) throw new Error('Skipped or focused tests are not allowed')
  if (/expect\(\s*(?:true|false)\s*\)\s*\.\s*toBe\(\s*(?:true|false)\s*\)/.test(added)) throw new Error('Tautological test assertion detected')
}
function checkResults(results) {
  if (!Number.isInteger(results.numTotalTests) || results.numTotalTests < 427) throw new Error('Test count is below the existing 427-test floor')
  if (results.numPendingTests || results.numTodoTests || results.numPendingTestSuites) throw new Error('Skipped or todo tests detected')
  if (!results.success || results.numFailedTests || results.numFailedTestSuites || results.numPassedTests !== results.numTotalTests) throw new Error('The complete test suite did not pass')
  return results.numTotalTests
}
function checkGit(base = 'origin/main') {
  if (!/^[\w/.-]+$/.test(base) || base.startsWith('-')) throw new Error('Invalid comparison ref')
  const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
  const files = git(['diff', '--name-status', `${base}...HEAD`]).trim().split('\n')
  for (const line of files) {
    const [status, ...names] = line.split('\t')
    if (status === 'D' && names.some(name => TEST_FILE.test(name))) throw new Error(`Test deleted: ${names.join(', ')}`)
  }
  const paths = files.flatMap(line => line.split('\t').slice(1)).filter(name => TEST_FILE.test(name))
  if (paths.length) checkPatch(git(['diff', '--unified=0', `${base}...HEAD`, '--', ...paths]))
  console.log('Changed-test integrity checks passed')
}
module.exports = { checkPatch, checkResults, checkGit }
if (require.main === module) {
  try {
    if (process.argv[2] === '--results') console.log(`Complete suite integrity verified: ${checkResults(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')))} tests passed`)
    else checkGit(process.argv[2])
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
