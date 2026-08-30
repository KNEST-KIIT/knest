import type { Metadata } from 'next'
import { MotionProvider } from '@/components/motion'
import { ToastProvider } from '@/components/ui'
import { accentFont, displayFont, textFont } from '@/styles/fonts'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'KNEST', template: '%s — KNEST' },
  description:
    "KNEST is KIIT's innovation and entrepreneurship ecosystem: programs, mentors, workspace and community for students building things — at every stage, including the stage where you have nothing but a question.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${textFont.variable} ${accentFont.variable}`}>
      <head>
        {/*
          Scroll reveals start at opacity 0 and are brought in by JavaScript.
          If JavaScript never runs, that would leave the page blank — so the
          one case we can detect declaratively is handled declaratively.
          Every element the motion primitives animate carries `data-reveal`.
        */}
        <noscript>
          <style>{'[data-reveal]{opacity:1!important;transform:none!important}'}</style>
        </noscript>
      </head>
      <body>
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
