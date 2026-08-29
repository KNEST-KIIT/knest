import { Archivo, Instrument_Sans } from 'next/font/google'

/**
 * Both faces are downloaded at build time and served from our own origin —
 * there is no runtime request to a font CDN to block the first render.
 *
 * Archivo is a wide, heavy grotesk: it carries the display type at the very
 * large sizes the homepage uses without needing a second decorative face.
 * Instrument Sans is neutral enough to disappear at body size.
 */
export const displayFont = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-display-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

export const textFont = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-text-family',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})
