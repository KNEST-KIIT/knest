import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Avatar, Heading, Tag, Timeline } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { getStartupBySlug } from '@/server/content/startups'
import { track } from '@/server/analytics/track'
import { StoryArc } from './story-arc'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const startup = await getStartupBySlug(slug)
  if (!startup) return {}

  return {
    title: startup.seo?.title || startup.name,
    description: startup.seo?.description || startup.tagline,
  }
}

export default async function StartupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const startup = await getStartupBySlug(slug)
  if (!startup) notFound()
  await track('startup_view', { startupId: startup.id })

  const founders = (startup.founders ?? []).filter((f) => typeof f === 'object')
  const cohort = typeof startup.cohort === 'object' ? startup.cohort : null
  const program = cohort && typeof cohort.program === 'object' ? cohort.program : null
  const sectors = startup.sectors ?? []
  const achievements = (startup.achievements ?? []).map((a) => ({
    label: a.label,
    date: a.date ? formatDate(a.date) : undefined,
  }))

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-16 md:px-10">
      <div className="max-w-[68ch]">
        <div className="flex flex-wrap items-center gap-3">
          {startup.stage && <Tag tone="signal">{startup.stage}</Tag>}
          {sectors.map((sector) => (
            <Tag key={sector} tone="archive">
              {sector}
            </Tag>
          ))}
        </div>

        <Heading as="h1" size="display" className="mt-4">
          {startup.name}
        </Heading>
        <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{startup.tagline}</p>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {startup.school && <span>{startup.school}</span>}
          {startup.foundedYear && <span>Founded {startup.foundedYear}</span>}
          {program && cohort && (
            <span>
              Built through{' '}
              <Link href={`/programs/${program.slug}`} className="underline underline-offset-2">
                {program.title}
              </Link>{' '}
              ({cohort.name})
            </span>
          )}
          {startup.websiteUrl && (
            <a href={startup.websiteUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Website ↗
            </a>
          )}
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-12">
          <StoryArc story={startup.story} />

          {achievements.length > 0 && (
            <section>
              <Heading as="h2" size="heading">
                Achievements
              </Heading>
              <Timeline entries={achievements} className="mt-4" />
            </section>
          )}
        </div>

        {founders.length > 0 && (
          <aside>
            <div className="sticky top-24 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-raised)]">
              <Heading as="h2" size="heading">
                Founders
              </Heading>
              <div className="mt-4 flex flex-col gap-4">
                {founders.map((founder) => (
                  <div key={founder.id} className="flex items-center gap-3">
                    <Avatar
                      name={founder.name}
                      src={typeof founder.photo === 'object' ? founder.photo?.url : null}
                    />
                    <div>
                      <p className="font-medium">{founder.name}</p>
                      {founder.headline && (
                        <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                          {founder.headline}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
