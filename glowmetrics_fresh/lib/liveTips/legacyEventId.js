import crypto from 'crypto'

// Fixed namespace for UUID v5 ids derived from legacy deduplication keys.
// Must never change: changing it would make a retry straddling a deploy look
// like a new tip.
export const LEGACY_EVENT_NAMESPACE = '6f1d3c2a-9b4e-5f70-8a1c-2d3e4f5a6b7c'

// Pre-Phase-1 key format, byte-for-byte identical to the old route so retries
// of tips it already saved still match live_tips.deduplication_key.
export function legacyDeduplicationKey(userId, username, amount, platform, eventAtIso) {
  const tsMs = new Date(eventAtIso).getTime()
  return `${userId}-${username.trim().toLowerCase()}-${amount}-${platform.toLowerCase()}-${tsMs}`
}

// RFC 4122 UUID v5 (SHA-1, name-based): same key in, same id out.
export function uuidV5(name, namespace = LEGACY_EVENT_NAMESPACE) {
  const nsBytes = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const hash = crypto.createHash('sha1').update(nsBytes).update(Buffer.from(name, 'utf8')).digest()
  const b = hash.subarray(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}
