import { Heading } from '@/components/ui'

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-[length:var(--text-micro)] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
        KNEST
      </p>
      <Heading as="h1" size="display" className="mt-4">
        Foundation in progress.
      </Heading>
      <p className="mt-6 max-w-prose text-[var(--color-ink-soft)]">
        The public site is built in Phase 8 against the approved content spec. This
        placeholder exists so the app runs; it is replaced, not extended.
      </p>
    </main>
  )
}
