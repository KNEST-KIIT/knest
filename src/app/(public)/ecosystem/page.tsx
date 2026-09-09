import type { Metadata } from 'next'
import { Card, EmptyState, Heading, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { listInfrastructure } from '@/server/content/infrastructure'
import { listPartners } from '@/server/content/partners'
import { TripleHelix } from '@/components/content/triple-helix'

export const metadata: Metadata = {
  title: 'Ecosystem',
  description: 'How KNEST works — the triple helix framework, spaces, and partners behind it.',
}

const ECOSYSTEM_DIMENSIONS = [
  {
    title: 'Academic Excellence',
    points: ['Rigorous experiential teaching', 'Applied research commercialization', 'Cross-school student capstones'],
  },
  {
    title: 'Innovation Framework',
    points: ['Design thinking methodologies', 'Disciplined problem solving', 'Interdisciplinary collaboration'],
  },
  {
    title: 'Entrepreneurship',
    points: ['Dedicated founder mentorship', 'Startup development clinics', 'Go-to-market execution support'],
  },
  {
    title: 'Capital & Funding',
    points: ['Government proof-of-concept grants', 'CSR innovation funding', 'Angel syndicates and seed VCs'],
  },
  {
    title: 'Commercialization',
    points: ['Intellectual property (IPR) filing', 'University technology transfer', 'Industry co-development licensing'],
  },
  {
    title: 'Societal Impact',
    points: ['High-value job creation', 'Sustainable deep-tech solutions', 'Regional economic transformation'],
  },
]

const INFRASTRUCTURE_SPEC = [
  {
    title: 'Flexible Co-Working Space',
    metric: '10,000–15,000 sq. ft.',
    desc: 'High-density flexible co-working environment designed on modern collaborative work principles.',
    tag: 'Co-working',
  },
  {
    title: 'Modular Startup Studios',
    metric: 'Agile Layouts',
    desc: 'Bespoke studios for founder mentoring sessions, design sprints, workshops, investor interactions, and peer review.',
    tag: 'Studios',
  },
  {
    title: 'Collaboration Zones',
    metric: 'Informal Hubs',
    desc: 'Community spaces, informal interaction lounges, and breakout zones engineered for spontaneous collision.',
    tag: 'Community',
  },
  {
    title: 'Maker Labs & Hardware Prototyping',
    metric: 'Rapid Fab',
    desc: 'Heavy fabrication machinery, electronics testing benches, and digital prototyping equipment for physical products.',
    tag: 'Maker Space',
  },
  {
    title: 'Digital Content Studio',
    metric: 'Media Production',
    desc: 'A dedicated studio and media creation facility for high-fidelity product demonstrations and virtual investor rooms.',
    tag: 'Media',
  },
  {
    title: 'Founder Cabins & Focus Rooms',
    metric: 'High-Concentration',
    desc: 'Private focus rooms and acoustic founder cabins for confidential IP discussions and deep analytical work.',
    tag: 'Private',
  },
  {
    title: 'Pre-Incubation Space',
    metric: 'Stage Zero',
    desc: 'Dedicated validation space with integrated mentorship access, IPR facilitation, and early funding linkages.',
    tag: 'Incubation',
  },
  {
    title: 'Integrated Startup Management System',
    metric: 'Digital Backbone',
    desc: 'Centralized digital platform connecting all founders with high-speed connectivity, secure servers, and cloud resources.',
    tag: 'Software',
  },
]

const SYNERGY_POINTS = [
  { label: 'Real Problems', desc: 'Direct access to actual operational pain points from industry and alumni ventures.' },
  { label: 'Market Gaps', desc: 'Unfiltered intelligence on customer demand and unserved commercial niches.' },
  { label: 'Hands-On Mentoring', desc: 'Practical guidance from founders who have walked the same path.' },
  { label: 'Handholding & Clinics', desc: 'Tactical assistance with incorporation, legal agreements, and early hires.' },
  { label: 'Founder Stories', desc: 'Authentic playbooks detailing near-death experiences and tactical breakthroughs.' },
  { label: 'A Sounding Board', desc: 'A safe, high-trust circle to test hypotheses before pitching to external capital.' },
]

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
    <div>
      <PageHeader
        kicker="Institutional Framework"
        title="The Innovation Ecosystem."
        description="KNEST integrates academic excellence, cutting-edge physical prototyping labs, and global corporate networks into an interconnected engine for student ventures."
        imageSrc="/images/stage_mvp.jpg"
        imageAlt="KNEST Innovation Ecosystem"
        badgeText="University-Anchored · Triple Helix Architecture"
      />

      {/* Triple Helix Section */}
      <Section className="border-b border-[var(--color-line)] bg-white py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Institutional Architecture
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
            The Triple Helix Model
          </Heading>
          <p className="mt-4 text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
            KNEST operates as a university-anchored triple helix, where academia, industry, and institutional
            governance continuously reinforce one another to produce scalable, high-agency ventures.
          </p>
        </div>

        <div className="mt-8">
          <TripleHelix />
        </div>
      </Section>

      {/* 6 Dimensions of Innovation */}
      <Section className="border-b border-[var(--color-line)] bg-[var(--color-paper)] py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Holistic Development
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
            Six Dimensions of the Ecosystem
          </Heading>
          <p className="mt-4 text-base text-[var(--color-ink-soft)] font-light">
            Every venture nurtured within KNEST draws upon six interconnected operational pillars.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ECOSYSTEM_DIMENSIONS.map((dim, i) => (
            <div
              key={dim.title}
              className="border border-[var(--color-line)] bg-white p-8 flex flex-col justify-between transition-all duration-300 hover:border-[var(--color-signal)]"
            >
              <div>
                <span className="font-mono text-xs font-bold text-[var(--color-signal)] uppercase tracking-widest">
                  Pillar 0{i + 1}
                </span>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
                  {dim.title}
                </h3>
                <ul className="mt-4 flex flex-col gap-2 border-t border-[var(--color-line)] pt-4">
                  {dim.points.map((pt) => (
                    <li key={pt} className="text-sm text-[var(--color-ink-soft)] flex items-start gap-2">
                      <span className="text-[var(--color-signal)] font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Physical & Digital Infrastructure */}
      <Section id="infrastructure" className="border-b border-[var(--color-line)] bg-white py-10 md:py-14 scroll-mt-24">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            World-Class Facilities
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
            Infrastructure &amp; Maker Spaces
          </Heading>
          <p className="mt-4 text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
            Over 15,000 sq. ft. of purpose-built environments designed to take ideas from raw napkin sketches to deployed physical and digital prototypes.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {INFRASTRUCTURE_SPEC.map((spec) => (
            <div
              key={spec.title}
              className="border border-[var(--color-line)] bg-[var(--color-paper)] p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-signal)]">
                    {spec.tag}
                  </span>
                  <span className="font-mono text-xs text-[var(--color-ink-muted)]">
                    {spec.metric}
                  </span>
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-ink)]">
                  {spec.title}
                </h3>
                <p className="mt-2 text-xs text-[var(--color-ink-soft)] leading-relaxed">
                  {spec.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic CMS-backed infrastructure (if present) */}
        {infrastructure.length > 0 && (
          <div className="mt-8 border-t border-[var(--color-line)] pt-8">
            <h3 className="text-xl font-bold font-[family-name:var(--font-display)] text-[var(--color-ink)]">
              Documented Campus Facilities
            </h3>
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
                    {space.capacity && <span>Capacity: {space.capacity}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* The Synergy Effect (Alumni as the Bridge) */}
      <Section className="border-b border-[var(--color-line)] bg-[var(--color-ink)] text-[var(--color-paper)] py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            The Synergy Effect
          </p>
          <Heading as="h2" size="display" className="mt-2 text-white text-3xl md:text-4xl">
            Alumni Are the Bridge Between Student Ventures &amp; the Wider Ecosystem
          </Heading>
          <p className="mt-4 text-base text-[var(--color-paper)]/70 font-light">
            KIIT founders who have built companies return to provide the hard-won insights that textbooks cannot teach.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SYNERGY_POINTS.map((pt, i) => (
            <div key={pt.label} className="border border-[var(--color-line-invert)] bg-white/5 p-8 backdrop-blur-sm">
              <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--color-signal)]">
                0{i + 1}
              </span>
              <h3 className="mt-3 font-[family-name:var(--font-display)] text-xl font-bold text-white">
                {pt.label}
              </h3>
              <p className="mt-2 text-sm text-[var(--color-paper)]/70 leading-relaxed font-light">
                {pt.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Partners Section */}
      <Section id="partners" className="bg-[var(--color-paper)] py-10 md:py-14 scroll-mt-24">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">
            Ecosystem Network
          </p>
          <Heading as="h2" size="display" className="mt-2 text-3xl md:text-4xl text-[var(--color-ink)]">
            Corporate &amp; Institutional Partners
          </Heading>
          <p className="mt-4 text-base text-[var(--color-ink-soft)] font-light">
            KNEST collaborates with industry leaders, state agencies, and institutional investors to extend founder reach.
          </p>
        </div>

        {partners.length === 0 ? (
          <div className="mt-8 border border-[var(--color-line)] bg-white p-8">
            <h3 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--color-ink)]">
              Partnerships Active &amp; Forming
            </h3>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)] leading-relaxed">
              KNEST continuously establishes strategic linkages with industry leaders, state initiatives (Startup Odisha, Startup India), and venture syndicates.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                Startup Odisha
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                Startup India
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                KIIT Technology Business Incubator (TBI)
              </span>
              <span className="border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">
                National Entrepreneurship Network (NEN)
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                    className="mt-4 inline-block text-[length:var(--text-small)] font-bold text-[var(--color-signal)] hover:underline"
                  >
                    Visit Organization ↗
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
