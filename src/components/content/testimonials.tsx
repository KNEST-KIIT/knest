import { Avatar, Heading } from '@/components/ui'
import type { Testimonial } from '@/payload/payload-types'

/**
 * Quotes from people who have been through this.
 *
 * The Testimonials collection had an admin UI, a consent checkbox and a
 * relationship to both programs and startups, and nothing in the app ever
 * read it. It renders in two places now: filtered to one program on that
 * program's page, and unfiltered on /about.
 *
 * Renders nothing at all when there are no quotes. Unlike an empty startup
 * list — where the absence is itself the honest story worth telling — an
 * empty testimonials section makes no promise to anyone, and a placeholder
 * saying "quotes coming soon" is just an apology taking up a screen.
 */
export function Testimonials({
  testimonials,
  heading,
  className,
}: {
  testimonials: Testimonial[]
  heading: string
  className?: string
}) {
  if (testimonials.length === 0) return null

  return (
    <section className={className}>
      <Heading as="h2" size="title">
        {heading}
      </Heading>
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <figure
            key={testimonial.id}
            className="flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6"
          >
            <blockquote className="flex-1 text-[var(--color-ink-soft)]">
              &ldquo;{testimonial.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <Avatar
                name={testimonial.attribution}
                src={typeof testimonial.photo === 'object' ? testimonial.photo?.url : null}
              />
              <div>
                <p className="text-[length:var(--text-small)] font-medium">{testimonial.attribution}</p>
                {testimonial.role && (
                  <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                    {testimonial.role}
                  </p>
                )}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
