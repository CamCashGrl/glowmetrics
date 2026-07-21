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

export function buildBioPrompt({ identity, persona, content, schedule, format, length, emoji, maxChars }) {
  const ageLine = identity.ageDisplay === 'none'
    ? 'Do not mention age at all.'
    : identity.ageDisplay === '18plus'
      ? 'You may state the creator is 18+ (nothing more specific).'
      : `Age display: "${identity.ageDisplayValue || '18+'}" (do not invent a different number).`

  return `
You are a creator-branding copywriter for adult webcam/content creators. Write bios for the platform format "${format}".

${SAFETY_RULES}

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
"best_overall" is the strongest general-purpose version. "playful" leans more fun/flirty within the chosen tone. "direct" is more sales/CTA-focused. All three must independently satisfy every rule above and the ${maxChars}-character limit.
`.trim()
}

export function buildBioImprovePrompt({ existingBio, format, maxChars }) {
  return `
You are a creator-branding editor. A webcam/content creator pasted their current bio below and wants it improved for the "${format}" format.

${SAFETY_RULES}

EXISTING BIO:
"""
${existingBio}
"""

Identify problems from this checklist (only include ones that actually apply): weak opening line, missing personality, missing call to action, repetitive wording, confusing schedule info, services mentioned without clear organization, missing boundaries, excessive emojis, bio length issues.

Do not invent new services, offers, or claims that were not already implied by the original bio. Stay under ${maxChars} characters in the revised version.

Return ONLY raw JSON (no markdown fences) in exactly this shape:
{
  "improvements": ["short phrase describing issue 1", "short phrase describing issue 2"],
  "explanation": "one short paragraph summarizing what was changed and why",
  "revisedBio": "the improved bio text"
}
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
    improvements: { type: 'array', items: { type: 'string' } },
    explanation: { type: 'string' },
    revisedBio: { type: 'string' },
  },
  required: ['improvements', 'explanation', 'revisedBio'],
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

export function buildTipMenuContentPrompt({ persona, tone, showEnergy, roomGoal, platform, displayName, ctaPrimary, disclaimer, slots }) {
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
