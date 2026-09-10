import Link from 'next/link'
import { SkipLink } from '@/components/layout/skip-link'
import { Logo } from '@/components/ui'

/**
 * Centred institutional auth portal with official KNEST branding.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--color-paper)] px-4 py-12 sm:px-6 md:py-16"
      >
        {/* Ambient background styling */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#0d1321_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.035]" />
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[420px] w-[650px] bg-gradient-to-b from-[var(--color-signal)]/12 via-[var(--color-signal)]/4 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 h-[300px] w-[500px] bg-[var(--color-ink)]/5 blur-3xl rounded-full" />

        <div className="relative z-10 w-full max-w-[390px]">
          {/* Official Brand Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <Link
              href="/"
              className="group inline-flex flex-col items-center gap-2 transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-[var(--color-signal)]"
              aria-label="KNEST Home"
            >
              <Logo size="md" />
              <span className="text-[9.5px] font-bold uppercase tracking-[0.25em] text-[var(--color-ink-muted)] group-hover:text-[var(--color-signal)] transition-colors">
                KIIT University • Innovation Ecosystem
              </span>
            </Link>
          </div>

          {/* Premium Glass Card */}
          <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)]/70 bg-white/95 p-6 sm:p-7 shadow-[0_16px_40px_-10px_rgba(13,19,33,0.07),0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-xl">
            {/* Top signature accent bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[var(--color-signal)] to-transparent opacity-80" />
            
            {children}
          </div>

          {/* Institutional Trust Footer */}
          <div className="mt-8 flex items-center justify-center gap-3 text-xs text-[var(--color-ink-muted)]">
            <Link
              href="/"
              className="hover:text-[var(--color-signal)] transition-colors font-medium"
            >
              ← Back to homepage
            </Link>
            <span>•</span>
            <span>Encrypted Session</span>
          </div>
        </div>
      </main>
    </>
  )
}
