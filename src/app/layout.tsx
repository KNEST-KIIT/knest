import type { Metadata } from 'next'
import { displayFont, textFont } from '@/styles/fonts'
import '@/styles/globals.css'

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  'http://localhost:3000'

export const metadata: Metadata = {
  title: { default: 'KNEST', template: '%s — KNEST' },
  description:
    "KNEST is KIIT's innovation and entrepreneurship ecosystem: programs, mentors, workspace and community for students building things — at every stage, including the stage where you have nothing but a question.",
  metadataBase: new URL(siteUrl),
  icons: {
    icon: '/images/knest_icon.png',
    shortcut: '/images/knest_icon.png',
    apple: '/images/knest_icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${displayFont.variable} ${textFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}
