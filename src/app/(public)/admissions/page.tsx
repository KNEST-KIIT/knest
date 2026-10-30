import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading, Section } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'Admissions — KNEST',
  description: 'Admissions at a Glance for KNEST venture cohorts. Cohort start: 13 July 2027. Download the official brochure.',
}

export default function AdmissionsPage() {
  return (
    <div>
      <PageHeader
        kicker="Admissions &amp; Cohorts"
        title="Admissions at a Glance"
        description="Stage-gated entry into university-anchored venture building. Apply with your idea, prototype, or research output."
        imageSrc="/images/stage_idea.jpg"
        imageAlt="KNEST Admissions and Cohorts"
        badgeText="Cohort Admissions · SIEL &amp; KNEST"
      />

      {/* Topmost CTA: Direct Brochure Download */}
      <Section className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)] py-6 md:py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-signal)]">
              Official Program Documentation
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-xl md:text-2xl font-bold text-[var(--color-ink)]">
              KNEST Prospectus &amp; Curriculum Brochure
            </h2>
          </div>
          <a
            href="/knest-brochure.pdf"
            download="KNEST-Official-Brochure.pdf"
            className="inline-flex items-center gap-2 border border-[var(--color-signal)] bg-[var(--color-signal)] px-6 py-3 font-bold uppercase tracking-widest text-xs text-white hover:bg-[var(--color-signal-deep)] transition-colors shrink-0"
          >
            Download Brochure (PDF) ↓
          </a>
        </div>
      </Section>

      {/* Admissions at a Glance Table / Grid */}
      <Section className="border-b border-[var(--color-line)] bg-white py-12 md:py-16">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Cohort Key Dates &amp; Parameters
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
            Admissions at a Glance
          </Heading>
          <p className="mt-3 text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
            Essential admissions schedule for upcoming incubation and venture curriculum cohorts.
          </p>
        </div>

        <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-paper)] divide-y divide-[var(--color-line)]">
          <div className="grid grid-cols-1 sm:grid-cols-3 p-5 sm:p-6 gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-semibold">
              Cohort Start
            </span>
            <div className="sm:col-span-2">
              <span className="font-bold text-lg text-[var(--color-ink)]">13 July 2027</span>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Official commencement of the 2027 venture creation cohort.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 p-5 sm:p-6 gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-semibold">
              Application Deadline
            </span>
            <div className="sm:col-span-2">
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-xs font-mono uppercase tracking-wider">
                Awaiting Confirmation · TBD
              </span>
              <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                The prior tentative deadline (16 February 2027) is outdated. The finalized deadline schedule will be published here upon institutional confirmation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 p-5 sm:p-6 gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-semibold">
              Academic Anchor
            </span>
            <div className="sm:col-span-2">
              <span className="font-bold text-base text-[var(--color-ink)]">
                School of Innovation &amp; Entrepreneurial Leadership (SIEL)
              </span>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                In partnership with KIIT Deemed to be University and KIIT-TBI.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 p-5 sm:p-6 gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-ink-muted)] font-semibold">
              Application Pathways
            </span>
            <div className="sm:col-span-2">
              <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
                Applications are reviewed on a rolling basis across stages (Exploration, Ideation, MVP, and Scaling).
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/programs"
                  className="inline-flex items-center gap-1.5 border border-[var(--color-line)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
                >
                  Browse Programs →
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1.5 border border-[var(--color-line)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
                >
                  Contact Admissions →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
