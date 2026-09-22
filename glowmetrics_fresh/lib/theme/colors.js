// Shared color tokens — the single home for every page's color palette.
//
// Each group below was moved here verbatim from the file named in its
// comment; values are intentionally unchanged, so pages look identical.
// Groups are kept separate (not merged) because pages use different values
// for the same role (e.g. 9 different `bg` colors). Unifying them into one
// brand palette is a separate, page-by-page design decision.
//
// NOT included: app/onboarding/page.js (do-not-touch file) keeps its own
// colors; maps built from these tokens (e.g. PLT_COLOR, STYLE_COLOR) stay
// next to the code that uses them.

// From app/admin/page.js (C)
export const ADMIN_COLORS = {
  bg:     "#050713",
  bg1:    "#080B1A",
  bg2:    "#0D1020",
  card:   "rgba(10,14,32,0.82)",
  border: "rgba(255,255,255,0.09)",
  cyan:   "#16F4FF",
  pink:   "#FF2BAE",
  purple: "#7C5CFF",
  gold:   "#FFC857",
  green:  "#34d399",
  red:    "#f87171",
  white:  "#FFFFFF",
  text:   "#D7D9EA",
  muted:  "#8D93AA",
  dim:    "rgba(255,255,255,0.25)",
}

// From app/admin/preview/page.js (C)
export const ADMIN_PREVIEW_COLORS = {
  bg:     "#050713",
  bg1:    "#080B1A",
  card:   "rgba(10,14,32,0.82)",
  border: "rgba(255,255,255,0.09)",
  cyan:   "#16F4FF",
  pink:   "#FF2BAE",
  purple: "#7C5CFF",
  gold:   "#FFC857",
  white:  "#FFFFFF",
  text:   "#D7D9EA",
  muted:  "#8D93AA",
}

// From app/components/ArticleLayout.js (C)
export const ARTICLE_LAYOUT_COLORS = {
  bg:      '#0d0f14',
  border:  'rgba(255,255,255,0.07)',
  muted:   '#475569',
  text:    '#94a3b8',
  white:   '#f1f5f9',
}

// From app/dashboard/page.js (C)
export const DASHBOARD_COLORS = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

// From app/dashboard/AnalyticsCharts.js (PLATFORM_COLORS)
export const ANALYTICS_CHARTS_PLATFORM_COLORS = {
  Chaturbate: "#a855f7",
  BongaCams:  "#ec4899",
  MyFreeCams: "#22d3ee",
}

// From app/dashboard/DashboardPreview.js (C)
export const DASHBOARD_PREVIEW_COLORS = {
  bg:     '#12131a',
  card:   'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.10)',
  cyan:   '#22D3EE',
  pink:   '#EC4899',
  indigo: '#7C5CFF',
  gold:   '#F59E0B',
  green:  '#10B981',
  white:  '#F1F5F9',
  text:   '#94A3B8',
  muted:  '#475569',
  grad:   'linear-gradient(90deg,#22D3EE,#7C5CFF,#EC4899)',
}

// From app/dashboard/DashboardPreview.js (PI)
export const DASHBOARD_PREVIEW_PI_COLORS = {
  bg: '#070B18',
  panel: 'rgba(11,18,38,0.74)',
  panelStrong: 'rgba(9,16,35,0.88)',
  border: 'rgba(138,164,220,0.16)',
  borderStrong: 'rgba(22,244,255,0.42)',
  cyan: '#16F4FF',
  blue: '#55B8FF',
  purple: '#7C5CFF',
  pink: '#FF2BAE',
  gold: '#F6B94A',
  green: '#59D98E',
  text: '#F5F7FF',
  body: '#A9B4CC',
  muted: '#6F7C98',
  gradient: 'linear-gradient(90deg,#16F4FF 0%,#55B8FF 36%,#7C5CFF 69%,#FF2BAE 100%)',
}

// From app/dashboard/PlatformsIntelligence.js (C)
export const PLATFORMS_INTELLIGENCE_COLORS = {
  card: "#0d1322", card2: "#111829", border: "#1e2d45", border2: "#2a3f5f",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7", red: "#F87171",
}

// From app/dashboard/Sidebar.js (C)
export const DASHBOARD_SIDEBAR_COLORS = {
  bg: "#05070f", card: "#0d1322", border: "#1e2d45",
  cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B",
  green: "#10B981", white: "#F1F5F9", muted: "#475569", text: "#94A3B8",
  purple: "#a855f7"
}

// From app/dashboard/StreamPlanner.js (PLAT_COLORS)
export const STREAM_PLANNER_PLATFORM_COLORS = { Chaturbate: "#22d3ee", BongaCams: "#e879f9", MyFreeCams: "#a855f7" }

// From app/dashboard/MoneyMap.js (PLATFORM_COLORS)
export const MONEY_MAP_PLATFORM_COLORS = { chaturbate:"#f97316", myfreecams:"#3b82f6", stripchat:"#ec4899", bongacams:"#8b5cf6", camsoda:"#10b981", other:"#64748b" }

// From app/demo/DemoClient.js (C)
export const DEMO_CLIENT_COLORS = {
  bg:      '#040812',
  card:    '#0d1424',
  sidebar: '#070d1c',
  purple:  '#a855f7',
  pink:    '#ec4899',
  cyan:    '#22d3ee',
  green:   '#10b981',
  gold:    '#f59e0b',
  white:   '#f1f5f9',
  muted:   '#94a3b8',
  dim:     '#475569',
  red:     '#ef4444',
  border:  'rgba(168,85,247,0.15)',
}

// From app/demo/sections.js (C)
export const DEMO_SECTIONS_COLORS = {
  bg:      '#040812',
  bg2:     '#060e1e',
  card:    '#0d1424',
  purple:  '#a855f7',
  pink:    '#ec4899',
  cyan:    '#22d3ee',
  green:   '#10b981',
  gold:    '#f59e0b',
  white:   '#f1f5f9',
  muted:   '#94a3b8',
  dim:     '#475569',
  red:     '#ef4444',
  border:  'rgba(168,85,247,0.15)',
}

// From app/extension/page.js (C)
export const EXTENSION_PAGE_COLORS = {
  bg: '#040812',
  card: '#0d1424',
  border: 'rgba(168,85,247,0.15)',
  purple: '#a855f7',
  pink: '#ec4899',
  cyan: '#22d3ee',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#f87171',
  white: '#f1f5f9',
  text: '#94a3b8',
  muted: '#475569',
}

// From app/extension/page.js (BRAND_GRADIENT)
export const EXTENSION_PAGE_BRAND_GRADIENT = 'linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)'

// From app/guides/cam-model-room-title-generator/TitleGeneratorClient.js (S)
export const ROOM_TITLE_GENERATOR_CLIENT_COLORS = {
  bg:        '#14171C',
  surface:   '#1C2028',
  card:      '#21262F',
  border:    'rgba(255,255,255,0.07)',
  text:      '#8B92A0',
  textMid:   '#C1C7D4',
  textStrong:'#F0F2F6',
  accent:    '#6366F1',
  accentSoft:'rgba(99,102,241,0.12)',
  green:     '#10B981',
  greenSoft: 'rgba(16,185,129,0.1)',
  gold:      '#F59E0B',
  pink:      '#EC4899',
  cyan:      '#22D3EE',
  gradient:  'linear-gradient(135deg, #6C5CFF, #EC4899)',
}

// From app/guides/cam-model-room-title-generator/page.js (S)
export const CAM_MODEL_ROOM_TITLE_GUIDE_COLORS = {
  bg:       '#14171C',
  surface:  '#1C2028',
  card:     '#21262F',
  border:   'rgba(255,255,255,0.07)',
  text:     '#8B92A0',
  textMid:  '#C1C7D4',
  textStrong:'#F0F2F6',
  accent:   '#6366F1',
  accentSoft:'rgba(99,102,241,0.12)',
  green:    '#10B981',
  gold:     '#F59E0B',
  pink:     '#EC4899',
  red:      '#EF4444',
  cyan:     '#22D3EE',
}

// From app/guides/cam-model-token-calculator/TokenCalculatorClient.js (C)
export const TOKEN_CALCULATOR_CLIENT_COLORS = {
  cyan: '#16F4FF',
  pink: '#FF2BAE',
  purple: '#7C5CFF',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#F87171',
  white: '#FFFFFF',
  text: '#B9BED3',
  muted: '#8D93AA',
  faint: '#5E647C',
  card: 'rgba(12,16,34,0.78)',
  border: 'rgba(255,255,255,0.09)',
  grad: 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)',
}

// From app/guides/cam-model-token-calculator/page.js (S)
export const CAM_MODEL_TOKEN_CALCULATOR_GUIDE_COLORS = {
  bg: '#14171C',
  surface: '#1C2028',
  card: '#21262F',
  accent: '#6366F1',
  accentLight: 'rgba(99,102,241,0.15)',
  accentBorder: 'rgba(99,102,241,0.3)',
  green: '#10B981',
  gold: '#F59E0B',
  white: '#F1F5F9',
  muted: '#6B7280',
  text: '#9CA3AF',
  border: 'rgba(255,255,255,0.07)',
}

// From app/guides/chaturbate-room-title-generator/page.js (S)
export const CHATURBATE_ROOM_TITLE_GUIDE_COLORS = {
  bg: '#14171C',
  surface: '#1C2028',
  card: '#21262F',
  accent: '#6366F1',
  accentLight: 'rgba(99,102,241,0.12)',
  accentBorder: 'rgba(99,102,241,0.3)',
  green: '#10B981',
  gold: '#F59E0B',
  pink: '#EC4899',
  white: '#F1F5F9',
  muted: '#6B7280',
  text: '#9CA3AF',
  textMid: '#C1C7D4',
  textStrong: '#F0F2F6',
  border: 'rgba(255,255,255,0.07)',
}

// From app/guides/chaturbate-token-calculator/page.js (S)
export const CHATURBATE_TOKEN_CALCULATOR_GUIDE_COLORS = {
  bg: '#14171C',
  surface: '#1C2028',
  card: '#21262F',
  accent: '#6366F1',
  accentLight: 'rgba(99,102,241,0.12)',
  accentBorder: 'rgba(99,102,241,0.3)',
  green: '#10B981',
  gold: '#F59E0B',
  white: '#F1F5F9',
  muted: '#6B7280',
  text: '#9CA3AF',
  textMid: '#C1C7D4',
  border: 'rgba(255,255,255,0.07)',
}

// From app/landing/LandingClient.js (T)
export const LANDING_COLORS = {
  cyan: "#16F4FF",
  cyanSoft: "#48E9FF",
  purple: "#7C5CFF",
  pink: "#FF2BAE",
  magenta: "#D83DFF",
  blue: "#248BFF",
  gold: "#FFC857",

  bgMain: "#050713",
  bgPanel: "#080B1A",
  bgCard: "rgba(10, 14, 32, 0.82)",
  bgCardSoft: "rgba(16, 20, 42, 0.72)",
  bgInput: "rgba(5, 9, 24, 0.72)",

  textMain: "#FFFFFF",
  textSoft: "#D7D9EA",
  textMuted: "#8D93AA",
  textFaint: "#5E647C",

  green: "#10B981",
  red: "#f87171",

  gradientPrimary: "linear-gradient(90deg, #16F4FF 0%, #55B8FF 28%, #7C5CFF 52%, #FF2BAE 100%)",
  panelBorderGradient: "linear-gradient(135deg, rgba(22,244,255,0.95), rgba(124,92,255,0.45), rgba(255,43,174,0.95))",
}

// From app/landing/demo/page.js (C)
export const LANDING_DEMO_COLORS = {
  bg: "#05070f", card: "#121826", card2: "#161e2e", border: "#1e2d45", border2: "#2a3f5f",
  indigo: "#7C5CFF", cyan: "#22D3EE", pink: "#EC4899", gold: "#F59E0B", blue: "#60A5FA",
  green: "#10B981", red: "#F87171", orange: "#FB923C", white: "#F1F5F9", text: "#94A3B8", muted: "#475569"
}

// From app/landing/demo/page.js (TIER_COLORS)
export const LANDING_DEMO_TIER_COLORS = { "Whale":"#F59E0B", "Shark":"#60A5FA", "Regular":"#22D3EE", "Dormant":"#FB923C" }

// From app/live/demo/page.js (C)
export const LIVE_DEMO_COLORS = {
  bg: '#05070f',
  card: 'rgba(15,20,32,0.75)',
  border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7',
  cyan: '#22d3ee',
  green: '#10b981',
  white: '#f1f5f9',
  muted: '#94a3b8',
  dim: '#475569',
  text: '#e2e8f0',
  pink: '#ec4899',
  gold: '#f59e0b',
  red: '#f87171',
  orange: '#f97316',
}

// From app/live/page.js (C)
export const LIVE_COLORS = {
  bg: '#040812', card: 'rgba(15,20,32,0.75)', border: 'rgba(168,85,247,0.2)',
  purple: '#a855f7', cyan: '#22d3ee', green: '#10b981',
  white: '#f1f5f9', muted: '#94a3b8', dim: '#475569', text: '#e2e8f0',
  pink: '#ec4899', gold: '#f59e0b', red: '#f87171', orange: '#f97316',
}

// From app/pricing/PricingClient.js (C)
export const PRICING_COLORS = {
  bg: '#050713',
  card: 'rgba(10, 14, 32, 0.82)',
  card2: 'rgba(16, 20, 42, 0.72)',
  border: 'rgba(124,92,255,0.15)',
  purple: '#7C5CFF',
  pink: '#FF2BAE',
  cyan: '#16F4FF',
  cyanSoft: '#48E9FF',
  green: '#10B981',
  white: '#FFFFFF',
  text: '#8D93AA',
  muted: '#5E647C',
  gradientPrimary:
    'linear-gradient(90deg, #16F4FF 0%, #55B8FF 28%, #7C5CFF 52%, #FF2BAE 100%)',
}

// From app/studio/page.js (C)
export const STUDIO_COLORS = {
  bg: '#05070f', card: '#0d1322', border: '#1e2d45',
  cyan: '#22D3EE', green: '#10B981', red: '#EF4444',
  white: '#F1F5F9', muted: '#475569', text: '#94A3B8',
}

// From app/tools/cam-model-name-generator/NameGeneratorClient.js (C)
export const NAME_GENERATOR_CLIENT_COLORS = {
  bg: '#030711', surface: '#0a0f1e', glass: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.08)', indigo: '#7C5CFF', cyan: '#22D3EE',
  pink: '#EC4899', white: '#F1F5F9', muted: '#475569', text: '#94A3B8',
  green: '#10B981', gold: '#F59E0B', red: '#EF4444', purple: '#A855F7',
}

// From app/tools/cam-model-name-generator/page.js (S)
export const NAME_GENERATOR_PAGE_COLORS = {
  card: '#21262F',
  gold: '#F59E0B',
  pink: '#EC4899',
  white: '#F1F5F9',
  muted: '#6B7280',
  text: '#9CA3AF',
  textStrong: '#F0F2F6',
  border: 'rgba(255,255,255,0.07)',
}

// From app/tools/profile-studio/components/theme.js (T)
export const PROFILE_STUDIO_COLORS = {
  bg: '#050713',
  bgPanel: '#080B1A',
  card: 'rgba(13,17,38,0.78)',
  cardSoft: 'rgba(16,20,42,0.6)',
  input: 'rgba(5,9,24,0.72)',
  border: 'rgba(255,255,255,0.09)',
  borderSoft: 'rgba(255,255,255,0.06)',
  cyan: '#16F4FF',
  cyanSoft: '#48E9FF',
  pink: '#FF2BAE',
  purple: '#7C5CFF',
  gold: '#FFC857',
  green: '#22C55E',
  red: '#EF4444',
  white: '#FFFFFF',
  soft: '#D7D9EA',
  muted: '#8D93AA',
  faint: '#5E647C',
}

// From app/tools/profile-studio/components/theme.js (GRADIENT)
export const PROFILE_STUDIO_GRADIENT = 'linear-gradient(90deg,#16F4FF,#7C5CFF,#FF2BAE)'

// From app/tools/profile-studio/lib/export.js (THEME_COLORS)
export const TIP_MENU_EXPORT_THEMES = {
  dark_neon: { bg: '#0a0b14', card: '#13151f', accent: '#16F4FF', accent2: '#FF2BAE', text: '#F1F5F9', muted: '#94A3B8' },
  pink_luxury: { bg: '#1a0b14', card: '#241220', accent: '#FF2BAE', accent2: '#FFC857', text: '#FDF2F8', muted: '#D8B4C8' },
  minimal_bw: { bg: '#0a0a0a', card: '#161616', accent: '#FFFFFF', accent2: '#9CA3AF', text: '#F5F5F5', muted: '#9CA3AF' },
  soft_pastel: { bg: '#fdf6f9', card: '#ffffff', accent: '#f472b6', accent2: '#60a5fa', text: '#3f2a3a', muted: '#8a7080' },
}

// From components/BlogLayout.js (S)
export const BLOG_LAYOUT_COLORS = {
  bg:         '#0F1117',
  surface:    '#1A1F2E',
  card:       '#1E2435',
  border:     'rgba(255,255,255,0.07)',
  text:       '#8B92A0',
  textMid:    '#C1C7D4',
  textStrong: '#F0F2F6',
  accent:     '#6366F1',
  accentSoft: 'rgba(99,102,241,0.12)',
  green:      '#10B981',
  pink:       '#EC4899',
}

// From components/landing/FloatingDashboardPreview.js (T)
export const FLOATING_DASHBOARD_PREVIEW_COLORS = {
  cyan: "#16F4FF",
  cyanSoft: "#48E9FF",
  purple: "#7C5CFF",
  pink: "#FF2BAE",
  gold: "#FFC857",
  green: "#10B981",
  bgCard: "rgba(10, 14, 32, 0.82)",
  bgCardSoft: "rgba(16, 20, 42, 0.72)",
  textMuted: "#8D93AA",
  textFaint: "#5E647C",
  panelBorderGradient: "linear-gradient(135deg, rgba(22,244,255,0.95), rgba(124,92,255,0.45), rgba(255,43,174,0.95))",
}

// From components/landing/PlatformsTypewriter.js (T)
export const PLATFORMS_TYPEWRITER_COLORS = {
  cyan: "#16F4FF",
  pink: "#FF2BAE",
  gold: "#FFC857",
  textFaint: "#5E647C",
}

// From components/ui/Button.js (GRADIENT)
export const BUTTON_GRADIENT = "linear-gradient(90deg,#21E6F3,#6C5CFF,#FF2FAE)"

// From components/ui/Button.js (GRADIENT_SHADOW)
export const BUTTON_GRADIENT_SHADOW = "0 0 14px rgba(33,230,243,0.16),0 0 28px rgba(255,47,174,0.10)"

// From components/ui/Button.js (GRADIENT_SHADOW_HOVER)
export const BUTTON_GRADIENT_SHADOW_HOVER = "0 0 22px rgba(33,230,243,0.28),0 0 44px rgba(255,47,174,0.18),inset 0 1px 0 rgba(255,255,255,0.3)"

// From lib/analytics/opportunity.js (LEVEL_COLORS)
export const OPPORTUNITY_LEVEL_COLORS = {
  critical: '#10b981',
  high:     '#22d3ee',
  medium:   '#f59e0b',
  low:      '#94a3b8',
  minimal:  '#475569',
}

// From app/dashboard/DashboardGrowthCharts.js (standalone constants)
export const DASHBOARD_GROWTH_CHARTS_COLORS = {
  CARD:   "#121826",
  BORDER: "#1e2d45",
  CYAN:   "#22D3EE",
  PINK:   "#EC4899",
  RED:    "#F87171",
  GREEN:  "#10B981",
  WHITE:  "#F1F5F9",
  TEXT:   "#94A3B8",
  MUTED:  "#8a93ab",
  FAINT:  "#5E647C",
}

// From app/dashboard/AnalyticsCharts.js (standalone constants)
export const ANALYTICS_CHARTS_COLORS = {
  BG:     "#0a0e1a",
  CARD:   "rgba(255,255,255,0.03)",
  BORDER: "rgba(255,255,255,0.08)",
  TEXT:   "#94A3B8",
  WHITE:  "#F1F5F9",
  MUTED:  "#475569",
  CYAN:   "#22D3EE",
  GOLD:   "#F59E0B",
  PURPLE: "#a855f7",
  GREEN:  "#22c55e",
  RED:    "#f87171",
}

// From app/dashboard/StreamPlanner.js (standalone constants)
export const STREAM_PLANNER_COLORS = {
  BG:      "#0a0e1a",
  CARD:    "rgba(255,255,255,0.03)",
  BORDER:  "rgba(255,255,255,0.08)",
  PRIMARY: "#f1f5f9",
  TEXT:    "#94a3b8",
  MUTED:   "#475569",
  FAINT:   "#64748b",
  CYAN:    "#22d3ee",
  PURPLE:  "#a855f7",
  GOLD:    "#f59e0b",
  GREEN:   "#10b981",
  RED:     "#f87171",
  INDIGO:  "#818cf8",
  GRADIENT: "linear-gradient(135deg, #22d3ee, #a855f7)",
}

// From app/dashboard/MoneyMap.js (standalone constants)
export const MONEY_MAP_COLORS = {
  BG:     "#0a0e1a",
  CARD:   "rgba(255,255,255,0.03)",
  BORDER: "rgba(255,255,255,0.08)",
  CYAN:   "#22d3ee",
  PURPLE: "#a855f7",
  PINK:   "#f472b6",
  AMBER:  "#f59e0b",
  GREEN:  "#4ade80",
  SLATE:  "#64748b",
  TEXT:   "#f1f5f9",
}

// From app/dashboard/PrivateSessions.js (standalone constants)
export const PRIVATE_SESSIONS_COLORS = {
  CARD:   "rgba(255,255,255,0.03)",
  BORDER: "rgba(255,255,255,0.08)",
  CYAN:   "#22d3ee",
  PURPLE: "#a855f7",
  PINK:   "#f472b6",
  GOLD:   "#f59e0b",
  GREEN:  "#4ade80",
  SLATE:  "#64748b",
  TEXT:   "#f1f5f9",
  MUTED:  "#94a3b8",
}
