import type { Metadata } from 'next'
import { ButtonLink, Heading, Prose, Section } from '@/components/ui'

/**
 * The shell for /privacy and /terms.
 *
 * Both were linked from the footer of every page in the app and both
 * returned 404 — found by Lighthouse, which logs the prefetch failure as a
 * console error on every page that renders the footer.
 *
 * These do not invent a policy. Writing plausible-sounding legal text would
 * be worse than the 404 was: a 404 is obviously broken, whereas an invented
 * privacy policy looks binding and is not. Following the same discipline the
 * rest of the product uses for content that does not exist yet (spec §46),
 * each page says plainly that the document is being prepared by the
 * university and points at a real way to ask.
 *
 * Replace the body of each page with the approved text when KIIT provides it.
 */
export function legalMetadata(title: string, description: string): Metadata {
  return { title, description }
}

export function LegalNotice({
  title,
  summary,
  covers,
}: {
  title: string
  summary: string
  covers: string[]
}) {
  return (
    <Section measure="prose">
      <Heading as="h1" size="display">
        {title}
      </Heading>
      <Prose className="mt-6">
        <p className="text-[var(--color-ink-soft)]">{summary}</p>
        <p className="mt-6 font-medium">When it is published it will cover:</p>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-6 text-[var(--color-ink-soft)]">
          {covers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6 text-[var(--color-ink-soft)]">
          Until then, if you have a question about your data or your account, ask us directly and a
          person will answer.
        </p>
      </Prose>
      <ButtonLink href="/about#contact" className="mt-8">
        Get in touch
      </ButtonLink>
    </Section>
  )
}
