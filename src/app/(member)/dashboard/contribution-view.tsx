import { ButtonLink, Heading, LinkCard } from '@/components/ui'
import { NextStepCard } from './next-step-card'

const journeys = {
  investor: {
    heading: 'Meet the ventures taking shape.',
    body: 'Explore public startup profiles, founder stories and upcoming demo days. Ask the KNEST team about a specific venture when you are ready.',
    actionLabel: 'Explore the ecosystem', actionHref: '/invest',
    contact: 'Talk to the KNEST team', topic: 'partnership',
  },
  alumni: {
    heading: 'Bring your experience back to the community.',
    body: 'Offer mentoring, share a lesson with founders or join an upcoming event. Tell the team how you would like to contribute.',
    actionLabel: 'Offer your support', actionHref: '/contact?topic=mentor',
    contact: 'Discuss another way to help', topic: 'partnership',
  },
  partner: {
    heading: 'Build a partnership with KNEST.',
    body: 'Tell the team what your organization can offer and what you hope to achieve together. The team will review your enquiry and reply by email.',
    actionLabel: 'Start a partnership conversation', actionHref: '/contact?topic=partnership',
    contact: 'Ask a general question', topic: 'general',
  },
} as const

export function ContributionDashboard({ role }: { role: keyof typeof journeys }) {
  const journey = journeys[role]
  return <div className="space-y-10">
    <NextStepCard eyebrow="Your next step" heading={journey.heading} body={journey.body} actionLabel={journey.actionLabel} actionHref={journey.actionHref} />
    <section>
      <Heading as="h2" size="title">Stay connected</Heading>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <LinkCard href="/events" label="Browse upcoming events"><p className="font-medium">Upcoming events</p><p className="mt-2">Find a session or demo day and register.</p></LinkCard>
        <LinkCard href="/startups" label="Meet the startups"><p className="font-medium">Meet the startups</p><p className="mt-2">See public profiles and what founders are building.</p></LinkCard>
      </div>
    </section>
    <ButtonLink href={`/contact?topic=${journey.topic}`} variant="secondary">{journey.contact}</ButtonLink>
  </div>
}
