// ============================================================
// CREATOR PROFILE STUDIO — SHARED CONSTANTS
// Single source of truth for both the Bio Generator and the Tip Menu
// Generator, on the client and in the API routes. Never duplicate these
// lists anywhere else — import from here.
// ============================================================

import { PLATFORM_TOKEN_RATES, DEFAULT_TOKEN_RATE, tokenRate } from '../constants'

export { tokenRate }

// ── Platforms ────────────────────────────────────────────────────────────
export const CAM_PLATFORMS = [
  'Chaturbate', 'MyFreeCams', 'BongaCams', 'Stripchat', 'CamSoda',
]
export const CONTENT_PLATFORMS = ['OnlyFans', 'Fansly']
export const SOCIAL_PLATFORMS = ['X/Twitter', 'Instagram']
export const ALL_PLATFORMS = [...CAM_PLATFORMS, ...CONTENT_PLATFORMS, ...SOCIAL_PLATFORMS, 'Other']

// Tip menus only make sense on platforms with a public room/chat.
export const TIP_MENU_PLATFORMS = [...CAM_PLATFORMS, 'OnlyFans', 'Fansly', 'Custom']

export const CURRENCY_TYPES = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'credits', label: 'Credits' },
  { id: 'dollars', label: 'Dollars' },
  { id: 'custom', label: 'Custom' },
]

// Platform default token->USD value, reusing the app-wide single source of
// truth (lib/constants.js) instead of hardcoding a second copy.
export function defaultTokenValue(platform) {
  if (!platform) return DEFAULT_TOKEN_RATE
  if (PLATFORM_TOKEN_RATES[platform] != null) return PLATFORM_TOKEN_RATES[platform]
  return DEFAULT_TOKEN_RATE
}

// ── Step 1: Creator identity ────────────────────────────────────────────
export const AGE_DISPLAY_OPTIONS = [
  { id: 'none', label: 'Do not include age' },
  { id: '18plus', label: '18+' },
  { id: 'custom', label: 'Custom age' },
]

export const EXPERIENCE_LEVELS = [
  { id: 'new', label: 'New creator' },
  { id: 'growing', label: 'Growing creator' },
  { id: 'established', label: 'Established creator' },
]

// ── Step 2: Persona and brand ───────────────────────────────────────────
export const PERSONA_TAGS = [
  'Girl next door', 'Bratty princess', 'Soft domme', 'Strict domme', 'Findom',
  'Submissive', 'Switch', 'Girlfriend experience', 'Gamer', 'Cosplay',
  'Fitness', 'Mature', 'Newly 18 aesthetic', 'Alternative', 'Goth', 'Glam',
  'Natural', 'Shy', 'Playful', 'Funny', 'Flirty', 'Luxury', 'Fetish-focused',
  'Non-nude creator', 'Nude creator',
]

export const TONE_OPTIONS = [
  'Sweet', 'Flirty', 'Playful', 'Confident', 'Dominant', 'Bratty',
  'Mysterious', 'Luxury', 'Friendly', 'Direct',
]

// ── Step 3: Content and boundaries ──────────────────────────────────────
export const SERVICE_OPTIONS = [
  'Public chat', 'Private shows', 'Exclusive private shows', 'Games',
  'Tip goals', 'Lovense or interactive toys', 'Roleplay', 'Cosplay',
  'Dancing', 'Conversation', 'Sexting', 'Custom content', 'Fan club',
  'Social media access', 'Other',
]

// ── Step 4: Schedule and CTAs ───────────────────────────────────────────
export const PRIMARY_CTA_OPTIONS = [
  'Follow me', 'Favorite my room', 'Join my fan club', 'Turn on notifications',
  'Check my tip menu', 'Message me', 'Follow my social accounts',
]

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ── Step 5: Bio format / length / emoji ─────────────────────────────────
export const BIO_FORMATS = [
  { id: 'short_cam_bio', label: 'Short cam bio' },
  { id: 'full_cam_profile', label: 'Full cam profile bio' },
  { id: 'chaturbate', label: 'Chaturbate-style bio' },
  { id: 'myfreecams', label: 'MyFreeCams-style bio' },
  { id: 'bongacams', label: 'BongaCams-style bio' },
  { id: 'x_twitter', label: 'X/Twitter bio' },
  { id: 'instagram', label: 'Instagram bio' },
  { id: 'onlyfans_fansly', label: 'OnlyFans or Fansly bio' },
  { id: 'promotional', label: 'Promotional bio' },
  { id: 'seo_description', label: 'SEO-friendly creator description' },
  { id: 'about_me', label: 'About Me section' },
]

export const BIO_LENGTHS = [
  { id: 'very_short', label: 'Very short', maxChars: 80 },
  { id: 'short', label: 'Short', maxChars: 160 },
  { id: 'medium', label: 'Medium', maxChars: 350 },
  { id: 'detailed', label: 'Detailed', maxChars: 700 },
]

export const EMOJI_LEVELS = [
  { id: 'none', label: 'No emojis' },
  { id: 'minimal', label: 'Minimal emojis' },
  { id: 'playful', label: 'Playful emojis' },
  { id: 'heavy', label: 'Heavy emojis' },
]

export const BIO_STYLES = [
  { id: 'best_overall', label: 'Best overall' },
  { id: 'playful', label: 'More playful' },
  { id: 'direct', label: 'More direct / sales-focused' },
]

// Hard platform character caps — the generator must fit inside these
// regardless of the requested length option.
export const PLATFORM_CHAR_CAPS = {
  chaturbate: 999,
  myfreecams: 999,
  bongacams: 500,
  x_twitter: 160,
  instagram: 150,
  onlyfans_fansly: 1000,
  short_cam_bio: 160,
  full_cam_profile: 1200,
  promotional: 400,
  seo_description: 400,
  about_me: 1200,
}

// ── Tip menu: show energy / room goal / comfort ─────────────────────────
export const SHOW_ENERGY_OPTIONS = [
  'Relaxed', 'Chatty', 'Playful', 'Teasing', 'High energy', 'Dominant', 'Goal-focused',
]

export const ROOM_GOAL_OPTIONS = [
  'More small tips', 'More medium tips', 'More large tips', 'More private shows',
  'More fan club signups', 'More toy interaction', 'More viewer participation',
]

export const COMFORT_LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'experienced', label: 'Experienced' },
]

// ── Tip menu categories ──────────────────────────────────────────────────
export const TIP_MENU_CATEGORIES = [
  'Greetings and attention', 'Reactions', 'Compliments', 'Outfit actions',
  'Dancing', 'Poses', 'Toy actions', 'Lovense levels', 'Games', 'Spin wheel',
  'Roll the dice', 'Goals', 'Roleplay', 'Dominant commands',
  'Submissive actions', 'Private show prompts', 'Fan club promotion',
  'Social promotion', 'Custom requests', 'Non-nude activities',
]

// ── Pricing strategy ─────────────────────────────────────────────────────
export const PRICING_STRATEGIES = [
  { id: 'budget', label: 'Budget-friendly menu' },
  { id: 'balanced', label: 'Balanced menu' },
  { id: 'premium', label: 'Premium menu' },
  { id: 'luxury', label: 'Luxury / high-spender menu' },
  { id: 'custom', label: 'Custom pricing strategy' },
]

export const MENU_ITEM_COUNTS = [10, 15, 20, 30]

export const MENU_STYLES = [
  { id: 'balanced', label: 'Balanced menu' },
  { id: 'high_engagement', label: 'High-engagement menu (more affordable tips)' },
  { id: 'premium', label: 'Premium menu (fewer, higher-value actions)' },
]

export const MENU_THEMES = [
  { id: 'dark_neon', label: 'Dark neon' },
  { id: 'pink_luxury', label: 'Pink luxury' },
  { id: 'minimal_bw', label: 'Minimal black and white' },
  { id: 'soft_pastel', label: 'Soft pastel' },
  { id: 'custom', label: 'Custom colors' },
]

export const PRICE_LEVELS = [
  { id: 'low', label: 'Low-cost engagement tips' },
  { id: 'mid', label: 'Mid-level action tips' },
  { id: 'premium', label: 'Premium attention tips' },
  { id: 'high_value', label: 'High-value / goal tips' },
]

// ── Loading messages (staged, not a frozen spinner) ──────────────────────
export const BIO_LOADING_MESSAGES = [
  'Learning your creator style…',
  'Matching your platform…',
  'Writing your opening hook…',
  'Adding your call to action…',
  'Polishing your bio…',
]

export const TIP_MENU_LOADING_MESSAGES = [
  'Reviewing your pricing preferences…',
  'Balancing low and premium tips…',
  'Checking your boundaries…',
  'Estimating creator earnings…',
  'Building your editable menu…',
]
