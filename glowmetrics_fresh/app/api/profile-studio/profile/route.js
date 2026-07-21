export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getProfileStudioCaller } from '../../../../lib/profileStudio/auth'
import { ALL_PLATFORMS, PERSONA_TAGS, TONE_OPTIONS, SERVICE_OPTIONS } from '../../../../lib/profileStudio/constants'

// A saved creator profile is intentionally permissive/partial — the wizard
// saves whatever step the creator has completed so far. All fields optional.
const CreatorProfileSchema = z.object({
  displayName: z.string().trim().max(60).optional(),
  usernames: z.record(z.string(), z.string().max(60)).optional(),
  pronouns: z.string().trim().max(30).optional(),
  ageDisplay: z.enum(['none', '18plus', 'custom']).optional(),
  ageDisplayValue: z.string().trim().max(20).optional(),
  locationGeneral: z.string().trim().max(80).optional(),
  languages: z.array(z.string().max(30)).max(10).optional(),
  experienceLevel: z.enum(['new', 'growing', 'established']).optional(),
  platforms: z.array(z.enum(ALL_PLATFORMS)).optional(),

  personaTags: z.array(z.string().max(40)).max(30).optional(),
  personalityWords: z.array(z.string().max(24)).max(3).optional(),
  desiredAudience: z.string().trim().max(200).optional(),
  brandColors: z.array(z.string().max(20)).max(6).optional(),
  signaturePhrase: z.string().trim().max(120).optional(),
  roomDifference: z.string().trim().max(300).optional(),
  strongestQualities: z.string().trim().max(300).optional(),
  tone: z.array(z.enum(TONE_OPTIONS)).optional(),

  services: z.array(z.enum(SERVICE_OPTIONS)).optional(),
  boundaries: z.record(z.string(), z.any()).optional(),
  schedule: z.record(z.string(), z.any()).optional(),

  ctaPrimary: z.string().max(60).optional(),
  ctaSecondary: z.string().max(60).optional(),
  socialUsernames: z.record(z.string(), z.string().max(60)).optional(),

  pricingPreferences: z.record(z.string(), z.any()).optional(),
  tipMenuCategories: z.array(z.string().max(40)).optional(),

  // Brand Studio additions — kept in one JSON bucket instead of new columns
  // since none of these need to be queried/filtered/indexed independently.
  brandSettings: z.object({
    primaryPlatform: z.string().max(40).optional(),
    emojiStyle: z.enum(['none', 'minimal', 'playful', 'heavy']).optional(),
    alwaysUseWords: z.array(z.string().max(40)).max(30).optional(),
    neverUseWords: z.array(z.string().max(40)).max(30).optional(),
    website: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
    comfortLevel: z.enum(['beginner', 'moderate', 'experienced']).optional(),
    audienceTags: z.array(z.string().max(40)).max(20).optional(),
    defaultBioFormat: z.string().max(40).optional(),
    defaultTipMenuStrategy: z.string().max(40).optional(),
  }).partial().optional(),
})

function toRow(userId, data) {
  return {
    user_id: userId,
    display_name: data.displayName ?? null,
    usernames: data.usernames ?? {},
    pronouns: data.pronouns ?? null,
    age_display: data.ageDisplay ?? 'none',
    age_display_value: data.ageDisplayValue ?? null,
    location_general: data.locationGeneral ?? null,
    languages: data.languages ?? [],
    experience_level: data.experienceLevel ?? 'new',
    platforms: data.platforms ?? [],
    persona_tags: data.personaTags ?? [],
    personality_words: data.personalityWords ?? [],
    desired_audience: data.desiredAudience ?? null,
    brand_colors: data.brandColors ?? [],
    signature_phrase: data.signaturePhrase ?? null,
    room_difference: data.roomDifference ?? null,
    strongest_qualities: data.strongestQualities ?? null,
    tone: data.tone ?? [],
    services: data.services ?? [],
    boundaries: data.boundaries ?? {},
    schedule: data.schedule ?? {},
    cta_primary: data.ctaPrimary ?? null,
    cta_secondary: data.ctaSecondary ?? null,
    social_usernames: data.socialUsernames ?? {},
    pricing_preferences: data.pricingPreferences ?? {},
    tip_menu_categories: data.tipMenuCategories ?? [],
    brand_settings: data.brandSettings ?? {},
    updated_at: new Date().toISOString(),
  }
}

function toClient(row) {
  if (!row) return null
  return {
    id: row.id,
    displayName: row.display_name,
    usernames: row.usernames,
    pronouns: row.pronouns,
    ageDisplay: row.age_display,
    ageDisplayValue: row.age_display_value,
    locationGeneral: row.location_general,
    languages: row.languages,
    experienceLevel: row.experience_level,
    platforms: row.platforms,
    personaTags: row.persona_tags,
    personalityWords: row.personality_words,
    desiredAudience: row.desired_audience,
    brandColors: row.brand_colors,
    signaturePhrase: row.signature_phrase,
    roomDifference: row.room_difference,
    strongestQualities: row.strongest_qualities,
    tone: row.tone,
    services: row.services,
    boundaries: row.boundaries,
    schedule: row.schedule,
    ctaPrimary: row.cta_primary,
    ctaSecondary: row.cta_secondary,
    socialUsernames: row.social_usernames,
    pricingPreferences: row.pricing_preferences,
    tipMenuCategories: row.tip_menu_categories,
    brandSettings: row.brand_settings || {},
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Unauthorized', loggedIn: false }, { status: 401 })

  const { data, error } = await supabase.from('creator_profiles').select('*').eq('user_id', user.id).maybeSingle()

  if (error) {
    console.error('Failed to load creator profile', error.message)
    return NextResponse.json({ error: 'Something went wrong loading your profile.' }, { status: 500 })
  }

  return NextResponse.json({ profile: toClient(data), loggedIn: true })
}

export async function POST(req) {
  const { supabase, user } = await getProfileStudioCaller()
  if (!user) return NextResponse.json({ error: 'Please sign in to save your profile.' }, { status: 401 })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreatorProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid or missing fields.', details: parsed.error.issues.slice(0, 10) }, { status: 400 })
  }

  const row = toRow(user.id, parsed.data)

  const { data, error } = await supabase
    .from('creator_profiles')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to save creator profile', error.message)
    return NextResponse.json({ error: 'Something went wrong saving your profile.' }, { status: 500 })
  }

  return NextResponse.json({ profile: toClient(data) })
}
