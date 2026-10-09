import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Heading, Tag } from '@/components/ui'
import { RichText } from '@/components/content/rich-text'
import { formatDate } from '@/lib/dates'
import { getArticleBySlug } from '@/server/content/articles'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return {}
  return { title: article.seo?.title || article.title, description: article.seo?.description || article.summary }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  return (
    <article className="mx-auto w-full max-w-[720px] px-6 py-16 md:px-10">
      <Link href="/blog" className="text-sm font-semibold text-[var(--color-signal)] underline underline-offset-4">
        ← All articles
      </Link>
      <div className="mt-6">
        <Tag tone="signal">Article</Tag>
      </div>
      <Heading as="h1" size="display" className="mt-4">
        {article.title}
      </Heading>
      <p className="mt-4 text-[length:var(--text-heading)] text-[var(--color-ink-soft)]">{article.summary}</p>
      <p className="mt-4 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
        {article.author ? `${article.author}` : 'KNEST Editorial'}
        {article.publishedAt ? ` · ${formatDate(article.publishedAt)}` : ''}
      </p>
      <RichText data={article.body} className="mt-10" />
    </article>
  )
}
