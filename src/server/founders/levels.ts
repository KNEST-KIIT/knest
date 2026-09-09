import { UnauthorizedError } from '@/server/auth/errors'

/**
 * The seven founder levels, and what each one actually unlocks.
 *
 * This is the half of a founder's standing that KNEST asserts. The other half,
 * `users.journeyStage`, is self-declared, freely re-editable and grants
 * nothing — onboarding says "there is no wrong answer" and means it. The two
 * share the same seven names on purpose, so a founder has one vocabulary for
 * where they are, but only one of them is a credential.
 *
 * Every capability below is enforced somewhere in this codebase. Nothing here
 * describes a benefit the platform cannot yet deliver: a ladder that promises
 * micro-grants and travel budgets it has no way to grant is the same "plausible
 * fiction" the product refuses everywhere else (spec §46). The ladder grows as
 * the platform does.
 *
 * Capabilities are cumulative — level 5 has everything levels 1–4 have.
 */

export type Capability =
  /** A public founder profile, listed in the directory. */
  | 'founder_profile'
  /** Request time in a KIIT lab. The rule that prompted all of this: level 3 and above. */
  | 'book_lab'
  /** Book beyond a lab's standard slot length, including overnight. */
  | 'lab_extended_slots'
  /** Reserve named equipment alongside the room. */
  | 'reserve_equipment'
  /** Requests sort above others in a lab manager's queue. */
  | 'lab_priority'
  /** Profile is surfaced to investors and partners. */
  | 'investor_visible'
  /** Standing weekly bookings rather than one slot at a time. */
  | 'lab_recurring'
  /** A permanent desk in a founder cabin. */
  | 'cabin_desk'
  /** Propose and host events on the platform. */
  | 'host_events'
  /** Eligible to appear in the mentor directory. */
  | 'mentor_others'

type LevelDefinition = {
  level: number
  /** Matches the `journey_stage` enum value of the same rank, so the two read as one vocabulary. */
  key: string
  label: string
  /** What a founder is told this level means, in their words not ours. */
  summary: string
  /** Granted AT this level. Everything below is inherited. */
  grants: readonly Capability[]
}

export const FOUNDER_LEVELS: readonly LevelDefinition[] = [
  {
    level: 1,
    key: 'exploring',
    label: 'Exploring',
    summary: 'Everyone starts here. Browse programmes, come to events, apply to anything open.',
    grants: [],
  },
  {
    level: 2,
    key: 'idea',
    label: 'Idea',
    summary: 'You have something you are working on. You get a founder profile in the directory.',
    grants: ['founder_profile'],
  },
  {
    level: 3,
    key: 'validation',
    label: 'Validation',
    summary:
      'You have tested the idea against real people. You can book lab time across KIIT.',
    grants: ['book_lab'],
  },
  {
    level: 4,
    key: 'mvp',
    label: 'MVP',
    summary: 'You are building. Longer lab slots, and you can reserve equipment with the room.',
    grants: ['lab_extended_slots', 'reserve_equipment'],
  },
  {
    level: 5,
    key: 'early_revenue',
    label: 'Early revenue',
    summary: 'Someone is paying. Your requests take priority, and investors can see your profile.',
    grants: ['lab_priority', 'investor_visible'],
  },
  {
    level: 6,
    key: 'scaling',
    label: 'Scaling',
    summary: 'You are growing. Standing weekly lab bookings and a desk in a founder cabin.',
    grants: ['lab_recurring', 'cabin_desk'],
  },
  {
    level: 7,
    key: 'established',
    label: 'Established',
    summary: 'You are the person others should be learning from. Host events and mentor founders.',
    grants: ['host_events', 'mentor_others'],
  },
] as const

export const MIN_LEVEL = 1
export const MAX_LEVEL = FOUNDER_LEVELS.length

/** Clamps anything out of range rather than throwing — a bad column value should not 500 a dashboard. */
export function levelDefinition(level: number): LevelDefinition {
  const clamped = Math.min(Math.max(Math.trunc(level), MIN_LEVEL), MAX_LEVEL)
  return FOUNDER_LEVELS[clamped - 1]!
}

/** Everything a level carries, including what it inherited. */
export function capabilitiesFor(level: number): readonly Capability[] {
  const clamped = Math.min(Math.max(Math.trunc(level), MIN_LEVEL), MAX_LEVEL)
  return FOUNDER_LEVELS.slice(0, clamped).flatMap((entry) => entry.grants)
}

export function hasCapability(level: number, capability: Capability): boolean {
  return capabilitiesFor(level).includes(capability)
}

/** The lowest level that carries a capability — for "reach level 3 to book a lab" copy. */
export function levelRequiredFor(capability: Capability): number {
  const found = FOUNDER_LEVELS.find((entry) => entry.grants.includes(capability))
  return found?.level ?? MAX_LEVEL
}

/**
 * A capability denial that can explain itself.
 *
 * It subclasses `UnauthorizedError`, so every existing
 * `catch (e instanceof UnauthorizedError)` at an API boundary keeps working
 * untouched and still answers 403. The difference is the message: "Not
 * permitted." is useless when the fix is "get to level 3", and a founder who
 * is told which level they need — and where to ask for it — does not have to
 * file a support request to find out.
 *
 * Route handlers must test for this branch *before* the plain
 * `UnauthorizedError` branch, since a subclass matches both.
 */
export class CapabilityError extends UnauthorizedError {
  constructor(
    readonly capability: Capability,
    readonly requiredLevel: number,
    readonly currentLevel: number,
  ) {
    super(403)
    this.name = 'CapabilityError'
  }
}

const CAPABILITY_NAMES: Record<Capability, string> = {
  founder_profile: 'A founder profile',
  book_lab: 'Booking a lab',
  lab_extended_slots: 'Extended lab slots',
  reserve_equipment: 'Reserving equipment',
  lab_priority: 'Priority booking',
  investor_visible: 'An investor-visible profile',
  lab_recurring: 'Recurring bookings',
  cabin_desk: 'A cabin desk',
  host_events: 'Hosting events',
  mentor_others: 'Mentoring founders',
}

/** The human name for a capability — for anywhere a list of them is shown to a person. */
export function capabilityLabel(capability: Capability): string {
  return CAPABILITY_NAMES[capability]
}

export function capabilityDeniedMessage(error: CapabilityError): string {
  const required = levelDefinition(error.requiredLevel)
  const current = levelDefinition(error.currentLevel)
  return (
    `${CAPABILITY_NAMES[error.capability]} unlocks at level ${required.level} (${required.label}). ` +
    `You’re at level ${current.level} (${current.label}) — you can ask to move up from your dashboard.`
  )
}

/**
 * The enforcement point. A rendered UI hiding a button is never one (spec §31);
 * this is.
 */
export function requireCapability(level: number, capability: Capability): void {
  if (hasCapability(level, capability)) return
  throw new CapabilityError(capability, levelRequiredFor(capability), level)
}

/** The next rung up, or null at the top — for "ask to move up" copy. */
export function nextLevel(currentLevel: number): LevelDefinition | null {
  if (currentLevel >= MAX_LEVEL) return null
  return levelDefinition(currentLevel + 1)
}
