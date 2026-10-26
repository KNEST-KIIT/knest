import Link from 'next/link'
import Image from 'next/image'
import { SkipLink } from '@/components/layout/skip-link'
import { Logo } from '@/components/ui'
import SiteDocument from '@/components/layout/site-document'
export { metadata } from '@/components/layout/site-document'

/**
 * Premium Split-Screen Auth Portal
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteDocument>
      <SkipLink />
      <main id="main" className="flex min-h-dvh bg-white">
        {/* Left Side: Auth Forms */}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-sm">
            {/* Brand Header */}
            <div className="mb-10">
              <Link
                href="/"
                className="group inline-flex items-center gap-3 transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-[var(--color-signal)]"
                aria-label="KNEST Home"
              >
                <Logo size="md" />
                <div className="flex flex-col">
                  <span className="text-xl font-[family-name:var(--font-display)] font-bold tracking-tight text-[var(--color-ink)]">
                    KNEST
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--color-ink-muted)] group-hover:text-[var(--color-signal)] transition-colors">
                    Student Talent &amp; Ventures
                  </span>
                </div>
              </Link>
            </div>

            {/* Auth Content */}
            <div className="relative z-10 w-full">
              {children}
            </div>

            {/* Footer Trust Markers */}
            <div className="mt-12 flex items-center gap-3 text-[11px] text-[var(--color-ink-muted)]">
              <Link href="/" className="hover:text-[var(--color-signal)] transition-colors font-medium">
                ← Back to homepage
              </Link>
              <span>•</span>
              <span className="flex items-center gap-1">
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Environment
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Cinematic Image */}
        <div className="relative hidden w-0 flex-1 lg:block bg-[var(--color-ink)]">
          <Image
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            src="/auth-cover.jpg"
            alt="KNEST · KIIT University"
            width={1200}
            height={1600}
            priority
          />
          {/* Overlay Gradient for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)] via-[var(--color-ink)]/20 to-transparent mix-blend-multiply" />
          
          {/* Right Side Overlay Content */}
          <div className="absolute bottom-12 left-12 right-12 z-10">
            <div className="max-w-xl">
              <p className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold leading-tight text-white">
                What if you actually built it?
              </p>
              <p className="mt-2 text-sm text-white/80 leading-relaxed">
                Structured support from first prototype to funded venture.
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--color-paper-soft)] font-mono font-medium">
                <span>School of Innovation &amp; Entrepreneurship</span>
                <span>·</span>
                <span>KIIT</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </SiteDocument>
  )
}
