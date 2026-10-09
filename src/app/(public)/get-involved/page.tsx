import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/page-header'
import { Heading, Section } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Get involved',
  description: 'Ways to take part in KNEST: apply, join an event, mentor, or partner.',
}

/** Every route below exists; there are no claims here, only ways in. */
const WAYS = [
  { title: 'Apply to a program', body: 'See the programs that are open and what each one asks of you.', href: '/programs', cta: 'Browse programs' },
  { title: 'Join an event', body: 'Workshops, talks and sessions you can register for.', href: '/events', cta: 'See events' },
  { title: 'Meet the mentors', body: 'The people who work with founders in the ecosystem.', href: '/mentors', cta: 'See mentors' },
  { title: 'Explore the startups', body: 'Ventures that are part of KNEST.', href: '/startups', cta: 'See startups' },
  { title: 'Offer to mentor or partner', body: 'Tell us how you would like to help and the team will reply.', href: '/contact', cta: 'Send a message' },
  { title: 'Invest or collaborate', body: 'How investors and partners work with KNEST.', href: '/invest', cta: 'Read more' },
]

export default function GetInvolvedPage() {
  return (
    <>
      <PageHeader kicker="Get involved" title="Find your way in" description="Whether you are a student with an idea, a mentor, or a partner, here is where to start." />
      <Section>
        <ul className="mx-auto grid w-full max-w-[1080px] gap-6 md:grid-cols-2">
          {WAYS.map((way) => (
            <li key={way.href + way.title} className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-6">
              <Heading as="h2" size="heading">
                {way.title}
              </Heading>
              <p className="mt-2 text-[var(--color-ink-soft)]">{way.body}</p>
              <Link href={way.href} className="mt-4 inline-block font-semibold text-[var(--color-signal)] underline underline-offset-4">
                {way.cta}
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
