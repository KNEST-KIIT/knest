import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ButtonLink, Heading, Tag } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import { formatDate } from '@/lib/dates'
import { getArticleBySlug } from '@/server/content/articles'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  return {
    title: article.seo?.title || article.title,
    description: article.seo?.description || article.summary,
  }
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  const startup = typeof article.startup === 'object' ? article.startup : null

  return (
    <div className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
      {startup && (
        <Link href={`/startups/${startup.slug}`} className="inline-block">
          <Tag tone="signal">{startup.name}</Tag>
        </Link>
      )}

      <Heading as="h1" size="display" className={startup ? 'mt-4' : undefined}>
        {article.title}
      </Heading>
      <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{article.summary}</p>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        {article.author && <span>By {article.author}</span>}
        {article.publishedAt && <span>{formatDate(article.publishedAt)}</span>}
      </div>

      <RichText data={article.body} className="mt-10" />

      {startup && (
        <div className="mt-14 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper-soft)] p-8">
          <Heading as="h2" size="heading">
            {startup.name}
          </Heading>
          {startup.tagline && <p className="mt-2 text-[var(--color-ink-soft)]">{startup.tagline}</p>}
          <div className="mt-6">
            <ButtonLink href={`/startups/${startup.slug}`} variant="secondary">
              See the venture
            </ButtonLink>
          </div>
        </div>
      )}

      <p className="mt-12 text-[length:var(--text-small)]">
        <Link href="/stories" className="underline underline-offset-2">
          &larr; All stories
        </Link>
      </p>
    </div>
  )
}
