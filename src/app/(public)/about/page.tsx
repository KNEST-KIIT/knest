import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading, Section } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'

export const metadata: Metadata = {
  title: 'About KNEST',
  description: 'KIIT - Nurturing Entrepreneurship & Student Talent: A university-anchored innovation ecosystem.',
}

const OBJECTIVES = [
  {
    num: '01',
    title: 'Early-Stage Ideation',
    desc: 'Enable early-stage ideation and venture creation among students across all schools of KIIT.',
  },
  {
    num: '02',
    title: 'Idea Vetting & Validation',
    desc: 'Provide structured support and empirical frameworks from initial hypothesis testing to live validation.',
  },
  {
    num: '03',
    title: 'Entrepreneurial University',
    desc: 'Position KIIT as a leading entrepreneurial university in India and globally through world-class infrastructure.',
  },
  {
    num: '04',
    title: 'Risk Absorption',
    desc: 'Offer comprehensive capacity development and institutional backing to absorb early risk for student founders.',
  },
  {
    num: '05',
    title: 'Mentors & Policy Access',
    desc: 'Facilitate direct access to mentors, markets, funding (Govt, CSR, Angels), and platforms such as NEN.',
  },
  {
    num: '06',
    title: 'Alumni-Led Ecosystem',
    desc: 'Create a self-sustaining alumni founder and operator network that continuously reinvests into student talent.',
  },
]

const PILLARS_SIEL = [
  {
    title: 'Mentored by Founders',
    desc: 'Studios, masterclasses, and 1:1 clinics led directly by active founders, CXOs, policymakers, and operators.',
  },
  {
    title: 'Incubation Support',
    desc: 'Advanced maker labs, prototype seed grants, legal and IP clinics, and investor rooms to launch faster.',
  },
  {
    title: 'Finding Opportunities',
    desc: 'Demo days, proof-of-concept seed grants, angel syndicates, and institutional venture partners backing student ventures.',
  },
  {
    title: 'Action-Based Learning',
    desc: 'Solve live industry challenges, venture simulations, and graduate with progress on your venture factored into your grade.',
  },
]

const INSTITUTIONAL_ROLES = [
  {
    group: 'School of Innovation & Entrepreneurial Leadership',
    role: 'Entrepreneurial leadership, venture development, innovation education, and bespoke startup mentorship.',
    program: 'AICTE-approved MBA - IEV Program',
    link: 'https://sld.kiit.ac.in/mba',
  },
  {
    group: 'KIIT Kareer School',
    role: 'Career guidance, startup career pathways, industry connect, and dedicated alumni engagement.',
    program: 'Industry & Placement Network',
  },
  {
    group: 'Other Schools of KIIT',
    role: 'Early identification of founder mindset, access to specialized scientific labs, operational support, and physical event space.',
    program: 'Interdisciplinary Faculties',
  },
]

const OUTCOMES = [
  { metric: '150–200', label: 'Student Startups', sub: 'Projected within a 5-year horizon' },
  { metric: '25–30', label: 'Scalable Ventures / Yr', sub: 'Venture-backed and revenue generating' },
  { metric: '100%', label: 'Incubation Pipeline', sub: 'Direct link to KIIT TBI, Startup India & Odisha' },
  { metric: 'Top Tier', label: 'Global Ranking', sub: 'Benchmark for university innovation hubs' },
]

export default function AboutPage() {
  return (
    <div>
      <PageHeader
        kicker="University Innovation Prospectus"
        title="KIIT — Nurturing Entrepreneurship & Student Talent"
        description="A university-wide innovation ecosystem designed to bridge the gap between academic theory and live venture creation."
        imageSrc="/images/stage_idea.jpg"
        imageAlt="KNEST Academic Infrastructure"
        badgeText="Innovation Ready · Enterprise Ready · Market Ready"
      />

      {/* Mission & Academic Creed */}
      <Section className="border-b border-[var(--color-line)] bg-white py-10 md:py-14">
        <div className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Institutional Mission
          </p>
          <blockquote className="mt-3 border-l-4 border-[var(--color-signal)] pl-6 text-2xl md:text-3xl font-[family-name:var(--font-display)] font-bold text-[var(--color-ink)] leading-snug">
            &ldquo;To establish a university-anchored ecosystem where ideas are transformed into
            impact-driven enterprises through disciplined experimentation, applied learning, and
            ethical leadership.&rdquo;
          </blockquote>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-widest text-[var(--color-ink-muted)]">
            <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5">
              Innovation Ready
            </span>
            <span className="text-[var(--color-signal)]">•</span>
            <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5">
              Enterprise Ready
            </span>
            <span className="text-[var(--color-signal)]">•</span>
            <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5">
              Market Ready
            </span>
          </div>
        </div>
      </Section>

      {/* Objectives Grid */}
      <Section className="border-b border-[var(--color-line)] bg-[var(--color-paper)] py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Core Mandate
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
            Objectives of the Ecosystem
          </Heading>
          <p className="mt-3 text-base md:text-lg text-[var(--color-ink-soft)] font-light">
            Six structural pillars designed to transform raw curiosity into resilient enterprises.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {OBJECTIVES.map((obj) => (
            <div
              key={obj.num}
              className="border border-[var(--color-line)] bg-white p-6 flex flex-col justify-between transition-all duration-300 hover:border-[var(--color-signal)]"
            >
              <div>
                <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-signal)] opacity-80">
                  {obj.num}
                </span>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
                  {obj.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  {obj.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* School of Innovation & Entrepreneurial Leadership */}
      <Section className="border-b border-[var(--color-line)] bg-white py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
              Academic Anchor
            </p>
            <Heading as="h2" size="display" className="mt-2 text-[var(--color-ink)] text-3xl md:text-4xl">
              School of Innovation &amp; Entrepreneurial Leadership
            </Heading>
            <p className="mt-3 text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
              Prepares future founders, innovators, and transformational leaders to explore possibilities
              at KNEST through the AICTE-approved MBA - IEV (Innovation, Entrepreneurship and Venture Development) program.
            </p>
            <div className="mt-6">
              <a
                href="https://sld.kiit.ac.in/mba"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-[var(--color-signal)] bg-[var(--color-signal)] px-6 py-2.5 font-bold uppercase tracking-widest text-xs text-white hover:bg-[var(--color-signal-deep)] transition-colors"
              >
                Explore MBA - IEV Program ↗
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 grid gap-5 sm:grid-cols-2">
            {PILLARS_SIEL.map((pillar) => (
              <div key={pillar.title} className="border border-[var(--color-line)] bg-[var(--color-paper)] p-5">
                <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Institutional Support Table */}
      <Section className="border-b border-[var(--color-line)] bg-[var(--color-paper)] py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Cross-Campus Operations
          </p>
          <Heading as="h2" size="title" className="mt-2 text-2xl md:text-3xl">
            Institutional Support Architecture
          </Heading>
          <p className="mt-3 text-[var(--color-ink-soft)]">
            How three interconnected institutional bodies share operational execution across the university.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto border border-[var(--color-line)] bg-white">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-paper-soft)]">
                <th className="py-3 px-5 font-bold uppercase tracking-wider text-xs text-[var(--color-ink)]">
                  Institutional Body
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider text-xs text-[var(--color-ink)]">
                  Core Mandate
                </th>
                <th className="py-3 px-5 font-bold uppercase tracking-wider text-xs text-[var(--color-ink)]">
                  Programs &amp; Access
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {INSTITUTIONAL_ROLES.map((row) => (
                <tr key={row.group} className="hover:bg-[var(--color-paper)]/50 transition-colors">
                  <td className="py-4 px-5 font-bold text-[var(--color-ink)] align-top w-1/3">
                    {row.group}
                  </td>
                  <td className="py-4 px-5 text-[var(--color-ink-soft)] align-top w-1/2">
                    {row.role}
                  </td>
                  <td className="py-4 px-5 text-[var(--color-signal)] font-medium align-top">
                    {row.link ? (
                      <a href={row.link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {row.program} ↗
                      </a>
                    ) : (
                      row.program
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Expected 5-Year Outcomes */}
      <Section className="border-b border-[var(--color-line)] bg-[var(--color-ink)] text-[var(--color-paper)] py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Target Metrics
          </p>
          <Heading as="h2" size="display" className="mt-2 text-white text-3xl md:text-4xl">
            Expected 5-Year Horizon Outcomes
          </Heading>
          <p className="mt-3 text-base text-[var(--color-paper)]/70 font-light">
            Empirical targets benchmarked to position KIIT as a premier global hub for student innovation.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOMES.map((item) => (
            <div key={item.label} className="border border-[var(--color-line-invert)] bg-white/5 p-6 backdrop-blur-sm">
              <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-signal)]">
                {item.metric}
              </span>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-white">
                {item.label}
              </h3>
              <p className="mt-1.5 text-xs text-[var(--color-paper)]/60">
                {item.sub}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Institutional Leadership & Contact */}
      <Section className="bg-white py-10 md:py-14">
        <div className="grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
              Direct Inquiries
            </p>
            <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
              Connect with KNEST Leadership
            </Heading>
            <p className="mt-3 text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
              Whether you are a student exploring your first venture, an alumni founder looking to mentor,
              or an institutional partner seeking collaboration, our doors are open.
            </p>

            <div className="mt-6 border-l-2 border-[var(--color-signal)] pl-6">
              <p className="font-bold text-lg text-[var(--color-ink)]">Ms. Sujata Acharya</p>
              <p className="text-sm text-[var(--color-ink-soft)]">KNEST Coordinator &amp; Administrative Lead</p>
              <a
                href="mailto:sujata.acharya@kiit.ac.in"
                className="mt-1.5 inline-block font-mono text-sm font-semibold text-[var(--color-signal)] hover:underline"
              >
                sujata.acharya@kiit.ac.in
              </a>
              <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">KIIT University, Bhubaneswar, Odisha, India</p>
            </div>
          </div>

          <div className="lg:col-span-5 border border-[var(--color-line)] bg-[var(--color-paper)] p-6">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
              Ready to take the next step?
            </h3>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              Choose the pathway that matches your current stage:
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <Link
                href="/programs"
                className="w-full text-center border border-[var(--color-signal)] bg-[var(--color-signal)] py-2.5 font-bold uppercase tracking-widest text-xs text-white hover:bg-[var(--color-signal-deep)] transition-colors"
              >
                Apply to a Program
              </Link>
              <Link
                href="/ecosystem#partners"
                className="w-full text-center border border-[var(--color-line)] bg-white py-2.5 font-bold uppercase tracking-widest text-xs text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
              >
                Partner with the Ecosystem
              </Link>
              <Link
                href="/invest"
                className="w-full text-center border border-[var(--color-line)] bg-white py-2.5 font-bold uppercase tracking-widest text-xs text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
              >
                Invest in KIIT Founders
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
