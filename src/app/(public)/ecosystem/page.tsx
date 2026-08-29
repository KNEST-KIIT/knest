import type { Metadata } from 'next'
import { Card, EmptyState, Heading, Section, Tag } from '@/components/ui'
import { listInfrastructure } from '@/server/content/infrastructure'
import { listPartners } from '@/server/content/partners'
import { TripleHelix } from './triple-helix'

export const metadata: Metadata = {
  title: 'Ecosystem',
  description: "How KNEST works — the people, spaces and partners behind it.",
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  coworking: 'Flexible co-working space',
  startup_studio: 'Modular startup studio',
  collaboration_zone: 'Collaboration zone',
  maker_lab: 'Maker lab',
  digital_studio: 'Digital content studio',
  founder_cabin: 'Founder cabin',
  pre_incubation_space: 'Pre-incubation space',
  event_space: 'Event space',
  meeting_room: 'Meeting room',
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  industry: 'Industry',
  academic: 'Academic',
  government: 'Government',
  investor: 'Investor',
  community: 'Community',
}

export default async function EcosystemPage() {
  const [infrastructure, partners] = await Promise.all([listInfrastructure(), listPartners()])

  return (
    <Section>
      <Heading as="h1" size="display">
        How KNEST works.
      </Heading>
      <p className="mt-4 max-w-[56ch] text-[var(--color-ink-soft)]">
        KNEST isn&rsquo;t one office. It&rsquo;s three parts of KIIT working together, the physical
        spaces that hold them, and the partners beyond campus who make a student idea reach further
        than campus ever could alone.
      </p>

      <div className="mt-16">
        <TripleHelix />
      </div>

      <div id="infrastructure" className="mt-20 scroll-mt-24">
        <Heading as="h2" size="title">
          Where it happens
        </Heading>
        {infrastructure.length === 0 ? (
          <EmptyState
            className="mt-6"
            heading="Spaces are being documented."
            body="KNEST's physical spaces — co-working, studios, maker labs — will be listed here as they're photographed and confirmed."
          />
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {infrastructure.map((space) => (
              <Card key={space.id}>
                {space.spaceType && <Tag tone="archive">{SPACE_TYPE_LABELS[space.spaceType] ?? space.spaceType}</Tag>}
                <Heading as="h3" size="heading" className="mt-4">
                  {space.name}
                </Heading>
                {space.summary && (
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">{space.summary}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  {space.location && <span>{space.location}</span>}
                  {space.capacity && <span>Capacity {space.capacity}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div id="partners" className="mt-20 scroll-mt-24">
        <Heading as="h2" size="title">
          Partners
        </Heading>
        {partners.length === 0 ? (
          <EmptyState
            className="mt-6"
            heading="Partnerships are still forming."
            body="KNEST is building relationships with industry, government and academic partners. They'll be listed here as they're confirmed."
          />
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner) => (
              <Card key={partner.id}>
                {partner.type && <Tag tone="archive">{PARTNER_TYPE_LABELS[partner.type] ?? partner.type}</Tag>}
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
                    className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]"
                  >
                    Visit ↗
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </Section>
  )
}
