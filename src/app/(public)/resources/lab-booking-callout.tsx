import Link from 'next/link'
import { Heading } from '@/components/ui'
import { isLabBookingEnabled } from '@/server/features'

const STEPS = [
  { title: 'Pick a lab', body: 'Choose a lab and a time that works for your team.' },
  { title: 'Send a request', body: 'Tell the lab what you plan to build and how many people are coming.' },
  { title: 'Get approval', body: 'The lab head approves each request, and you hear back by email and on your dashboard.' },
]

/** How a student or founder books lab time. The booking itself lives in the signed-in dashboard. */
export function LabBookingCallout() {
  const open = isLabBookingEnabled()

  return (
    <section aria-labelledby="lab-booking" className="border border-[var(--color-line)] bg-white p-3 md:p-4">
      <div className="grid gap-3 lg:gap-4 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-5">
          <p className="text-xs uppercase tracking-[0.2em] font-bold text-[var(--color-signal)]">Labs</p>
          <Heading as="h2" size="title" id="lab-booking" className="mt-2 text-2xl md:text-3xl text-[var(--color-ink)]">
            Book lab time
          </Heading>
          <p className="mt-2 text-sm md:text-base text-[var(--color-ink-soft)] font-light leading-relaxed">
            Request time in a KNEST lab to prototype, test and build. Sign in with your KIIT account to see the labs and open slots.
          </p>
          <div className="mt-3">
            {open ? (
              <Link
                href="/dashboard/lab-booking"
                className="inline-flex min-h-[2.75rem] items-center border border-[var(--color-signal)] bg-[var(--color-signal)] px-6 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[var(--color-signal-deep)]"
              >
                Book a lab
              </Link>
            ) : (
              <p className="text-sm font-semibold text-[var(--color-ink-muted)]">Lab booking opens soon.</p>
            )}
          </div>
        </div>

        <ol className="grid gap-2 sm:grid-cols-3 lg:col-span-7">
          {STEPS.map((step, i) => (
            <li key={step.title} className="border border-[var(--color-line)] bg-[var(--color-paper)] p-2.5">
              <span className="font-mono text-xs font-bold text-[var(--color-signal)]">Step 0{i + 1}</span>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-base font-bold text-[var(--color-ink)]">{step.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--color-ink-soft)] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
