import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, EmptyState, Heading } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { listMentorsAwaitingProfile } from '@/server/members/mentors'

export const metadata: Metadata = { title: 'Mentors — Admin' }

/**
 * The queue the product already promised and never had.
 *
 * Onboarding tells a mentor "your profile is with our team". Until now no
 * screen anywhere listed who that meant, so the sentence was true only in the
 * sense that nobody had said otherwise.
 */
export default async function AdminMentorsPage() {
  const { awaiting, published } = await listMentorsAwaitingProfile()

  return (
    <div>
      <Heading as="h1" size="title">
        Mentors
      </Heading>
      <p className="mt-2 max-w-[64ch] text-[var(--color-ink-soft)]">
        Onboarding tells a mentor their profile is with the team. These are the people that
        sentence is about. Publishing one means creating a profile in{' '}
        <Link href="/admin/collections/mentors" className="underline underline-offset-4">
          the mentors collection
        </Link>{' '}
        and putting their account id in its <code>userId</code> field — that link is what takes
        them off this list and gives them a page to point at.
      </p>

      <section className="mt-8">
        <Heading as="h2" size="heading">
          Waiting on a profile ({awaiting.length})
        </Heading>
        {awaiting.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              heading={published.length === 0 ? 'No mentors have signed up yet' : 'Nobody waiting'}
              body={
                published.length === 0
                  ? 'The mentors on the public directory are CMS records. This list fills up when someone signs up choosing "mentor" and finishes onboarding.'
                  : 'Every mentor who has signed up has a published profile.'
              }
              size="compact"
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {awaiting.map((mentor) => (
              <Card key={mentor.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/members/${mentor.id}`}
                    className="-my-2 flex min-h-11 items-center py-2 font-medium text-[var(--color-signal)]"
                  >
                    {mentor.name ?? mentor.email}
                  </Link>
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {mentor.email}
                    {mentor.school ? ` · ${mentor.school}` : ''}
                  </p>
                </div>
                <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                  Signed up {formatDate(mentor.createdAt)}
                  {/* The number that matters: how long this person has been
                      waiting on a sentence the product already said to them. */}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {published.length > 0 && (
        <section className="mt-10">
          <Heading as="h2" size="heading">
            Published ({published.length})
          </Heading>
          <ul className="mt-4 flex flex-col gap-2">
            {published.map((mentor) => (
              <li key={mentor.id} className="text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
                <Link href={`/admin/members/${mentor.id}`} className="underline underline-offset-4">
                  {mentor.name ?? mentor.email}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
