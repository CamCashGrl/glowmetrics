// Self-hosted DM Sans (/landing only, as before): the SAME .woff2 files, weights, unicode ranges,
// font-display and preload that next/font/google produced at build time (captured
// from a main build), so the build no longer downloads fonts from Google.
// next/font/local cannot set a unicode-range per file, so each range is its own
// instance (unicode-range via `declarations`); ./dm-sans.css stacks them in the same
// priority the single Google family used and adds the exact fallback metrics.
// Arguments must be literals (next/font requirement), hence the repetition.
// Licenses: ./LICENSES.md (SIL Open Font License 1.1).

import localFont from 'next/font/local'
import './dm-sans.css'

const dmsansLatinExt = localFont({
  src: [
    { path: './dm-sans-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './dm-sans-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: './dm-sans-latin-ext.woff2', weight: '600', style: 'normal' },
    { path: './dm-sans-latin-ext.woff2', weight: '700', style: 'normal' },
    { path: './dm-sans-latin-ext.woff2', weight: '800', style: 'normal' },
    { path: './dm-sans-latin-ext.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+0100-02ba,u+02bd-02c5,u+02c7-02cc,u+02ce-02d7,u+02dd-02ff,u+0304,u+0308,u+0329,u+1d00-1dbf,u+1e00-1e9f,u+1ef2-1eff,u+2020,u+20a0-20ab,u+20ad-20c4,u+2113,u+2c60-2c7f,u+a720-a7ff' }],
  variable: '--font-dm-sans-latin-ext',
})

const dmsansLatin = localFont({
  src: [
    { path: './dm-sans-latin.woff2', weight: '400', style: 'normal' },
    { path: './dm-sans-latin.woff2', weight: '500', style: 'normal' },
    { path: './dm-sans-latin.woff2', weight: '600', style: 'normal' },
    { path: './dm-sans-latin.woff2', weight: '700', style: 'normal' },
    { path: './dm-sans-latin.woff2', weight: '800', style: 'normal' },
    { path: './dm-sans-latin.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+00??,u+0131,u+0152-0153,u+02bb-02bc,u+02c6,u+02da,u+02dc,u+0304,u+0308,u+0329,u+2000-206f,u+20ac,u+2122,u+2191,u+2193,u+2212,u+2215,u+feff,u+fffd' }],
  variable: '--font-dm-sans-latin',
})

// Every range's CSS variable + the class that stacks them (see fonts.css).
export const dmSansClassName = [dmsansLatin.variable, dmsansLatinExt.variable, 'font-dm-sans'].join(' ')
