import { Bricolage_Grotesque, Instrument_Sans, Instrument_Serif } from 'next/font/google'

/**
 * KNEST's visual identity, re-drawn (full re-brand, replacing the pitch-deck-
 * matched Anton/Caveat pairing). All three downloaded at build time and
 * served from our own origin — no runtime request to a font CDN blocking
 * first render.
 *
 * Bricolage Grotesque is a variable display face with real range (500-800
 * used here) rather than Anton's single fixed weight — it carries the same
 * "confident, modern, a little kinetic" energy the brand wants without
 * forcing every heading to the same maximum-heaviness register. Instrument
 * Sans stays the body face: already proven readable across this codebase,
 * no reason to introduce risk there in a re-brand that's about identity, not
 * legibility. Instrument Serif's italic is the new accent — an editorial,
 * premium touch for the sparing pull-quote-style moments the old Caveat
 * handwritten face covered, reserved the same way: the homepage narrative,
 * not utilitarian screens.
 */
export const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

export const accentFont = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  variable: '--font-accent-family',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
})

export const textFont = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-text-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})
