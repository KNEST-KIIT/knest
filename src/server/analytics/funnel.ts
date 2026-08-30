import { and, count, inArray, isNotNull } from 'drizzle-orm'
import { db } from '@/db/client'
import { analyticsEvents, users } from '@/db/schema'

export type FunnelStage = 'acquisition' | 'activation' | 'intent' | 'engagement' | 'outcomes'

/** The funnel stages and events from the original core-loop plan, wired to the real call sites that fire them. */
export const FUNNEL_EVENTS: Record<FunnelStage, string[]> = {
  acquisition: ['landing_view'],
  activation: ['journey_selector_choice', 'signup', 'onboarding_completed'],
  intent: ['program_view', 'application_start', 'application_submit'],
  engagement: ['event_register', 'resource_view', 'startup_view', 'search_query'],
  outcomes: ['application_accepted'],
}

const ACTIVATING_EVENTS = ['application_start', 'event_register', 'startup_view']

/** Real counts, grouped by event name. An event with zero rows simply isn't a key in the result. */
export async function getEventCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({ event: analyticsEvents.event, value: count() })
    .from(analyticsEvents)
    .groupBy(analyticsEvents.event)

  return Object.fromEntries(rows.map((r) => [r.event, r.value]))
}

/**
 * North Star: a user who (1) completed onboarding, (2) has a journeyStage,
 * and (3) has at least one application_start, event_register, or
 * startup_view event recorded. Computed live from real rows every time,
 * not a stored counter — cheap at this scale, and a stored counter would be
 * one more thing that can silently drift from the truth (spec §46).
 */
export async function getActivatedBuildersCount(): Promise<number> {
  const activatedRows = await db
    .selectDistinct({ userId: analyticsEvents.userId })
    .from(analyticsEvents)
    .where(inArray(analyticsEvents.event, ACTIVATING_EVENTS))

  const activatedUserIds = activatedRows
    .map((r) => r.userId)
    .filter((id): id is string => id !== null)

  if (activatedUserIds.length === 0) return 0

  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(
      and(
        isNotNull(users.onboardingCompletedAt),
        isNotNull(users.journeyStage),
        inArray(users.id, activatedUserIds),
      ),
    )

  return row?.value ?? 0
}
