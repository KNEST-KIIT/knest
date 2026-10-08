import { safeNext } from '@/lib/safe-next'
import type { JourneyStage } from '@/server/auth/roles'
import type { RecommendedPath } from './recommend'

/**
 * Where each recommended path actually sends someone. recommend() only carries
 * the label; this is the one place that turns a path into a URL, shared by the
 * onboarding completion screen and the dashboard.
 */
export function pathHref(path: RecommendedPath | string, stage: JourneyStage | string | null): string {
  const stageParam = stage ? `?stage=${stage}` : ''
  switch (path) {
    case 'EXPLORE':
      return '/events'
    case 'CONNECT':
      return '/about#contact'
    case 'MENTOR':
      // A mentor's profile is reviewed by staff (USER_JOURNEYS journey 4); their
      // dashboard says so. There is no /profile page (HD-13).
      return '/dashboard'
    default:
      return `/programs${stageParam}`
  }
}

/**
 * The return path carried through sign-up and onboarding (`?next=`), or null.
 * Same-origin paths only (KN-22e), and never /onboarding itself, which would
 * send someone round in a circle.
 */
export function onboardingReturnPath(raw: string | null | undefined): string | null {
  const safe = safeNext(raw)
  if (!safe) return null
  if (safe === '/onboarding' || safe.startsWith('/onboarding?') || safe.startsWith('/onboarding/')) return null
  return safe
}

/**
 * Where to land when onboarding finishes (KN-14): the page the person was
 * heading to when they were asked to sign up (e.g. the application they were
 * about to start) wins; otherwise the recommended path's page.
 */
export function completionDestination(
  next: string | null | undefined,
  path: RecommendedPath | string,
  stage: JourneyStage | string | null,
): string {
  return onboardingReturnPath(next) ?? pathHref(path, stage)
}

/** The /onboarding URL that preserves where the person was going. */
export function onboardingUrl(opts: { next?: string | null; stage?: string | null }): string {
  const params = new URLSearchParams()
  const next = onboardingReturnPath(opts.next)
  if (opts.stage) params.set('stage', opts.stage)
  if (next) params.set('next', next)
  const qs = params.toString()
  return qs ? `/onboarding?${qs}` : '/onboarding'
}
