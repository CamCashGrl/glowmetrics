// ============================================================
// CREATOR PROFILE STUDIO — AI PROMPT BUILDERS
// Every prompt asks for raw JSON only and enumerates the creator's actual
// selections explicitly so the model has no ambiguity about what is and
// isn't allowed. Server-side rules (bioRules.js / tipMenuRules.js) still
// re-check the output — these prompts reduce bad output, they don't
// replace validation.
// ============================================================

const SAFETY_RULES = `
Hard rules you must never break:
- Never write anything implying the creator is under 18. No school/grade references, no "teen"/"minor"/"barely legal" language.
- If the creator chose "Newly 18 aesthetic," keep it clearly adult — never add school-age or underage implications.
- Never mention a service, activity, or platform the creator did not explicitly list below. Do not invent offerings.
- Never restate a boundary/hard-no as something offered.
- Never claim "top creator," "#1," "most popular," or similar unverifiable superlative claims.
- Never invent an exact location beyond what is given.
- Sound like a real, specific person — avoid generic filler like "I love to have fun" unless the creator's own words support it.
`.trim()

function fmtList(arr) {
  if (!arr || !arr.length) return 'none provided'
  return arr.join(', ')
}

// ── Per-format structure, rules, and CTA guidance ─────────────────────────
// Every bio format has a distinct purpose and shape — this table is what
// keeps a "Very short cam bio" from reading like a trimmed-down "About Me"
// section. Character caps still come from PLATFORM_CHAR_CAPS; this only
// controls structure/tone/what-to-avoid guidance in the prompt.
const FORMAT_RULES = {
  very_short_cam_bio: {
    purpose: 'A fast introduction for small profile areas or room summaries.',
    structure: ['Persona hook', 'One or two key approved activities', 'One short call to action'],
    rules: ['No paragraph breaks — a single short line or two.', 'No schedule details.', 'No more than two emojis unless the emoji level is heavy.', 'Do not list every service — pick the one or two most distinctive.'],
  },
  short_cam_bio: {
    purpose: 'A concise but useful room bio.',
    structure: ['Strong opening line', 'Persona and room energy', 'Two to four selected activities', 'Main call to action'],
    rules: ['One compact paragraph.', 'Mention schedule only if the creator provided one.', "Focus on what makes the creator's room different rather than listing everything they offer."],
  },
  full_cam_profile: {
    purpose: 'A complete profile that introduces the creator and encourages interaction.',
    structure: ['Opening hook', 'Personality and persona', 'Room experience', 'Approved activities or specialties', 'Viewer expectations', 'Schedule', 'Boundaries or a respectful reminder if requested', 'Call to action'],
    rules: ['Two to four short paragraphs, easy to scan.', 'Do not turn this into a full tip menu — no per-item pricing.', 'Balance personality with practical details.'],
  },
  chaturbate: {
    purpose: 'A profile suitable for a Chaturbate room page.',
    structure: ['Room personality', 'Interactive experience', 'Toys or games only if selected', 'Tip-menu direction', 'Streaming schedule', 'Favorites/notification call to action'],
    rules: ['Avoid overly formal wording.', 'Never promise anything not selected.', 'No unsupported earnings or popularity claims.'],
    preferredCta: ['Favorite my room', 'Turn on notifications', 'Check my tip menu'],
  },
  myfreecams: {
    purpose: 'A personality-heavy profile suitable for MyFreeCams.',
    structure: ['Creator personality', 'Room culture', 'Member interaction', 'Club or fan membership only if offered', 'Repeat-viewer connection', 'Schedule', 'Room rules if provided'],
    rules: ['More conversational and community-oriented than a generic sales bio.'],
    preferredCta: ['Add me to favorites', 'Join the club', 'Come say hello'],
  },
  bongacams: {
    purpose: 'A direct and easy-to-scan BongaCams profile.',
    structure: ['Room energy', 'Public chat activities', 'Private options only if selected', 'Interactive toys if selected', 'Languages', 'Schedule', 'Follow/favorite call to action'],
    rules: ['Keep sentences relatively short.', 'Avoid excessive decorative language.', 'Clearly separate public and private offerings when both are mentioned.'],
  },
  stripchat: {
    purpose: 'An engaging profile with room style, toys, games, and show options.',
    structure: ['Interactive room energy', 'Games and goals if selected', 'Toys only if approved', 'Show type', 'Schedule', 'Follow call to action'],
    rules: ['Lead with personality.', 'Mention activities naturally rather than as a bullet list.', 'Include private-show language only if selected.'],
  },
  camsoda: {
    purpose: 'A lively, social, interaction-forward profile.',
    structure: ['Entertainment style', 'Energy', 'Audience participation', 'Games if selected', 'Toys if selected', 'Private or exclusive options only if offered'],
    rules: ['Confident, playful, direct, and social tone.'],
  },
  onlyfans: {
    purpose: 'A subscription-profile bio designed to communicate content style and encourage subscriptions.',
    structure: ['Identity or niche', 'Approved content categories', 'Posting or messaging benefit only if provided', 'Subscribe call to action'],
    rules: ['Do not mention cam-room pricing or tip-menu actions.', 'Do not promise daily posting unless explicitly provided.', 'Do not promise messaging access unless selected.', 'Do not claim "uncensored" unless the creator specifically approved that language.'],
  },
  fansly: {
    purpose: 'A subscription-profile bio suitable for tiered or fan-focused content.',
    structure: ['Creator niche', 'Approved content', 'Personality', 'Subscription or follow call to action', 'Tiered content only if the creator offers it'],
    rules: ['Avoid cam-room instructions.', 'Do not state an unsupported posting frequency.', 'Do not claim custom-content availability unless selected.'],
  },
  x_twitter: {
    purpose: 'A compact identity statement for X.',
    structure: ['Persona or niche', 'One distinguishing feature', 'Link or follow call to action when appropriate'],
    rules: ['No paragraph breaks.', 'Avoid hashtags unless requested.', 'No more than one or two emojis.', 'Do not include a full service list.', 'Prefer a safer phrase over explicit wording when one works just as well.'],
    variationLabels: { best_overall: 'Brand-forward', playful: 'Playful', direct: 'Conversion-focused' },
  },
  instagram: {
    purpose: 'A social-safe Instagram profile description.',
    structure: ['Public-facing identity', 'Brand or personality', 'Link-oriented call to action'],
    rules: ['Avoid explicit activity descriptions.', 'Use safer phrases such as "creator," "live entertainer," or "exclusive content."', 'No direct tip-menu language.', 'Maximum three short lines; line breaks are fine.'],
    variationLabels: { best_overall: 'Clean professional', playful: 'Playful', direct: 'Luxury / brand-forward' },
  },
  promotional: {
    purpose: 'A bio for directories, collaborations, guest features, media kits, or promotional pages.',
    structure: ['Creator identity', 'Niche and persona', 'Audience appeal', 'Approved specialties', 'Platform presence', 'Collaboration or follow call to action'],
    rules: ['Professional tone that still matches the creator brand.', 'Avoid first-person room commands, tip-menu detail, or unsupported performance metrics.'],
  },
  seo_description: {
    purpose: 'A public website description that can support search visibility.',
    structure: ['Natural mention of the creator name', 'Clear description of niche', 'Main platform or category mentioned naturally', 'Approved services woven in naturally'],
    rules: ['Natural keyword usage — no keyword stuffing.', 'Avoid explicit terms when a safer phrase fits the page.', 'Do not fabricate popularity, rankings, or years of experience.'],
  },
  about_me: {
    purpose: 'A warmer, longer creator introduction.',
    structure: ['Personal opening', 'Motivation, using only information actually provided', 'Personality', 'What the audience can expect', 'Values and boundaries', 'Schedule or interaction style', 'Call to action'],
    rules: ['Do not invent a backstory or hobbies not provided.', "Don't oversexualize the whole section — make it sound human and conversational."],
  },
}

function fmtStructure(steps) {
  return steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
}

export function buildBioPrompt({ identity, persona, content, schedule, format, length, emoji, maxChars }) {
  const ageLine = identity.ageDisplay === 'none'
    ? 'Do not mention age at all.'
    : identity.ageDisplay === '18plus'
      ? 'You may state the creator is 18+ (nothing more specific).'
      : `Age display: "${identity.ageDisplayValue || '18+'}" (do not invent a different number).`

  const formatRule = FORMAT_RULES[format] || FORMAT_RULES.short_cam_bio
  const variationLabels = formatRule.variationLabels || { best_overall: 'Best overall', playful: 'More playful', direct: 'More direct' }
  const ctaLine = formatRule.preferredCta
    ? `Preferred call-to-action phrasing for this format (use one if it matches the creator's selected CTA below): ${formatRule.preferredCta.join(', ')}.`
    : ''

  return `
You are a creator-branding copywriter for adult webcam/content creators. Write bios for the platform format "${format}".

${SAFETY_RULES}

FORMAT PURPOSE AND STRUCTURE FOR "${format}"
Purpose: ${formatRule.purpose}
Structure to follow:
${fmtStructure(formatRule.structure)}
Format-specific rules:
${formatRule.rules.map(r => `- ${r}`).join('\n')}
${ctaLine}

CREATOR IDENTITY
- Display name: ${identity.displayName}
- Username: ${identity.username || 'not provided'}
- Pronouns: ${identity.pronouns || 'not provided'}
- ${ageLine}
- General location: ${identity.locationGeneral || 'not provided — do not state a location'}
- Languages: ${fmtList(identity.languages)}
- Experience level: ${identity.experienceLevel}
- Main platforms: ${fmtList(identity.platforms)}

PERSONA AND BRAND
- Persona tags: ${fmtList(persona.personaTags)}
- Three words describing personality: ${fmtList(persona.personalityWords)}
- Desired audience: ${persona.desiredAudience || 'not specified'}
- Signature phrase: ${persona.signaturePhrase || 'none'}
- What makes their room different: ${persona.roomDifference || 'not specified'}
- Strongest qualities: ${persona.strongestQualities || 'not specified'}
- Desired tone: ${fmtList(persona.tone)}

WHAT THEY OFFER (only mention these — nothing else)
- Services: ${fmtList(content.services)}

BOUNDARIES (never present these as offered; ${content.boundaries.mentionPublicly ? 'the creator wants boundaries acknowledged publicly' : 'do not mention boundaries in the bio itself'})
- Hard no: ${fmtList(content.boundaries.hardNo)}
${content.boundaries.softPhrase ? '- If mentioning limits, use a soft phrase like "please respect my limits."' : ''}
${content.boundaries.ageReminder ? '- Include a brief 18+ reminder if natural for this format.' : ''}

SCHEDULE AND CALL TO ACTION
- Streaming days: ${fmtList(schedule.days)}
- Streaming hours: ${schedule.hours || 'not specified'}
- Timezone: ${schedule.timezone || 'not specified'}
- Schedule consistency: ${schedule.consistent ? 'consistent week to week' : 'varies week to week'}
- Main call to action: ${schedule.ctaPrimary || 'not specified'}
- Secondary call to action: ${schedule.ctaSecondary || 'none'}

FORMAT REQUIREMENTS
- Target length option: "${length}" — stay under ${maxChars} characters.
- Emoji level: "${emoji}" (none = zero emojis, minimal = 0-2, playful = a natural sprinkle, heavy = frequent but still readable).
- Do not repeat the username more than once.
- Avoid promising anything not in the services list above.

Return ONLY raw JSON (no markdown fences) in exactly this shape:
{
  "bios": [
    { "style": "best_overall", "text": "..." },
    { "style": "playful", "text": "..." },
    { "style": "direct", "text": "..." }
  ]
}
"style" values must be exactly "best_overall", "playful", and "direct" — but write each one to match this format's own variation approach: "best_overall" = ${variationLabels.best_overall}, "playful" = ${variationLabels.playful}, "direct" = ${variationLabels.direct}. Each variation must have a meaningfully different structure and approach, not just a few swapped adjectives, and all three must independently satisfy every rule above and the ${maxChars}-character limit.
`.trim()
}

export function buildBioImprovePrompt({ existingBio, format, maxChars }) {
  return `
You are a creator-branding editor auditing a webcam/content creator's existing bio for the "${format}" format.

${SAFETY_RULES}

EXISTING BIO:
"""
${existingBio}
"""

Audit against this checklist (only include items that actually apply): opening hook, personality, readability, platform fit, missing call to action, unsupported claims, repetition, excessive emojis, excessive length, missing schedule, missing boundaries, services presented unclearly, unsafe personal information (legal name/address/phone), confusing wording, tone inconsistency.

Do not invent new services, offers, claims, or a backstory that were not already implied by the original bio. The rewrite must preserve the creator's original meaning. Stay under ${maxChars} characters in the rewritten version.

Return ONLY raw JSON (no markdown fences) in exactly this shape:
{
  "score": 78,
  "summary": "one sentence summarizing the bio's overall state",
  "strengths": ["short phrase 1", "short phrase 2"],
  "issues": ["short phrase describing issue 1", "short phrase describing issue 2"],
  "recommendations": ["short actionable fix 1", "short actionable fix 2"],
  "rewrittenBio": "the improved bio text"
}
"score" is 0-100 reflecting overall bio quality. "strengths" lists what already works. "issues" lists concrete problems found. "recommendations" lists short actionable fixes matching the issues. Do not include "characterCount" — it is computed separately from your rewrittenBio.
`.trim()
}

export const BIO_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    bios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          style: { type: 'string', enum: ['best_overall', 'playful', 'direct'] },
          text: { type: 'string' },
        },
        required: ['style', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['bios'],
  additionalProperties: false,
}

export const BIO_IMPROVE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    issues: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    rewrittenBio: { type: 'string' },
  },
  required: ['score', 'summary', 'strengths', 'issues', 'recommendations', 'rewrittenBio'],
  additionalProperties: false,
}

export const TIP_MENU_CONTENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    intro: { type: 'string' },
    closingCta: { type: 'string' },
    rules: { type: 'array', items: { type: 'string' } },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['name', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'intro', 'closingCta', 'rules', 'items'],
  additionalProperties: false,
}

// Per-type guidance for the tip menu's item copy — the pricing engine
// already fixes prices/categories/counts deterministically per type
// (see STRATEGY_WEIGHTS in pricingEngine.js); this only shapes wording.
const MENU_STYLE_GUIDANCE = {
  balanced: 'Write for a broadly useful, general-purpose menu.',
  high_engagement: 'Emphasize quick, frequent, low-friction actions — greetings, reactions, votes, small goals. Keep low-priced item descriptions brief.',
  premium: 'Emphasize personalized attention, priority requests, and exclusivity. Explain why premium items are worth the price.',
  beginner_friendly: 'Keep every description simple and easy to perform consistently. Avoid advanced or complex-sounding activities.',
  non_nude: 'Never write or imply nudity in any item, even for premium items. Emphasize entertainment, personality, and personalization instead.',
  toy_focused: 'Center every item on toy interaction — pulses, levels, patterns, duration, and control challenges. Do not invent a toy the creator did not select.',
  game_focused: 'Center every item on a room participation game (e.g. spin the wheel, roll the dice, truth or dare). State what happens and whether the outcome is random.',
  dominant_persona: 'Write in a dominant, strict, bratty, luxury, or findom-appropriate voice matching the creator persona. Keep consent and approval language clear.',
  submissive_persona: 'Write in a submissive, service-oriented voice. Make clear the creator retains control over what they will and will not do.',
  girlfriend_experience: 'Write warm, affectionate, conversational item descriptions. Do not imply an actual romantic relationship or off-platform access.',
  private_show_conversion: 'Frame items as gently guiding the viewer from public chat toward a private show, without implying an activity that was not approved for private.',
  goal_focused: 'Frame items as contributions toward a room goal or milestone, with clear escalation from small to large contributions.',
  short_menu: 'Keep every description very short — this is a fast, mobile-friendly menu.',
  full_menu: 'This is a comprehensive menu — descriptions can be a little more detailed, but still one sentence each.',
}

export function buildTipMenuContentPrompt({ persona, tone, showEnergy, roomGoal, platform, displayName, ctaPrimary, disclaimer, slots, style }) {
  const slotLines = slots.map((s, i) =>
    `${i + 1}. category="${s.category}", price=${s.price}, level=${s.priceLevel}`
  ).join('\n')

  return `
You are writing the text content for an adult webcam creator's tip menu. Prices are already fixed by the creator's pricing strategy — you must NOT change, invent, or reorder them. You are only writing the title, a short opening message, a closing call to action, and a viewer-facing name + one-sentence description for each numbered item below, matching its category exactly.

${SAFETY_RULES}

CREATOR: ${displayName || 'the creator'}
PLATFORM: ${platform}
PERSONA: ${fmtList(persona)}
TONE: ${fmtList(tone)}
SHOW ENERGY: ${showEnergy}
ROOM GOAL: ${roomGoal}
MAIN CALL TO ACTION: ${ctaPrimary || 'not specified'}
CUSTOM REQUEST DISCLAIMER TO INCLUDE AS-IS IF PROVIDED: ${disclaimer || 'none provided — write a brief generic one'}

MENU TYPE: "${style}" — ${MENU_STYLE_GUIDANCE[style] || MENU_STYLE_GUIDANCE.balanced}

ITEMS (write name + description ONLY for these; do not add or remove items; do not mention any category not listed):
${slotLines}

Rules for item text:
- Name: 2-5 words, punchy, matches the category.
- Description: one short viewer-facing sentence, e.g. "I'll give you a personal hello and say your username on stream."
- Never describe an activity from a different category than the one given.
- Never suggest an excluded/boundary activity — only what's implied by the category names above.

Return ONLY raw JSON (no markdown fences) in exactly this shape:
{
  "title": "...",
  "intro": "short opening message, 1-2 sentences",
  "closingCta": "short closing line built around the main call to action",
  "rules": ["short rule 1", "short rule 2"],
  "items": [
    { "name": "...", "description": "..." }
  ]
}
The "items" array must have exactly ${slots.length} entries, in the same order as the numbered list above.
`.trim()
}
