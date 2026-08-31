import type { Metadata } from 'next'
import { MotionProvider } from '@/components/motion/provider'
import { displayFont, textFont } from '@/styles/fonts'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'KNEST', template: '%s — KNEST' },
  description:
    "KNEST is KIIT's innovation and entrepreneurship ecosystem: programs, mentors, workspace and community for students building things — at every stage, including the stage where you have nothing but a question.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${displayFont.variable} ${textFont.variable}`}>
      <head>
        {/*
          Every scroll reveal renders its hidden state on the server, so the
          markup ships with the hero headline translated 302px down inside an
          `overflow-hidden` line box and seven `Reveal` wrappers at opacity 0.
          With scripting unavailable that is what stays on screen: measured
          with JavaScript disabled, the landing page renders essentially
          blank, headline included. The copy is all in the HTML — a crawler
          reads it — but a person sees nothing.

          Motion writes those states as inline styles, which a stylesheet can
          only beat with `!important`. This restores the resting appearance
          for that case and costs nothing when scripting works, since the
          block is inert then.
        */}
        <noscript
          dangerouslySetInnerHTML={{
            __html:
              '<style>[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}</style>',
          }}
        />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}
