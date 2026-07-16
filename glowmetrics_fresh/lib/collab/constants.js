// Single source of truth for Collab Board enums — mirrors the CHECK
// constraints in supabase/migrations/20260716192202_create_collab_board.sql.
// Never hardcode these lists anywhere else.

export const COLLAB_TYPES = [
  { value: 'battle', label: 'Battle' },
  { value: 'duo_stream', label: 'Duo Stream' },
  { value: 'group_stream', label: 'Group Stream' },
  { value: 'content_creation', label: 'Content Creation' },
  { value: 'social_promotion', label: 'Social Promotion' },
  { value: 'photoshoot', label: 'Photoshoot' },
  { value: 'travel_collaboration', label: 'Travel Collaboration' },
  { value: 'coworking_accountability', label: 'Coworking / Accountability' },
  { value: 'other', label: 'Other' },
]

export const PLATFORMS = [
  { value: 'chaturbate', label: 'Chaturbate' },
  { value: 'bongacams', label: 'BongaCams' },
  { value: 'myfreecams', label: 'MyFreeCams' },
  { value: 'stripchat', label: 'Stripchat' },
  { value: 'camsoda', label: 'CamSoda' },
  { value: 'onlyfans', label: 'OnlyFans' },
  { value: 'fansly', label: 'Fansly' },
  { value: 'manyvids', label: 'ManyVids' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'multiple_platforms', label: 'Multiple Platforms' },
  { value: 'other', label: 'Other' },
]

export const PARTICIPATION_MODES = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In-Person' },
  { value: 'either', label: 'Either' },
]

export const EXPERIENCE_LEVELS = [
  { value: 'any', label: 'Any experience level' },
  { value: 'new_creator', label: 'New creator' },
  { value: 'some_experience', label: 'Some experience' },
  { value: 'experienced', label: 'Experienced' },
  { value: 'veteran', label: 'Veteran' },
]

// profiles.experience_level never allows 'any' — it describes one creator.
export const PROFILE_EXPERIENCE_LEVELS = EXPERIENCE_LEVELS.filter(l => l.value !== 'any')

export const POST_STATUSES = ['open', 'matched', 'closed', 'expired', 'removed']

export const INTEREST_STATUSES = ['pending', 'accepted', 'maybe', 'declined', 'withdrawn']

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'illegal_activity', label: 'Illegal activity' },
  { value: 'minor_safety', label: 'Minor safety concern' },
  { value: 'scam_or_fraud', label: 'Scam or fraud' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
]

export const TEXT_LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 10, max: 4000 },
  goals: { max: 2000 },
  requirements: { max: 2000 },
  boundaries: { max: 2000 },
  city: { max: 80 },
  stateOrRegion: { max: 80 },
  creatorNiche: { max: 60 },
  audienceSizePreference: { max: 60 },
  introductionMessage: { max: 1000 },
  message: { min: 1, max: 2000 },
  reportDetails: { max: 2000 },
  bio: { max: 600 },
  tagsMax: 10,
  tagMax: 30,
}

export const MIN_AGE_REQUIREMENT = 18

export function labelFor(list, value) {
  return list.find(item => item.value === value)?.label || value
}
