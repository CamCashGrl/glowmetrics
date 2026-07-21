export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getProfileStudioCaller } from '../../../../../lib/profileStudio/auth'
import { getIsProUser } from '../../../../../lib/profileStudio/entitlements'
import { checkRateLimit } from '../../../../../lib/rateLimit'
import { BioImproveRequestSchema, sanitizeGeneratedBio, charCap } from '../../../../../lib/profileStudio/bioRules'
import { buildBioImprovePrompt, BIO_IMPROVE_OUTPUT_SCHEMA } from '../../../../../lib/profileStudio/prompts'
import { generateStructuredContent } from '../../../../../lib/profileStudio/anthropic'

export async function POST(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in to improve a bio.' }, { status: 401 })
  }

  const isPro = await getIsProUser(supabase, user.id)
  if (!isPro) {
    return NextResponse.json({
      error: 'Improving an existing bio is a Pro feature. Upgrade to unlock it.',
      code: 'pro_required',
    }, { status: 403 })
  }

  const rate = checkRateLimit(`${user.id}:bio-improve`, { windowMs: 60_000, max: 5 })
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Please wait a moment before trying again.' }, { status: 429 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BioImproveRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please paste a bio to improve.' }, { status: 400 })
  }

  const maxChars = charCap(parsed.data.format, 'detailed')
  const prompt = buildBioImprovePrompt({ existingBio: parsed.data.existingBio, format: parsed.data.format, maxChars })

  let aiResult
  try {
    aiResult = await generateStructuredContent({ prompt, schema: BIO_IMPROVE_OUTPUT_SCHEMA, maxTokens: 2000 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 })
  }

  const { text, warnings, blocked } = sanitizeGeneratedBio(aiResult.revisedBio, { services: [], maxChars })
  if (blocked) {
    return NextResponse.json({ error: 'Could not safely improve this bio. Please review it manually.' }, { status: 422 })
  }

  return NextResponse.json({
    improvements: Array.isArray(aiResult.improvements) ? aiResult.improvements.slice(0, 12) : [],
    explanation: aiResult.explanation || '',
    revisedBio: text,
    characterCount: text.length,
    warnings,
  })
}
