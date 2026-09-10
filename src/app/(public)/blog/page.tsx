import type { Metadata } from 'next'
import Link from 'next/link'
import { Heading, LinkCard, Section, Tag } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { listArticles } from '@/server/content/articles'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Dispatches, playbooks, and founder stories from the KNEST innovation ecosystem at KIIT.',
}

export default async function BlogPage() {
  const articles = await listArticles(12)

  return (
    <>
      <PageHeader
        kicker="Dispatches & Playbooks"
        title="The KNEST Blog"
        description="Empirical frameworks, founder lessons, and ecosystem updates from student builders, mentors, and operators across KIIT."
      />

      <Section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article: any) => (
            <LinkCard
              key={article.id || article.slug}
              href={`/resources`}
              label={`Read ${article.title}`}
              className="flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Tag tone="signal">{article.category || 'Article'}</Tag>
                  {article.readTime && (
                    <span className="font-mono text-xs text-[var(--color-ink-muted)]">
                      {article.readTime}
                    </span>
                  )}
                </div>

                <Heading as="h2" size="heading" className="mt-4 leading-snug">
                  {article.title}
                </Heading>

                <p className="mt-2 text-sm text-[var(--color-ink-soft)] line-clamp-3 leading-relaxed">
                  {article.summary}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--color-line)] flex items-center justify-between text-xs text-[var(--color-ink-muted)]">
                <span className="font-medium text-[var(--color-ink)]">
                  {article.author || 'KNEST Editorial'}
                </span>
                {article.publishedAt && (
                  <span>
                    {new Date(article.publishedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </LinkCard>
          ))}
        </div>
      </Section>
    </>
  )
}
