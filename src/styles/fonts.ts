import { Fraunces, Instrument_Sans } from 'next/font/google'

/**
 * KNEST's visual identity — second pass. Both downloaded at build time and
 * served from our own origin — no runtime request to a font CDN blocking
 * first render.
 *
 * Fraunces is the display face: a variable serif with real optical-size and
 * weight range (400-700 loaded here, plus its own italic), chosen
 * specifically to move away from the sans-only "startup landing page"
 * vocabulary the first re-brand pass fell into — a serif with editorial
 * weight reads as considered and institutional, which is what KNEST
 * actually is (a university-anchored ecosystem, not a funded startup).
 * Its own italic covers the sparing narrative-accent role a separate third
 * typeface used to (first Caveat, then Instrument Serif) — one core face
 * doing both jobs is a more deliberate type system than three faces each
 * doing one. Instrument Sans stays the body face: already proven readable
 * across this codebase, and a re-brand is about identity, not
 * re-litigating body-copy legibility.
 */
export const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display-family',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
})

export const textFont = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-text-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})
