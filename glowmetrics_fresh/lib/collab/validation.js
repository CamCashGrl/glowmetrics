import {
  COLLAB_TYPES, PLATFORMS, PARTICIPATION_MODES, EXPERIENCE_LEVELS,
  REPORT_REASONS, TEXT_LIMITS, MIN_AGE_REQUIREMENT,
} from './constants'

const COLLAB_TYPE_VALUES = COLLAB_TYPES.map(t => t.value)
const PLATFORM_VALUES = PLATFORMS.map(p => p.value)
const MODE_VALUES = PARTICIPATION_MODES.map(m => m.value)
const EXPERIENCE_VALUES = EXPERIENCE_LEVELS.map(e => e.value)
const REPORT_REASON_VALUES = REPORT_REASONS.map(r => r.value)

/** Strip control characters and collapse surrounding whitespace. Never trust user text as-is. */
const CONTROL_CHARS_RE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')

export function sanitizeText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(CONTROL_CHARS_RE, '').trim()
}

function lengthError(field, label, value, { min, max }) {
  const len = value ? value.length : 0
  if (min && len < min) return `${label} must be at least ${min} characters.`
  if (max && len > max) return `${label} must be ${max} characters or fewer.`
  return null
}

/**
 * Validates + sanitizes a collab post create/update payload.
 * Returns { valid, errors, data } — `data` has sanitized text ready to send to Supabase.
 * Never trust `user_id` from the payload — callers must set it from the authenticated session.
 */
export function validateCollabPostInput(input = {}) {
  const errors = {}
  const title = sanitizeText(input.title)
  const description = sanitizeText(input.description)
  const goals = input.goals != null ? sanitizeText(input.goals) : null
  const requirements = input.requirements != null ? sanitizeText(input.requirements) : null
  const boundaries = input.boundaries != null ? sanitizeText(input.boundaries) : null
  const city = input.city != null ? sanitizeText(input.city) : null
  const stateOrRegion = input.stateOrRegion != null ? sanitizeText(input.stateOrRegion) : null
  const creatorNiche = input.creatorNiche != null ? sanitizeText(input.creatorNiche) : null
  const audienceSizePreference = input.audienceSizePreference != null ? sanitizeText(input.audienceSizePreference) : null

  errors.title = lengthError('title', 'Title', title, TEXT_LIMITS.title)
  if (!title) errors.title = 'Title is required.'

  errors.description = lengthError('description', 'Description', description, TEXT_LIMITS.description)
  if (!description) errors.description = 'Description is required.'

  if (!COLLAB_TYPE_VALUES.includes(input.collabType)) {
    errors.collabType = 'Choose a valid collaboration type.'
  }

  const platforms = Array.isArray(input.platforms) ? [...new Set(input.platforms)] : []
  if (platforms.length === 0) {
    errors.platforms = 'Select at least one platform.'
  } else if (!platforms.every(p => PLATFORM_VALUES.includes(p))) {
    errors.platforms = 'One or more selected platforms are invalid.'
  }

  if (!MODE_VALUES.includes(input.participationMode)) {
    errors.participationMode = 'Choose online, in-person, or either.'
  }

  const dateIsFlexible = !!input.dateIsFlexible
  if (!dateIsFlexible && input.proposedDate) {
    const d = new Date(input.proposedDate)
    if (Number.isNaN(d.getTime())) errors.proposedDate = 'Enter a valid date.'
  }

  const experiencePreference = input.experiencePreference || 'any'
  if (!EXPERIENCE_VALUES.includes(experiencePreference)) {
    errors.experiencePreference = 'Choose a valid experience preference.'
  }

  if (goals) errors.goals = lengthError('goals', 'Goals', goals, TEXT_LIMITS.goals)
  if (requirements) errors.requirements = lengthError('requirements', 'Requirements', requirements, TEXT_LIMITS.requirements)
  if (boundaries) errors.boundaries = lengthError('boundaries', 'Boundaries', boundaries, TEXT_LIMITS.boundaries)
  if (city) errors.city = lengthError('city', 'City', city, TEXT_LIMITS.city)
  if (stateOrRegion) errors.stateOrRegion = lengthError('stateOrRegion', 'State/region', stateOrRegion, TEXT_LIMITS.stateOrRegion)
  if (creatorNiche) errors.creatorNiche = lengthError('creatorNiche', 'Creator niche', creatorNiche, TEXT_LIMITS.creatorNiche)
  if (audienceSizePreference) errors.audienceSizePreference = lengthError('audienceSizePreference', 'Audience size', audienceSizePreference, TEXT_LIMITS.audienceSizePreference)

  let ageRequirement = null
  if (input.ageRequirement !== undefined && input.ageRequirement !== null && input.ageRequirement !== '') {
    const n = Number(input.ageRequirement)
    if (!Number.isInteger(n) || n < MIN_AGE_REQUIREMENT) {
      errors.ageRequirement = `Age requirement must be ${MIN_AGE_REQUIREMENT} or older.`
    } else {
      ageRequirement = n
    }
  }

  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map(t => sanitizeText(t).slice(0, TEXT_LIMITS.tagMax)).filter(Boolean))]
    : []
  if (tags.length > TEXT_LIMITS.tagsMax) {
    errors.tags = `Use ${TEXT_LIMITS.tagsMax} tags or fewer.`
  }

  if (!input.acknowledgedNoVerification) {
    errors.acknowledgedNoVerification = 'You must confirm you understand CamCash does not verify arrangements between creators.'
  }

  let expiresAt = null
  if (input.expiresAt) {
    const d = new Date(input.expiresAt)
    if (Number.isNaN(d.getTime())) errors.expiresAt = 'Enter a valid expiration date.'
    else expiresAt = d.toISOString()
  }

  Object.keys(errors).forEach(k => { if (!errors[k]) delete errors[k] })

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      title,
      description,
      collab_type: input.collabType,
      platforms,
      participation_mode: input.participationMode,
      city: city || null,
      state_or_region: stateOrRegion || null,
      proposed_date: dateIsFlexible ? null : (input.proposedDate || null),
      date_is_flexible: dateIsFlexible,
      creator_niche: creatorNiche || null,
      experience_preference: experiencePreference,
      audience_size_preference: audienceSizePreference || null,
      goals: goals || null,
      requirements: requirements || null,
      boundaries: boundaries || null,
      tags,
      age_requirement: ageRequirement,
      expires_at: expiresAt,
    },
  }
}

/** Validates the "express interest" introductory message. */
export function validateInterestInput(input = {}) {
  const errors = {}
  const introductionMessage = input.introductionMessage != null ? sanitizeText(input.introductionMessage) : null
  if (introductionMessage) {
    errors.introductionMessage = lengthError('introductionMessage', 'Message', introductionMessage, TEXT_LIMITS.introductionMessage)
  }
  Object.keys(errors).forEach(k => { if (!errors[k]) delete errors[k] })
  return { valid: Object.keys(errors).length === 0, errors, data: { introduction_message: introductionMessage || null } }
}

/** Validates a private collab message. */
export function validateMessageInput(input = {}) {
  const errors = {}
  const message = sanitizeText(input.message)
  errors.message = lengthError('message', 'Message', message, TEXT_LIMITS.message)
  if (!message) errors.message = 'Message cannot be empty.'
  Object.keys(errors).forEach(k => { if (!errors[k]) delete errors[k] })
  return { valid: Object.keys(errors).length === 0, errors, data: { message } }
}

/** Validates a report (post or user). */
export function validateReportInput(input = {}) {
  const errors = {}
  if (!REPORT_REASON_VALUES.includes(input.reason)) {
    errors.reason = 'Choose a valid report reason.'
  }
  if (!input.collabPostId && !input.reportedUserId) {
    errors.target = 'A report must target a post or a creator.'
  }
  const details = input.details != null ? sanitizeText(input.details) : null
  if (details) errors.details = lengthError('details', 'Details', details, TEXT_LIMITS.reportDetails)
  Object.keys(errors).forEach(k => { if (!errors[k]) delete errors[k] })
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: {
      reason: input.reason,
      details: details || null,
      collab_post_id: input.collabPostId || null,
      reported_user_id: input.reportedUserId || null,
    },
  }
}
