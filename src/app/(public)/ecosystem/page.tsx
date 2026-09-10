import type { Metadata } from 'next'
import Link from 'next/link'
import { ButtonLink, Card, EmptyState, Heading, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { TripleHelix } from '@/components/content/triple-helix'
import { MetricsBand } from '@/components/content/metrics-band'
import { partnerTypeLabel, spaceTypeLabel } from '@/lib/labels'
import { listInfrastructure } from '@/server/content/infrastructure'
import { listMetrics } from '@/server/content/metrics'
import { listPartners } from '@/server/content/partners'

export const metadata: Metadata = {
  title: 'Ecosystem',
  description:
    'How KNEST works — the three pillars behind it, the spaces being built, the partners beyond campus, and the alumni who connect the two.',
}

/**
 * The six domains of KNEST's own ecosystem framework, from the official deck.
 * Not a marketing list: it is the map staff use to decide what belongs inside
 * KNEST and what does not.
 */
const FRAMEWORK = [
  {
    domain: 'Innovation',
    parts: ['Design thinking', 'Problem solving', 'Interdisciplinary learning'],
  },
  {
    domain: 'Entrepreneurship',
    parts: ['Mentorship', 'Startup support', 'Business development'],
  },
  {
    domain: 'Funding',
    parts: ['Government schemes', 'CSR', 'Investors'],
  },
  {
    domain: 'Commercialisation',
    parts: ['IPR', 'Technology transfer', 'Industry partnerships'],
  },
  {
    domain: 'Societal impact',
    parts: ['Jobs through startups', 'Technology', 'Sustainable development'],
  },
  {
    domain: 'Academic excellence',
    parts: ['Teaching', 'Research', 'Student projects'],
  },
]

/**
 * The spaces KNEST has committed to building, straight from the official
 * deck. They are shown as commitments and labelled as such — a planned maker
 * lab described in the present tense would be the one thing this site refuses
 * to do (CONTENT_SPEC.md §46). Each is replaced by a real Infrastructure
 * entry, with photographs and a location, once it opens.
 */
const PLANNED_SPACES = [
  {
    type: 'coworking',
    body: '10,000–15,000 sq ft of flexible desks, designed on modern co-working principles rather than as a converted classroom.',
  },
  {
    type: 'startup_studio',
    body: 'Modular studios for mentoring sessions, design sprints, workshops, investor conversations and peer review.',
  },
  {
    type: 'maker_lab',
    body: 'Fabrication tools, hardware testing benches and digital prototyping kit, for the ideas that need to physically exist.',
  },
  {
    type: 'collaboration_zone',
    body: 'Lounges and breakout areas — the informal half of the ecosystem, where most useful introductions actually happen.',
  },
  {
    type: 'digital_studio',
    body: 'A content and demo studio for product walkthroughs, pitch recordings and virtual investor sessions.',
  },
  {
    type: 'founder_cabin',
    body: 'Focus rooms and founder cabins for confidential conversations and the long, quiet stretches of work.',
  },
  {
    type: 'pre_incubation_space',
    body: 'Dedicated pre-incubation and incubation space, with mentorship access, IPR facilitation and funding linkages attached.',
  },
]

const SYNERGY = [
  { title: 'Real problems', body: 'Alumni bring problems they hit at work — the kind that already have a customer waiting.' },
  { title: 'Market gaps that matter', body: 'They know which gaps are worth a year of your life and which only look like opportunities.' },
  { title: 'A sounding board', body: 'Someone to tell you what is wrong with the plan before a customer does.' },
  { title: 'Handholding', body: 'Introductions, first contracts, and the practical help that comes after the advice.' },
]

export default async function EcosystemPage() {
  const [infrastructure, partners, metrics] = await Promise.all([
    listInfrastructure(),
    listPartners(),
    listMetrics(),
  ])

  return (
    <>
      <PageHeader
        kicker="Ecosystem"
        title="Nobody builds alone."
        imageSrc="/images/stage_mvp.jpg"
        description="KNEST isn’t one office. It is three parts of KIIT working together, the spaces that hold them, and the partners beyond campus who make a student idea reach further than campus ever could alone."
      />

      <Section padding="tight">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <Heading as="h2" size="title">
              Three pillars, holding each other up
            </Heading>
            <p className="mt-5 max-w-[52ch] text-[var(--color-ink-soft)]">
              A university can teach entrepreneurship without producing a single company. An industry
              partner can fund one without the research to feed it. Neither works alone — which is why
              KNEST is built as three pillars that reinforce each other, after Etzkowitz and
              Leydesdorff&rsquo;s Triple Helix model.
            </p>
            <p className="mt-4 max-w-[52ch] text-[var(--color-ink-soft)]">
              In practice it means a student can start in a lecture hall, prototype in a lab, get
              introduced to a customer, and never have to leave the ecosystem to find the next thing they
              need.
            </p>
          </div>
          <TripleHelix />
        </div>
      </Section>

      {metrics.length > 0 && (
        <Section padding="tight" className="border-t border-[var(--color-line)]">
          <MetricsBand metrics={metrics} heading="Where things actually stand" />
          <p className="mt-6 max-w-[58ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
            Each figure is dated because a number without a date is a number you cannot check. When one
            of these moves, the date moves with it.
          </p>
        </Section>
      )}

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          What sits inside it
        </Heading>
        <p className="mt-4 max-w-[58ch] text-[var(--color-ink-soft)]">
          Six domains, and everything KNEST runs belongs to one of them. It is also how we decide what
          KNEST is <em>not</em> for.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FRAMEWORK.map((entry) => (
            <Card key={entry.domain} className="h-full">
              <Heading as="h3" size="heading">
                {entry.domain}
              </Heading>
              <ul className="mt-4 flex flex-col gap-2">
                {entry.parts.map((part) => (
                  <li
                    key={part}
                    className="flex gap-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]"
                  >
                    <span aria-hidden className="text-[var(--color-archive)]">
                      —
                    </span>
                    {part}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="infrastructure" padding="tight" className="scroll-mt-24 border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Where it happens
        </Heading>

        {infrastructure.length === 0 ? (
          <>
            <p className="mt-4 max-w-[58ch] text-[var(--color-ink-soft)]">
              KNEST&rsquo;s home is being built. These are the spaces committed to it — listed here as
              plans, because that is what they currently are. Each one is replaced by a real entry, with
              photographs and a location, as it opens.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {PLANNED_SPACES.map((space) => (
                <Card key={space.type} className="h-full">
                  <Tag tone="neutral">Planned</Tag>
                  <Heading as="h3" size="heading" className="mt-4">
                    {spaceTypeLabel(space.type)}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {space.body}
                  </p>
                </Card>
              ))}
            </div>
            <p className="mt-8 max-w-[58ch] text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
              Until the building opens, program sessions run in existing KIIT labs, studios and lecture
              spaces — which is how the first cohorts of most university ecosystems started.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 max-w-[58ch] text-[var(--color-ink-soft)]">
              Space you can actually book, work in and break things in.
            </p>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {infrastructure.map((space) => (
                <Card key={space.id} className="h-full">
                  {space.spaceType && <Tag tone="archive">{spaceTypeLabel(space.spaceType)}</Tag>}
                  <Heading as="h3" size="heading" className="mt-4">
                    {space.name}
                  </Heading>
                  {space.summary && (
                    <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                      {space.summary}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {space.location && <span>{space.location}</span>}
                    {space.capacity && <span>Capacity {space.capacity}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section id="partners" padding="tight" className="scroll-mt-24 border-t border-[var(--color-line)]">
        <Heading as="h2" size="title">
          Partners
        </Heading>
        <p className="mt-4 max-w-[58ch] text-[var(--color-ink-soft)]">
          Industry, government, academic and investor partners are what turn a campus project into
          something with a customer, a grant or a route to market.
        </p>
        {partners.length === 0 ? (
          <EmptyState
            headingLevel="h3"
            className="mt-10"
            heading="Partnerships are still forming."
            body="KNEST is in conversation with industry, government and academic partners now. They are named here once an agreement is signed — not while it is being discussed."
            action={<ButtonLink href="/about#partner">Partner with us</ButtonLink>}
          />
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner) => (
              <Card key={partner.id} className="h-full">
                {partner.type && <Tag tone="archive">{partnerTypeLabel(partner.type)}</Tag>}
                <Heading as="h3" size="heading" className="mt-4">
                  {partner.name}
                </Heading>
                {partner.description && (
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {partner.description}
                  </p>
                )}
                {partner.websiteUrl && (
                  <a
                    href={partner.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)] underline underline-offset-2"
                  >
                    Visit ↗
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <Heading as="h2" size="title">
              The alumni effect
            </Heading>
            <p className="mt-5 max-w-[48ch] text-[var(--color-ink-soft)]">
              KIIT alumni are the bridge between a student venture and the wider world. They have
              already made the walk you are about to make, recently enough to remember it accurately.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {SYNERGY.map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-6"
              >
                <Heading as="h3" size="heading">
                  {item.title}
                </Heading>
                <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Find your way in
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            The ecosystem only matters if you use it. Start with a program if you know what you are
            building, an event if you do not yet, or{' '}
            <Link href="/mentors" className="underline underline-offset-2">
              a mentor
            </Link>{' '}
            if you are stuck on something specific.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/programs">Browse programs</ButtonLink>
            <ButtonLink href="/events" variant="secondary">
              See what&rsquo;s on
            </ButtonLink>
            <ButtonLink href="/about#partner" variant="secondary">
              Partner with us
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
