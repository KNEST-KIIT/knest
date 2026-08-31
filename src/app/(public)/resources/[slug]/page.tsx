import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ButtonLink, Container, Heading, Tag } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import { getResourceBySlug } from '@/server/content/resources'
import { track } from '@/server/analytics/track'

const FORMAT_LABELS: Record<string, string> = {
  guide: 'Guide',
  template: 'Template',
  playbook: 'Playbook',
  video: 'Video',
  article: 'Article',
  worksheet: 'Worksheet',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const resource = await getResourceBySlug(slug)
  if (!resource) return {}
  return { title: resource.seo?.title || resource.title, description: resource.seo?.description || resource.summary }
}

export default async function ResourceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const resource = await getResourceBySlug(slug)
  if (!resource) notFound()
  await track('resource_view', { resourceId: resource.id })

  return (
    <Container size="reading" className="py-16">
      <Tag tone="archive">{FORMAT_LABELS[resource.format]}</Tag>
      <Heading as="h1" size="display" className="mt-4">
        {resource.title}
      </Heading>
      <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{resource.summary}</p>
      {resource.readingMinutes && (
        <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
          {resource.readingMinutes} min read
        </p>
      )}

      <RichText data={resource.body} className="mt-10" />

      {resource.file && typeof resource.file === 'object' && resource.file.url && (
        <div className="mt-10">
          <ButtonLink href={resource.file.url} target="_blank" rel="noopener noreferrer">
            Download template
          </ButtonLink>
        </div>
      )}
    </Container>
  )
}
