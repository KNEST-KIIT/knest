import type { Metadata } from 'next'
import { ButtonLink, EmptyState, Heading, Section } from '@/components/ui'
import { PageHeader } from '@/components/layout/page-header'
import { RichText } from '@/components/content/rich-text'
import { listFaqsByCategory } from '@/server/content/faqs'
import { OpenTargetedFaq } from './open-targeted'

export const metadata: Metadata = {
  title: 'Questions',
  description:
    'Straight answers about KNEST programs, applications, eligibility and mentorship — including the questions people are slightly embarrassed to ask.',
}

/**
 * The Faqs collection existed with an admin UI, a category taxonomy and
 * access rules, and no page had ever read from it. This is where it renders.
 * Program-specific questions still live on each program page (Programs has
 * its own inline `faqs` array); this page answers the ones that apply before
 * a visitor has picked a program at all.
 */
export default async function FaqPage() {
  const groups = await listFaqsByCategory()

  return (
    <>
      <PageHeader
        kicker="Questions"
        title="Straight answers."
        description="Including the questions people feel slightly stupid asking. Nobody here started out knowing this, and asking early is cheaper than guessing."
      />

      <OpenTargetedFaq />

      <Section padding="top">
        {groups.length === 0 ? (
          <EmptyState
            heading="Questions are being written up."
            body="We are collecting the ones people actually ask, rather than the ones that make a good page. Until they are here, ask us directly — you will get a real answer from a person."
            action={<ButtonLink href="/about#contact">Ask us anything</ButtonLink>}
          />
        ) : (
          <div className="flex flex-col gap-14">
            {groups.map((group) => (
              <section key={group.value}>
                <Heading as="h2" size="title">
                  {group.label}
                </Heading>
                <div className="mt-6 max-w-[68ch] divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                  {/* The id is the anchor a search result links to; the
                      OpenTargetedFaq enhancement above expands whichever one
                      the fragment names. */}
                  {group.faqs.map((faq) => (
                    <details key={faq.id} id={`faq-${faq.id}`} className="group scroll-mt-24 py-5">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium marker:content-none">
                        {faq.question}
                        <span
                          aria-hidden
                          className="mt-1 shrink-0 text-[var(--color-signal)] transition-transform group-open:rotate-45"
                        >
                          +
                        </span>
                      </summary>
                      <RichText data={faq.answer} className="mt-3 text-[length:var(--text-small)]" />
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Section>

      <Section padding="tight" className="border-t border-[var(--color-line)]">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-8 md:p-10">
          <Heading as="h2" size="heading">
            Still stuck?
          </Heading>
          <p className="mt-3 max-w-[56ch] text-[var(--color-ink-soft)]">
            If your question isn&rsquo;t here, it is probably a good question. Ask it — the answer often
            ends up on this page.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/about#contact">Ask us</ButtonLink>
            <ButtonLink href="/programs" variant="secondary">
              Browse programs
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  )
}
