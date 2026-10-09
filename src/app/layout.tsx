import type { Metadata } from 'next'
import { displayFont, textFont } from '@/styles/fonts'
import { siteUrl as getSiteUrl } from '@/lib/site-url'
import '@/styles/globals.css'
import { MotionProvider } from '@/components/motion-provider'

const siteUrl = getSiteUrl()

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
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
