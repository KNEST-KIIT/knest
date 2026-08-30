import { cookies } from 'next/headers'
import { db } from '@/db/client'
import { analyticsEvents } from '@/db/schema'
import { getSessionUser } from '@/server/auth/guards'

const SESSION_COOKIE = 'knest_sid'

/**
 * Reads the anonymous-visit cookie, or generates one. Setting a cookie is
 * only possible from a Server Function or Route Handler — never during
 * Server Component rendering (confirmed against Next's own docs,
 * node_modules/next/dist/docs/.../cookies.md: "Setting cookies is not
 * supported during Server Component rendering"). Called from a page render,
 * this still returns a usable id for that one call — it just can't persist
 * it, so a purely page-view-driven visit degrades to a fresh id per
 * request until an action or route handler in the same visit (signup,
 * starting an application, registering for an event — all of which exist
 * in the funnel already) sets it for real.
 */
async function getOrSetSessionId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(SESSION_COOKIE)?.value
  if (existing) return existing

  const generated = crypto.randomUUID()
  try {
    store.set(SESSION_COOKIE, generated, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 180,
      path: '/',
    })
  } catch {
    // Server Component render — the id is still valid for this call, it
    // just won't be remembered for the next request.
  }
  return generated
}

/**
 * Server-side only — no client analytics SDK. A five-collection funnel
 * doesn't justify a third-party dependency, and writing directly here means
 * the data is owned, not sent anywhere else (PHASE-10-12-IMPLEMENTATION-
 * PLAN.md §3). Never throws: a tracking failure must not break the request
 * that triggered it.
 *
 * `userId` defaults to the current session, but can be overridden — the one
 * case that needs this is `application_accepted`, fired from
 * changeApplicationStatus where the acting session is staff, not the
 * applicant the event is actually about.
 */
export async function track(
  event: string,
  props?: Record<string, unknown>,
  options?: { userId?: string },
): Promise<void> {
  try {
    const [sessionUser, sessionId] = await Promise.all([getSessionUser(), getOrSetSessionId()])
    const userId = options?.userId ?? sessionUser?.id
    await db.insert(analyticsEvents).values({
      userId,
      sessionId,
      event,
      props,
    })
  } catch (error) {
    console.error('Failed to record analytics event:', event, error)
  }
}
