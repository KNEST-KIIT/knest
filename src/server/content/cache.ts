import { unstable_cache } from 'next/cache'

/**
 * Cached reads of published CMS content.
 *
 * Every public page reads the signed-in person from the session, which makes the page itself dynamic, so
 * without this each visit ran its Payload queries against Postgres. The content readers in this folder ask
 * for the same published records for every visitor (they all read as an anonymous user, never as the
 * person looking), so the answer can be shared. Nothing personal is cached here: the per-user readers
 * (`getMentorByUserId`, `getStartupForUser`) are deliberately left out.
 *
 * Freshness: every create, update and delete in the CMS (src/payload/revalidate-hooks.ts) expires the tag at
 * once, so an editor's publish shows on the next visit. The time limit is only a backstop for changes made
 * outside the CMS, such as a database edit.
 *
 * A reader that throws is not cached, so an outage is never remembered. Outside a running Next server
 * (unit tests, seed scripts) and when CONTENT_CACHE=off (the integration suite, whose test process edits the
 * CMS from outside the server) the reader runs directly.
 */

export const CONTENT_TAG = 'content'
export const CONTENT_REVALIDATE_SECONDS = 300

/**
 * `runtime` defaults to a DIRECT reference to process.env.NEXT_RUNTIME on purpose: Next replaces that exact
 * expression at build time, but not a lookup through a passed-around `process.env` object, which in a plain
 * `next start` has no such variable. Reading it indirectly silently turned the cache off.
 */
export function contentCacheEnabled(env: { [name: string]: string | undefined } = process.env, runtime: string | undefined = process.env.NEXT_RUNTIME): boolean {
  return Boolean(runtime) && env.CONTENT_CACHE !== 'off'
}

export function cachedRead<A extends unknown[], R>(name: string, read: (...args: A) => Promise<R>): (...args: A) => Promise<R> {
  if (!contentCacheEnabled()) return read
  // unstable_cache keys on the name below plus the serialised arguments, so filters and slugs each get their own entry.
  return unstable_cache(read, ['content', name], { tags: [CONTENT_TAG], revalidate: CONTENT_REVALIDATE_SECONDS })
}

/**
 * Like cachedRead, for readers whose callers expect `null` or an empty list on failure rather than an error.
 * The reader itself must throw; this wrapper sits OUTSIDE the cache, so a failure is turned into the fallback
 * for this one request and is never stored. (A reader that catches its own error and returns the fallback
 * would have a database blip remembered as "not found" for the whole cache lifetime.)
 */
export function cachedReadOr<A extends unknown[], R, F>(name: string, read: (...args: A) => Promise<R>, fallback: F): (...args: A) => Promise<R | F> {
  const cached = cachedRead(name, read)
  return async (...args: A) => {
    try {
      return await cached(...args)
    } catch (error) {
      console.warn(`Could not read ${name}; using the fallback for this request:`, error)
      return fallback
    }
  }
}
