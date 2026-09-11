export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getProfileStudioCaller, getClientIp } from '../../../../../lib/profileStudio/auth'
import { checkRateLimit } from '../../../../../lib/rateLimit'
import { BioGenerateRequestSchema, sanitizeGeneratedBio, charCap } from '../../../../../lib/profileStudio/bioRules'
import { buildBioPrompt, BIO_OUTPUT_SCHEMA } from '../../../../../lib/profileStudio/prompts'
import { generateStructuredContent } from '../../../../../lib/profileStudio/anthropic'

// Free, unlimited, and usable signed-out — this tool exists to pull
// visitors into signing up, not to gate them out first. Signed-in users get
// their results saved automatically; signed-out users get the same
// generation but nothing is persisted (nothing to attach it to).
export async function POST(req) {
  const { supabase, user } = await getProfileStudioCaller()

  const rateKey = user ? `user:${user.id}` : `ip:${getClientIp(req)}`
  const rate = checkRateLimit(`${rateKey}:bio-generate`, { windowMs: 60_000, max: 5 })
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before generating again.' }, { status: 429 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BioGenerateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing fields.', details: parsed.error.issues.slice(0, 10) }, { status: 400 })
  }
  const { identity, persona, content, schedule, format, length, emoji } = parsed.data

  const maxChars = charCap(format, length)
  const prompt = buildBioPrompt({ identity, persona, content, schedule, format, length, emoji, maxChars })

  let aiResult
  try {
    aiResult = await generateStructuredContent({ prompt, schema: BIO_OUTPUT_SCHEMA, maxTokens: 3000 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }

  const warnings = []
  const bios = []
  for (const raw of Array.isArray(aiResult.bios) ? aiResult.bios : []) {
    const { text, warnings: itemWarnings, blocked } = sanitizeGeneratedBio(raw.text, {
      services: content.services,
      maxChars,
    })
    if (blocked) {
      warnings.push(`The "${raw.style}" version could not be generated safely and was skipped.`)
      continue
    }
    warnings.push(...itemWarnings)
    bios.push({
      style: raw.style,
      platform: identity.platforms[0] || 'general',
      format,
      text,
      characterCount: text.length,
    })
  }

  if (!bios.length) {
    return NextResponse.json({ error: 'Could not generate a safe bio from these inputs. Please adjust your selections and try again.' }, { status: 422 })
  }

  if (!user) {
    return NextResponse.json({
      bios: bios.map((b, i) => ({ id: `local_${Date.now()}_${i}`, ...b })),
      warnings: [...new Set(warnings)],
      suggestions: [],
      saved: false,
    })
  }

  const rowsToInsert = bios.map(b => ({
    user_id: user.id,
    name: `${identity.displayName || 'My'} — ${format}`,
    platform: b.platform,
    format,
    style: b.style,
    length_option: length,
    emoji_option: emoji,
    input_snapshot: parsed.data,
    generated_text: b.text,
    character_count: b.characterCount,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('generated_bios')
    .insert(rowsToInsert)
    .select('id, style, platform, format, generated_text, character_count, created_at')

  if (insertError) {
    console.error('Failed to save generated bios', insertError.message)
    return NextResponse.json({ error: 'Bio generated, but saving it failed. Please try again.' }, { status: 500 })
  }

  const responseBios = inserted.map(row => ({
    id: row.id,
    style: row.style,
    platform: row.platform,
    format: row.format,
    text: row.generated_text,
    characterCount: row.character_count,
  }))

  return NextResponse.json({
    bios: responseBios,
    warnings: [...new Set(warnings)],
    suggestions: [],
    saved: true,
  })
}
