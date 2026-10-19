const PRODUCTION = 'hlsdlaibnayzbfflxclj'
const TESTING = 'qqvflqcxglkmeuahubwv'

function assertTestEnvironment(env = process.env, { required = env.CI === 'true' || env.CAMCASH_TEST_ENV === 'true' } = {}) {
  // Check alternate endpoints too: a harmless public URL must not hide a
  // production service key, database connection string, or project reference.
  for (const [name, value] of Object.entries(env)) {
    if (!/SUPABASE|DATABASE_URL|PGHOST/.test(name) || !value) continue
    if (String(value).includes(PRODUCTION)) throw new Error(`Production database configuration rejected: ${name}`)
    if (/KEY|TOKEN/.test(name) && value.split('.').length === 3) {
      let claims
      try { claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()) } catch {}
      if (claims?.ref && claims.ref !== TESTING) throw new Error(`Non-testing project key rejected: ${name}`)
    }
    if (/DATABASE_URL|PGHOST/.test(name) && !String(value).includes(TESTING)) {
      throw new Error(`Unverified database endpoint rejected: ${name}`)
    }
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  if (!required && !url) return 'offline'
  if (!url || new URL(url).origin !== `https://${TESTING}.supabase.co` || new URL(url).pathname !== '/') {
    throw new Error('Tests require the Live Mode Testing Supabase URL')
  }
  for (const name of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[name]?.trim()) throw new Error(`Missing staging secret: ${name}`)
  }
  return TESTING
}

module.exports = { assertTestEnvironment, PRODUCTION, TESTING }
if (require.main === module) {
  try { console.log(`Test environment validated: ${assertTestEnvironment(process.env, { required: true })}`) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
