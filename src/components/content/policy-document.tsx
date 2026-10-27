import Link from 'next/link'
import { Heading } from '@/components/ui'
import { POLICIES, type PolicyKind } from '@/content/policies'

const CONTACT_EMAIL = 'contact@kiitnest.com'

function PolicyParagraph({ text }: { text: string }) {
  const parts = text.split(CONTACT_EMAIL)
  return (
    <p className="leading-relaxed text-[var(--color-ink-soft)]">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="break-words font-medium text-[var(--color-signal)] underline underline-offset-4">
              {CONTACT_EMAIL}
            </a>
          )}
          {part}
        </span>
      ))}
    </p>
  )
}

export function PolicyDocument({ kind }: { kind: PolicyKind }) {
  const policy = POLICIES[kind]
  return (
    <article className="mx-auto w-full max-w-4xl px-6 py-16 md:px-10">
      <Heading as="h1" size="display">{policy.title}</Heading>
      <p className="mt-4 text-sm text-[var(--color-ink-muted)]">Policy version: {policy.version}</p>

      <nav aria-label="On this page" className="mt-10 rounded-[var(--radius-sm)] border border-[var(--color-line)] p-6">
        <h2 className="font-semibold">On this page</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {policy.sections.map((section, index) => (
            <li key={section.heading}>
              <a href={`#section-${index + 1}`} className="text-[var(--color-signal)] underline underline-offset-4">{section.heading}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-10">
        {policy.sections.map((section, index) => (
          <section key={section.heading} aria-labelledby={`section-${index + 1}`}>
            <h2 id={`section-${index + 1}`} className="scroll-mt-28 text-xl font-semibold text-[var(--color-ink)]">
              {index + 1}. {section.heading}
            </h2>
            <div className="mt-4 space-y-4">
              {section.paragraphs.map((text) => <PolicyParagraph key={text} text={text} />)}
            </div>
          </section>
        ))}
      </div>

      <nav aria-label="Related policies" className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--color-line)] pt-6">
        {Object.entries(POLICIES).filter(([key]) => key !== kind).map(([key, related]) => (
          <Link key={key} href={related.href} className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--color-signal)] underline underline-offset-4">
            {related.title}
          </Link>
        ))}
      </nav>
    </article>
  )
}
