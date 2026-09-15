import Link from 'next/link'
import Image from 'next/image'
import { SkipLink } from '@/components/layout/skip-link'
import { Logo } from '@/components/ui'

/**
 * Premium Split-Screen Auth Portal
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <main id="main" className="flex min-h-dvh bg-white">
        {/* Left Side: Auth Forms */}
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:w-1/2 lg:px-20 xl:px-24">
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
                    Innovation Ecosystem
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
            alt="KNEST Innovation Hub"
            width={1200}
            height={1600}
            priority
          />
          {/* Overlay Gradient for contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink)] via-[var(--color-ink)]/20 to-transparent mix-blend-multiply" />
          
          {/* Right Side Overlay Content (Optional Quote/Branding) */}
          <div className="absolute bottom-12 left-12 right-12 z-10">
            <div className="max-w-xl">
              <p className="text-2xl font-[family-name:var(--font-display)] leading-tight text-white/90">
                "KNEST is the gateway for students to transition into founders. We are building the future of innovation."
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white">
                  K
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">KIIT University</p>
                  <p className="text-xs text-white/60 uppercase tracking-widest">Global Entrepreneurship</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
