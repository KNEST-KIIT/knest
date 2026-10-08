'use client'

import { RouteError } from '@/components/errors/route-error'
import '@/styles/globals.css'

/**
 * The last-resort boundary: it renders when the root layout itself fails, so it
 * replaces the layout and must provide its own <html> and <body>. Without it a
 * failure there showed Next's unstyled default error page.
 *
 * Fonts loaded by the root layout are not available here, so the system font
 * stack is used. The wording is the same honest copy as every other error
 * boundary (no "we've been told": nothing reports errors yet, KN-21).
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <RouteError reset={reset} />
      </body>
    </html>
  )
}
