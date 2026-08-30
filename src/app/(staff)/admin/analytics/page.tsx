import type { Metadata } from 'next'
import { Heading } from '@/components/ui'
import { requireAdminArea } from '@/server/auth/guards'
import { FUNNEL_EVENTS, getActivatedBuildersCount, getEventCounts, type FunnelStage } from '@/server/analytics/funnel'

export const metadata: Metadata = { title: 'Analytics — Admin' }

const STAGE_LABELS: Record<FunnelStage, string> = {
  acquisition: 'Acquisition',
  activation: 'Activation',
  intent: 'Intent',
  engagement: 'Engagement',
  outcomes: 'Outcomes',
}

const EVENT_LABELS: Record<string, string> = {
  landing_view: 'Landing views',
  journey_selector_choice: 'Journey selector choices',
  signup: 'Signups',
  onboarding_completed: 'Onboarding completed',
  program_view: 'Program views',
  application_start: 'Applications started',
  application_submit: 'Applications submitted',
  event_register: 'Event registrations',
  resource_view: 'Resource views',
  startup_view: 'Startup views',
  search_query: 'Searches',
  application_accepted: 'Applications accepted',
}

export default async function AnalyticsPage() {
  await requireAdminArea('analytics')
  const [counts, activatedBuilders] = await Promise.all([getEventCounts(), getActivatedBuildersCount()])
  const totalEvents = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div>
      <Heading as="h1" size="title">
        Analytics
      </Heading>

      {totalEvents === 0 ? (
        <p className="mt-6 text-[var(--color-ink-soft)]">No activity tracked yet.</p>
      ) : (
        <>
          <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-white p-6">
            <p className="text-[length:var(--text-small)] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-muted)]">
              Activated Builders
            </p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[length:var(--text-display)]">
              {activatedBuilders}
            </p>
            <p className="mt-2 max-w-[52ch] text-[length:var(--text-small)] text-[var(--color-ink-soft)]">
              Onboarded, with a journey stage set, and at least one of: started an application,
              registered for an event, or viewed a startup.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-8">
            {(Object.keys(FUNNEL_EVENTS) as FunnelStage[]).map((stage) => (
              <div key={stage}>
                <Heading as="h2" size="heading" uppercase={false}>
                  {STAGE_LABELS[stage]}
                </Heading>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FUNNEL_EVENTS[stage].map((event) => (
                    <div
                      key={event}
                      className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-white p-4"
                    >
                      <p className="text-[length:var(--text-small)] text-[var(--color-ink-muted)]">
                        {EVENT_LABELS[event] ?? event}
                      </p>
                      <p className="mt-1 font-[family-name:var(--font-display)] text-[length:var(--text-heading)]">
                        {counts[event] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
