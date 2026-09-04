/**
 * DESIGN TOKENS — Single source of truth for GlowMetrics styling
 *
 * Used by:
 * - CreatorReport.js
 * - Other dashboard components
 * - Ensures consistency across the platform
 */

// ============================================================
// COLOR PALETTE
// ============================================================

export const COLORS = {
  // Backgrounds
  bgBase: '#05050F',
  bgCard: 'rgba(12, 18, 32, 0.65)',
  bgCardSecondary: 'rgba(15, 22, 40, 0.55)',
  bgOverlay: 'rgba(0, 0, 0, 0.4)',
  bgInput: 'rgba(30, 40, 60, 0.4)',

  // Text (WCAG AA compliant)
  textPrimary: '#F5F8FF',
  textSecondary: '#A8B4CC',
  textTertiary: '#7A869F',
  textMuted: '#5D6B85',
  textDisabled: '#4A5568',

  // Brand Accents
  cyan: '#22D3EE',
  pink: '#EC4899',
  purple: '#A855F7',
  gold: '#F59E0B',
  green: '#10B981',
  red: '#F87171',

  // Status colors
  success: '#17D89A',
  warning: '#FCA311',
  danger: '#FF6B73',
  info: '#22D3EE',
};

// ============================================================
// TYPOGRAPHY
// ============================================================

export const TYPOGRAPHY = {
  // Headings (only 3 levels for clarity)
  h1: {
    fontSize: '28px',
    fontWeight: 900,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  h2: {
    fontSize: '18px',
    fontWeight: 850,
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },
  h3: {
    fontSize: '14px',
    fontWeight: 800,
    letterSpacing: '0em',
    lineHeight: 1.4,
  },

  // Body text
  body: {
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.6,
  },
  bodySm: {
    fontSize: '12px',
    fontWeight: 500,
    lineHeight: 1.5,
  },

  // Labels (uppercase for scanning)
  label: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    lineHeight: 1.4,
  },
  labelSm: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    lineHeight: 1.3,
  },

  // Data (KPIs, numbers)
  dataLg: {
    fontSize: '32px',
    fontWeight: 900,
    lineHeight: 1,
  },
  dataMd: {
    fontSize: '20px',
    fontWeight: 850,
    lineHeight: 1.1,
  },
  dataSm: {
    fontSize: '14px',
    fontWeight: 700,
    lineHeight: 1.2,
  },
};

// ============================================================
// SPACING
// ============================================================

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
};

// ============================================================
// SHADOWS (Hierarchy: sm → md → lg → xl)
// ============================================================

export const SHADOWS = {
  none: 'none',
  sm: '0 2px 8px rgba(0, 0, 0, 0.15)',
  md: '0 8px 24px rgba(0, 0, 0, 0.2)',
  lg: '0 16px 48px rgba(0, 0, 0, 0.25)',
  xl: '0 20px 60px rgba(0, 0, 0, 0.3)',

  // Accent glows (use sparingly, premium only)
  accentCyan: '0 0 20px rgba(34, 211, 238, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  accentPink: '0 0 20px rgba(236, 72, 153, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  accentPurple: '0 0 20px rgba(168, 85, 247, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
};

// ============================================================
// BORDERS
// ============================================================

export const BORDERS = {
  card: '1px solid rgba(100, 115, 210, 0.18)',
  cardAccent: '1px solid rgba(34, 211, 238, 0.2)',
  cardPink: '1px solid rgba(236, 72, 153, 0.2)',
  divider: '1px solid rgba(255, 255, 255, 0.06)',
  input: '1px solid rgba(130, 110, 255, 0.2)',
};

// ============================================================
// BORDER RADIUS
// ============================================================

export const RADIUS = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '999px',
};

// ============================================================
// TRANSITIONS
// ============================================================

export const TRANSITIONS = {
  fast: '0.15s ease',
  normal: '0.2s ease',
  slow: '0.3s ease',
  slower: '0.5s ease',
};

// ============================================================
// BACKDROP FILTER
// ============================================================

export const BACKDROP = {
  blur: 'blur(12px)',
  blurSm: 'blur(8px)',
  blurLg: 'blur(20px)',
};

// ============================================================
// Z-INDEX LAYERS
// ============================================================

export const Z_INDEX = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modal: 40,
  tooltip: 50,
};

// ============================================================
// HELPER: Apply multiple style objects
// ============================================================

export const mergeStyles = (...styles) => {
  return Object.assign({}, ...styles);
};

// ============================================================
// EXPORTED THEME OBJECT
// ============================================================

export const THEME = {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  SHADOWS,
  BORDERS,
  RADIUS,
  TRANSITIONS,
  BACKDROP,
  Z_INDEX,
};

export default THEME;
