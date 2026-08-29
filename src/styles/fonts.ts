import { Anton, Caveat, Instrument_Sans } from 'next/font/google'

/**
 * All three downloaded at build time and served from our own origin — no
 * runtime request to a font CDN blocking first render.
 *
 * Anton is a heavy condensed poster face, matching the KNEST pitch deck's
 * headline treatment directly (it ships one weight, which is already the
 * deck's "always heavy, always caps" look — there is no lighter cut to pick
 * by mistake). Caveat is the handwritten accent seen sparingly on the deck's
 * cover and closing slide; it is available as a token but not wired into any
 * component yet — reserved for the public homepage narrative (Phase 8),
 * not the utilitarian screens already built (spec: restraint is what makes
 * the signature moments land). Instrument Sans remains the body face; the
 * brand deck doesn't specify one, and it stays neutral against the new
 * palette.
 */
export const displayFont = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

export const accentFont = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-accent-family',
  display: 'swap',
  fallback: ['cursive'],
})

export const textFont = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-text-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})
