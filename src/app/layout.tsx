import type { Metadata } from 'next'
import { displayFont, textFont } from '@/styles/fonts'
import '@/styles/globals.css'

const DESCRIPTION =
  "KNEST is KIIT's innovation and entrepreneurship ecosystem: programs, mentors, workspace and community for students building things — at every stage, including the stage where you have nothing but a question."

/**
 * `openGraph` and `twitter` were absent entirely, so every link to KNEST
 * shared in a WhatsApp group, a Slack channel or a LinkedIn post unfurled as
 * a bare URL — on a site whose whole distribution model is students sending
 * each other links.
 *
 * Neither block declares its own `title`: with one here, every page's card
 * read "KNEST" (measured — /about's og:title came back as the root default,
 * not "About — KNEST"). Left absent, each page's own `title` fills it, so a
 * shared program or startup link says what it actually is.
 *
 * `alternates.canonical: './'` resolves per page against `metadataBase`,
 * which also gives `og:url` the real page URL instead of pinning every card
 * to the homepage.
 */
export const metadata: Metadata = {
  title: { default: 'KNEST', template: '%s — KNEST' },
  description: DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  alternates: { canonical: './' },
  openGraph: {
    type: 'website',
    siteName: 'KNEST',
    locale: 'en_IN',
    description: DESCRIPTION,
    images: [
      {
        url: '/images/hero_team.jpg',
        width: 1376,
        height: 768,
        alt: 'Students working together at KIIT.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    description: DESCRIPTION,
    images: ['/images/hero_team.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${displayFont.variable} ${textFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
