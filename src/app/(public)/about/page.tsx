import type { Metadata } from 'next'
import Link from 'next/link'
import { Container, Heading } from '@/components/ui'

export const metadata: Metadata = {
  title: 'About',
  description: 'What KNEST is, who runs it, and what it exists to do.',
}

const OBJECTIVES = [
  'Enable early-stage ideation and venture creation among students.',
  'Provide structured support from idea vetting through validation.',
  'Position KIIT as a leading entrepreneurial university in India.',
  "Build students' capacity to take on the risk of founding something.",
  'Give founders access to mentors, markets, funding and policy platforms — including NEN, the National Entrepreneurship Network.',
  'Create a sustainable, alumni-led startup ecosystem.',
]

const RESPONSIBILITIES = [
  {
    group: 'School of Innovation & Entrepreneurial Leadership',
    role: 'Entrepreneurial leadership, venture development, innovation education, startup mentorship',
  },
  {
    group: 'KIIT Kareer School',
    role: 'Career guidance, startup careers, industry connections, alumni engagement',
  },
  {
    group: 'Other KIIT schools',
    role: 'Identifying founder mindset early, lab access, operational support, physical space',
  },
]

const FIVE_YEAR_GOALS = [
  '150–200 student startups within five years',
  '25–30 scalable ventures per year',
  'A strong pipeline into Startup India and Startup Odisha',
  'Deeper industry collaboration, a stronger alumni founder network, improved national and global rankings',
]

export default function AboutPage() {
  return (
    <Container size="reading" className="py-16">
      <p className="text-[length:var(--text-micro)] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
        About
      </p>
      <Heading as="h1" size="display" className="mt-4">
        KNEST.
      </Heading>
      <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">
        KIIT, Nurturing Entrepreneurship &amp; Student Talent.
      </p>

      <blockquote className="mt-10 border-l-2 border-[var(--color-signal)] pl-6 text-[length:var(--text-heading)] italic text-[var(--color-ink-soft)]">
        &ldquo;To establish a university-anchored ecosystem where ideas are transformed into
        responsible enterprises and institutions through disciplined experimentation, applied
        learning, and ethical leadership.&rdquo;
      </blockquote>

      <p className="mt-8 text-[length:var(--text-small)] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
        Innovation ready . Enterprise ready . Market ready
      </p>

      <section className="mt-16">
        <Heading as="h2" size="title">
          What KNEST is for
        </Heading>
        <ol className="mt-6 flex flex-col gap-4">
          {OBJECTIVES.map((objective, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-[family-name:var(--font-display)] text-[length:var(--text-heading)] text-[var(--color-signal)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[var(--color-ink-soft)]">{objective}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16">
        <Heading as="h2" size="title">
          Who runs it
        </Heading>
        <p className="mt-4 text-[var(--color-ink-soft)]">
          Three groups share the operational load across KIIT.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[length:var(--text-small)]">
            <tbody className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {RESPONSIBILITIES.map((row) => (
                <tr key={row.group}>
                  <th scope="row" className="w-2/5 py-4 pr-4 align-top font-medium">
                    {row.group}
                  </th>
                  <td className="py-4 text-[var(--color-ink-soft)]">{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16">
        <Heading as="h2" size="title">
          Our five-year goals
        </Heading>
        <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          These are targets for a five-year horizon, not current facts.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {FIVE_YEAR_GOALS.map((goal, i) => (
            <li key={i} className="flex gap-3 text-[var(--color-ink-soft)]">
              <span aria-hidden className="text-[var(--color-signal)]">
                →
              </span>
              {goal}
            </li>
          ))}
        </ul>
      </section>

      <section id="partner" className="mt-16 scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8">
        <Heading as="h2" size="heading">
          Partner with us
        </Heading>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          KNEST works with industry, government and academic partners on market access, mentorship
          and infrastructure. See who&rsquo;s already involved on the{' '}
          <Link href="/ecosystem#partners" className="underline underline-offset-2">
            ecosystem page
          </Link>
          , or reach out below.
        </p>
      </section>

      <section id="contact" className="mt-8 scroll-mt-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8">
        <Heading as="h2" size="heading">
          Get in touch
        </Heading>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          KIIT University, Bhubaneswar, Odisha.
        </p>
        <p className="mt-3 text-[var(--color-ink-soft)]">
          Founder, mentor, partner or investor — the fastest way in is the pathway that fits:
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/programs"
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-signal)] px-5 text-[length:var(--text-small)] font-medium text-white hover:bg-[var(--color-signal-deep)]"
          >
            Apply to a program
          </Link>
          <Link
            href="/mentors#become-a-mentor"
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] px-5 text-[length:var(--text-small)] font-medium hover:border-[var(--color-ink)]"
          >
            Become a mentor
          </Link>
          <Link
            href="/invest"
            className="inline-flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] px-5 text-[length:var(--text-small)] font-medium hover:border-[var(--color-ink)]"
          >
            Invest in the ecosystem
          </Link>
        </div>
      </section>
    </Container>
  )
}
