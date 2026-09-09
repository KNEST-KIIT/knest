import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink, Card, Heading, Section } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'

export const metadata: Metadata = {
  title: 'About',
  description:
    'KNEST is KIIT’s university-wide innovation and entrepreneurship ecosystem — what it is for, who runs it, and where it is going.',
}

const OBJECTIVES = [
  {
    title: 'Start ventures early',
    body: 'Enable early-stage ideation and venture creation among students, while they still have four years and nothing to lose.',
  },
  {
    title: 'Support the unglamorous middle',
    body: 'Provide structured support from idea vetting through validation — the stretch where most student ideas quietly stop.',
  },
  {
    title: 'Make KIIT a founding university',
    body: 'Position KIIT as a leading entrepreneurial university in India, measured by what its students build, not by what it announces.',
  },
  {
    title: 'Build risk capacity',
    body: 'Grow students’ ability to carry the risk of founding something — financial, academic and personal — rather than pretending it isn’t there.',
  },
  {
    title: 'Open the doors that are usually shut',
    body: 'Give founders access to mentors, markets, funding and policy platforms, including NEN, the National Entrepreneurship Network.',
  },
  {
    title: 'Let alumni carry it forward',
    body: 'Create a sustainable, alumni-led startup ecosystem, so each generation of founders shortens the path for the next.',
  },
]

const UNITS = [
  {
    name: 'School of Innovation & Entrepreneurial Leadership',
    role: 'The academic anchor',
    body: 'Entrepreneurial leadership, venture development, innovation education and startup mentorship — including the AICTE-approved MBA in Innovation, Entrepreneurship & Venture Development.',
    href: 'https://sld.kiit.ac.in/mba',
    linkLabel: 'About the MBA–IEV program',
  },
  {
    name: 'KIIT Kareer School',
    role: 'The bridge to work and alumni',
    body: 'Career guidance, startup careers, industry connections and alumni engagement — the reason a student can choose a venture without treating it as a career dead end.',
  },
  {
    name: 'Other schools of KIIT',
    role: 'The labs and the early signal',
    body: 'Identifying a founder mindset early, lab access, operational support and physical space for scoping sessions and events.',
  },
]

const TEAM = [
  {
    name: 'Ms Sujata Acharya',
    role: 'First point of contact',
    body: 'Programs, partnerships and anything you are not sure who to ask about. Write here first and you will be pointed to the right person.',
    email: 'sujata.acharya@kiit.ac.in',
  },
  {
    name: 'Faculty leads',
    role: 'School of Innovation & Entrepreneurial Leadership',
    body: 'Curriculum, venture development, and the academic side of taking a student idea seriously — including how founding work is assessed rather than tolerated.',
  },
  {
    name: 'Mentors in residence',
    role: 'Founders, operators, investors',
    body: 'People who have built things, made the mistakes, and will tell you about both. They are vouched for by KNEST rather than self-listed.',
    href: '/mentors',
    linkLabel: 'Meet the mentors',
  },
  {
    name: 'Alumni founders',
    role: 'The bridge outward',
    body: 'KIIT alumni bring real problems, market gaps that matter, a sounding board, and the handholding that turns a prototype into a first customer.',
  },
]

const FIVE_YEAR_GOALS = [
  { figure: '150–200', label: 'student startups within five years' },
  { figure: '25–30', label: 'scalable ventures a year' },
  { figure: 'Startup India', label: 'and Startup Odisha — a pipeline strong enough to feed both' },
  { figure: 'Alumni-led', label: 'a founder network deep enough to sustain itself' },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="A university that builds things."
        image="/images/hero_team.jpg"
        lede="KNEST is KIIT’s innovation and entrepreneurship ecosystem: the programs, mentors, space, capital and people that stand between a student noticing a problem and a student doing something about it."
      />

      <Section padding="tight">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <Heading as="h2" size="title">
              What the name means
            </Heading>
            <p className="mt-5 max-w-[52ch] text-[var(--color-ink-soft)]">
              <strong>K</strong>IIT, <strong>N</strong>urturing <strong>E</strong>ntrepreneurship &amp;{' '}
              <strong>S</strong>tudent <strong>T</strong>alent. It is a plain description rather than a
              slogan, and that is deliberate: KNEST is a university-wide ecosystem, not a single office
              with a door and a nameplate.
            </p>
            <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
              It runs across the schools of KIIT, the alumni who came out of them, and the partners who
              give a student venture somewhere to go next.{' '}
              <Link href="/ecosystem" className="underline underline-offset-2">
                See how the parts fit together
              </Link>
              .
            </p>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8 md:p-10">
            <p className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
              Our mission
            </p>
            <blockquote className="mt-5 font-[family-name:var(--font-display)] text-[length:var(--text-heading)] leading-snug text-[var(--color-ink)]">
              &ldquo;To establish a university-anchored ecosystem where ideas are transformed into
              impact-driven enterprises through disciplined experimentation, applied learning, and
              ethical leadership.&rdquo;
            </blockquote>
            <p className="mt-6 text-[length:var(--text-small)] font-semibold uppercase tracking-[0.14em] text-[var(--color-signal)]">
              Innovation ready . Enterprise ready . Market ready
            </p>
          </div>
        </div>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          What KNEST is for
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          Six objectives. They are the standard we hold ourselves to, and the shortest honest answer to
          &ldquo;why does this exist?&rdquo;
        </p>
        <ol className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {OBJECTIVES.map((objective, i) => (
            <li key={objective.title}>
              <Card className="h-full">
                <span
                  aria-hidden
                  className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] font-semibold text-[var(--color-signal)]"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <Heading as="h3" size="heading" className="mt-3">
                  {objective.title}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                  {objective.body}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Who runs it
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          Three parts of KIIT share the operational load. None of them could do this alone, which is the
          point.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {UNITS.map((unit) => (
            <Card key={unit.name} className="flex h-full flex-col">
              <p className="text-[length:var(--text-micro)] font-semibold uppercase tracking-[0.14em] text-[var(--color-archive)]">
                {unit.role}
              </p>
              <Heading as="h3" size="heading" className="mt-3">
                {unit.name}
              </Heading>
              <p className="mt-3 flex-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {unit.body}
              </p>
              {unit.href && (
                <a
                  href={unit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)] underline underline-offset-2"
                >
                  {unit.linkLabel} ↗
                </a>
              )}
            </Card>
          ))}
        </div>
      </Section>

      <Section id="team" padding="tight" className="scroll-mt-24 border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          The team
        </Heading>
        <p className="mt-4 max-w-[60ch] text-[var(--color-ink-soft)]">
          KNEST is run by people, not by a department code. Here is who holds which part of it, and who
          to write to when you would rather talk to someone than read a page.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {TEAM.map((member) => (
            <Card key={member.name} className="flex h-full flex-col">
              <Heading as="h3" size="heading">
                {member.name}
              </Heading>
              <p className="mt-1 text-[length:var(--text-small)] font-medium text-[var(--color-archive)]">
                {member.role}
              </p>
              <p className="mt-3 flex-1 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {member.body}
              </p>
              {member.email && (
                <a
                  href={`mailto:${member.email}`}
                  className="mt-5 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)] underline underline-offset-2"
                >
                  {member.email}
                </a>
              )}
              {member.href && (
                <Link
                  href={member.href}
                  className="mt-5 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)] underline underline-offset-2"
                >
                  {member.linkLabel} →
                </Link>
              )}
            </Card>
          ))}
        </div>

        <p className="mt-8 max-w-[60ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          Individual profiles — faculty leads, program managers, mentors in residence — are published
          here as each appointment is confirmed. We would rather name nobody than name a placeholder.
        </p>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Where we are going
        </Heading>
        <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
          These are goals for a five-year horizon, not things that have already happened. When they turn
          into results, you will see them on the{' '}
          <Link href="/startups" className="underline underline-offset-2">
            startups page
          </Link>{' '}
          with names attached.
        </p>
        <dl className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FIVE_YEAR_GOALS.map((goal) => (
            <div
              key={goal.figure}
              className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
            >
              <dt className="font-[family-name:var(--font-display)] text-[length:var(--text-title)] font-semibold leading-tight text-[var(--color-ink)]">
                {goal.figure}
              </dt>
              <dd className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                {goal.label}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="grid gap-6 lg:grid-cols-2">
          <div
            id="partner"
            className="scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8 md:p-10"
          >
            <Heading as="h2" size="heading">
              Partner with us
            </Heading>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              KNEST works with industry, government and academic partners on market access, mentorship,
              infrastructure and capital. If your organisation wants a way into a university pipeline
              that is being built now rather than one that closed years ago, this is the moment to talk.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/about#contact" size="md">
                Start a conversation
              </ButtonLink>
              <ButtonLink href="/ecosystem#partners" variant="secondary" size="md">
                See current partners
              </ButtonLink>
            </div>
          </div>

          <div
            id="contact"
            className="scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10"
          >
            <Heading as="h2" size="heading">
              Get in touch
            </Heading>
            <p className="mt-3 text-[var(--color-ink-soft)]">
              School of Innovation &amp; Entrepreneurial Leadership, KIIT Deemed to be University,
              Bhubaneswar, Odisha.
            </p>
            <p className="mt-4 text-[var(--color-ink-soft)]">
              For anything that does not fit a form:{' '}
              <a
                href="mailto:sujata.acharya@kiit.ac.in"
                className="font-medium text-[var(--color-signal)] underline underline-offset-2"
              >
                sujata.acharya@kiit.ac.in
              </a>
            </p>
            <p className="mt-6 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              Founder, mentor, partner or investor — the fastest way in is the pathway that fits:
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink href="/programs" size="md">
                Apply to a program
              </ButtonLink>
              <ButtonLink href="/mentors#become-a-mentor" variant="secondary" size="md">
                Become a mentor
              </ButtonLink>
              <ButtonLink href="/invest" variant="secondary" size="md">
                Invest
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
