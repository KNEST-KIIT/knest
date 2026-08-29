import type { JourneyStage, PlatformRole } from '@/server/auth/roles'

/**
 * The six onboarding paths (CONTENT_SPEC.md §4 step 6). Deterministic,
 * rule-based, and explained — never an ML recommendation (spec §09/§45).
 */
export type RecommendedPath = 'EXPLORE' | 'VALIDATE' | 'BUILD' | 'GROW' | 'MENTOR' | 'CONNECT'

export type Recommendation = {
  path: RecommendedPath
  headline: string
  body: string
  /**
   * Shown to the user, always (spec §09: "the recommendation should be
   * rule-based and transparent"). A recommendation nobody can interrogate is
   * a recommendation nobody can trust.
   */
  reason: string
  cta: string
}

/**
 * Maps (role, stage) to a recommended path. Deliberately takes only these two
 * inputs: CONTENT_SPEC.md's decision table is fully specified by role and
 * stage, and adding onboarding's other answers (goals, interests) as routing
 * signals here would mean inventing product behaviour that isn't written down
 * anywhere reviewable. Goals and interests are still collected and stored —
 * they drive event and resource recommendations on the dashboard (Phase 7) —
 * they just don't change which of these six paths someone lands on.
 *
 * Pure and synchronous by construction: no I/O, no randomness, so every
 * (role, stage) pair is exhaustively testable and the same inputs always
 * produce the same output.
 */
export function recommend(platformRole: PlatformRole, journeyStage: JourneyStage | null): Recommendation {
  if (platformRole === 'mentor') {
    return {
      path: 'MENTOR',
      headline: 'Founders need people who’ve done the hard part.',
      body: 'Founders need people who’ve done the hard part.',
      reason:
        'You’re here to support founders — the next step is completing your mentor profile.',
      cta: 'Complete profile',
    }
  }

  if (platformRole === 'investor' || platformRole === 'partner') {
    return {
      path: 'CONNECT',
      headline: 'Let’s find the right conversation.',
      body: 'Let’s find the right conversation.',
      reason: 'Partnerships start with a conversation rather than a form.',
      cta: 'Get in touch',
    }
  }

  // Everyone else — student, founder, alumni, other — is routed by stage.
  // journeyStage is only ever null here if the step was somehow skipped
  // without an answer; treat that the same as "exploring" rather than
  // crashing on a missing recommendation.
  switch (journeyStage) {
    case 'idea':
    case 'validation':
      return {
        path: 'VALIDATE',
        headline: 'You have an idea. The next job is finding out if it’s real.',
        body: 'You have an idea. The next job is finding out if it’s real.',
        reason: 'You have an idea but haven’t tested it yet — validation comes before building.',
        cta: 'Find a program',
      }
    case 'mvp':
    case 'early_revenue':
      return {
        path: 'BUILD',
        headline: 'Time to put something in front of real users.',
        body: 'Time to put something in front of real users.',
        reason: 'You’re building — what you need now is momentum, feedback and structure.',
        cta: 'See programs',
      }
    case 'scaling':
    case 'established':
      return {
        path: 'GROW',
        headline: 'You’ve got a startup. Now: customers, capital, scale.',
        body: 'You’ve got a startup. Now: customers, capital, scale.',
        reason:
          'You already have a startup, so we’d point you at growth and investor access rather than early-stage work.',
        cta: 'See programs',
      }
    case 'exploring':
    default:
      return {
        path: 'EXPLORE',
        headline: 'Start with events and the fundamentals. No idea required.',
        body: 'Start with events and the fundamentals. No idea required.',
        reason:
          'You’re exploring and want to understand entrepreneurship — so we’d start you with people and ideas, not an application.',
        cta: 'See what’s on',
      }
  }
}
