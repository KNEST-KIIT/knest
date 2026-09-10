import type { Metadata } from 'next'
import { ButtonLink, EmptyState, Heading, LinkCard, Section, Tag } from '@/components/ui'
import { PageHero } from '@/components/layout/page-hero'
import { formatDate } from '@/lib/dates'
import { listArticles } from '@/server/content/articles'

export const metadata: Metadata = {
  title: 'Stories',
  description:
    'What actually happened — the ventures built at KIIT, told by the people who built them, including the parts that did not work.',
}

/**
 * The Articles collection has a slug, a required rich-text body, an author, a
 * hero image and its own SEO fields — and had no route. A story written in
 * the admin could not be read by anyone: /invest listed founder stories but
 * pointed each card at the linked startup's profile instead, because there
 * was nowhere else to send it.
 */
export default async function StoriesPage() {
  const articles = await listArticles()

  return (
    <>
      <PageHero
        eyebrow="Stories"
        title="What actually happened."
        image="/images/stage_brainstorming.jpg"
        lede="Longer pieces about ventures built at KIIT, written with the people who built them. Including the parts that did not work, which is usually where the useful detail is."
      />

      <Section padding="top">
        {articles.length === 0 ? (
          <EmptyState
            heading="No stories published yet."
            body="The first ones are being written now, with founders who are still in the middle of it. A story here is worth more once there is something honest to say."
            action={<ButtonLink href="/startups">See the ventures</ButtonLink>}
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const startup = typeof article.startup === 'object' ? article.startup : null
              return (
                <LinkCard key={article.id} href={`/stories/${article.slug}`} label={`Read ${article.title}`}>
                  {startup && <Tag tone="signal">{startup.name}</Tag>}
                  <Heading as="h2" size="heading" className={startup ? 'mt-4' : undefined}>
                    {article.title}
                  </Heading>
                  <p className="mt-2 text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                    {article.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {article.author && <span>{article.author}</span>}
                    {article.publishedAt && <span>{formatDate(article.publishedAt)}</span>}
                  </div>
                  <span className="mt-4 inline-block text-[length:var(--text-small)] font-medium text-[var(--color-signal)]">
                    Read →
                  </span>
                </LinkCard>
              )
            })}
          </div>
        )}
      </Section>
    </>
  )
}
