// Self-hosted Inter (root layout): the SAME .woff2 files, weights, unicode ranges,
// font-display and preload that next/font/google produced at build time (captured
// from a main build), so the build no longer downloads fonts from Google.
// next/font/local cannot set a unicode-range per file, so each range is its own
// instance (unicode-range via `declarations`); ./inter.css stacks them in the same
// priority the single Google family used and adds the exact fallback metrics.
// Arguments must be literals (next/font requirement), hence the repetition.
// Licenses: ./LICENSES.md (SIL Open Font License 1.1).

import localFont from 'next/font/local'
import './inter.css'

const interCyrillicExt = localFont({
  src: [
    { path: './inter-cyrillic-ext.woff2', weight: '400', style: 'normal' },
    { path: './inter-cyrillic-ext.woff2', weight: '500', style: 'normal' },
    { path: './inter-cyrillic-ext.woff2', weight: '600', style: 'normal' },
    { path: './inter-cyrillic-ext.woff2', weight: '700', style: 'normal' },
    { path: './inter-cyrillic-ext.woff2', weight: '800', style: 'normal' },
    { path: './inter-cyrillic-ext.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+0460-052f,u+1c80-1c8a,u+20b4,u+2de0-2dff,u+a640-a69f,u+fe2e-fe2f' }],
  variable: '--font-inter-cyrillic-ext',
})

const interCyrillic = localFont({
  src: [
    { path: './inter-cyrillic.woff2', weight: '400', style: 'normal' },
    { path: './inter-cyrillic.woff2', weight: '500', style: 'normal' },
    { path: './inter-cyrillic.woff2', weight: '600', style: 'normal' },
    { path: './inter-cyrillic.woff2', weight: '700', style: 'normal' },
    { path: './inter-cyrillic.woff2', weight: '800', style: 'normal' },
    { path: './inter-cyrillic.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+0301,u+0400-045f,u+0490-0491,u+04b0-04b1,u+2116' }],
  variable: '--font-inter-cyrillic',
})

const interGreekExt = localFont({
  src: [
    { path: './inter-greek-ext.woff2', weight: '400', style: 'normal' },
    { path: './inter-greek-ext.woff2', weight: '500', style: 'normal' },
    { path: './inter-greek-ext.woff2', weight: '600', style: 'normal' },
    { path: './inter-greek-ext.woff2', weight: '700', style: 'normal' },
    { path: './inter-greek-ext.woff2', weight: '800', style: 'normal' },
    { path: './inter-greek-ext.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+1f??' }],
  variable: '--font-inter-greek-ext',
})

const interGreek = localFont({
  src: [
    { path: './inter-greek.woff2', weight: '400', style: 'normal' },
    { path: './inter-greek.woff2', weight: '500', style: 'normal' },
    { path: './inter-greek.woff2', weight: '600', style: 'normal' },
    { path: './inter-greek.woff2', weight: '700', style: 'normal' },
    { path: './inter-greek.woff2', weight: '800', style: 'normal' },
    { path: './inter-greek.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+0370-0377,u+037a-037f,u+0384-038a,u+038c,u+038e-03a1,u+03a3-03ff' }],
  variable: '--font-inter-greek',
})

const interVietnamese = localFont({
  src: [
    { path: './inter-vietnamese.woff2', weight: '400', style: 'normal' },
    { path: './inter-vietnamese.woff2', weight: '500', style: 'normal' },
    { path: './inter-vietnamese.woff2', weight: '600', style: 'normal' },
    { path: './inter-vietnamese.woff2', weight: '700', style: 'normal' },
    { path: './inter-vietnamese.woff2', weight: '800', style: 'normal' },
    { path: './inter-vietnamese.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+0102-0103,u+0110-0111,u+0128-0129,u+0168-0169,u+01a0-01a1,u+01af-01b0,u+0300-0301,u+0303-0304,u+0308-0309,u+0323,u+0329,u+1ea0-1ef9,u+20ab' }],
  variable: '--font-inter-vietnamese',
})

const interLatinExt = localFont({
  src: [
    { path: './inter-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './inter-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: './inter-latin-ext.woff2', weight: '600', style: 'normal' },
    { path: './inter-latin-ext.woff2', weight: '700', style: 'normal' },
    { path: './inter-latin-ext.woff2', weight: '800', style: 'normal' },
    { path: './inter-latin-ext.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+0100-02ba,u+02bd-02c5,u+02c7-02cc,u+02ce-02d7,u+02dd-02ff,u+0304,u+0308,u+0329,u+1d00-1dbf,u+1e00-1e9f,u+1ef2-1eff,u+2020,u+20a0-20ab,u+20ad-20c4,u+2113,u+2c60-2c7f,u+a720-a7ff' }],
  variable: '--font-inter-latin-ext',
})

const interLatin = localFont({
  src: [
    { path: './inter-latin.woff2', weight: '400', style: 'normal' },
    { path: './inter-latin.woff2', weight: '500', style: 'normal' },
    { path: './inter-latin.woff2', weight: '600', style: 'normal' },
    { path: './inter-latin.woff2', weight: '700', style: 'normal' },
    { path: './inter-latin.woff2', weight: '800', style: 'normal' },
    { path: './inter-latin.woff2', weight: '900', style: 'normal' }
  ],
  display: 'swap',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'u+00??,u+0131,u+0152-0153,u+02bb-02bc,u+02c6,u+02da,u+02dc,u+0304,u+0308,u+0329,u+2000-206f,u+20ac,u+2122,u+2191,u+2193,u+2212,u+2215,u+feff,u+fffd' }],
  variable: '--font-inter-latin',
})

// Every range's CSS variable + the class that stacks them (see fonts.css).
export const interClassName = [interLatin.variable, interLatinExt.variable, interVietnamese.variable, interGreek.variable, interGreekExt.variable, interCyrillic.variable, interCyrillicExt.variable, 'font-inter'].join(' ')
