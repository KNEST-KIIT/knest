/**
 * Reading a Postgres error code back out of what Drizzle throws.
 *
 * This exists because of a bug it was written to fix. Drizzle wraps every
 * driver error in a `DrizzleQueryError` carrying `query`, `params` and `cause`
 * — the pg error, with its SQLSTATE, is on `cause`, and nothing useful is on
 * the wrapper. So the obvious `'code' in error && error.code === '23505'`
 * check compiles, reads correctly, and is never true: the friendly "you've
 * already got one of those open" branch behind it is dead, and the duplicate
 * surfaces to the user as a 500.
 *
 * `EXCLUDE` and unique constraints are how this codebase settles races —
 * deliberately, because read-then-write is the shape that lets two concurrent
 * requests both succeed (PHASE-5-6-RETROSPECTIVE.md §4). Those constraints are
 * only as good as the code that catches them, which is what this is for.
 *
 * The unwrap walks the `cause` chain rather than checking one level, since
 * nothing guarantees the nesting depth stays at one.
 */

/** https://www.postgresql.org/docs/current/errcodes-appendix.html */
export const PG_UNIQUE_VIOLATION = '23505'
export const PG_EXCLUSION_VIOLATION = '23P01'
export const PG_FOREIGN_KEY_VIOLATION = '23503'

export function pgErrorCode(error: unknown): string | null {
  let current = error
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== 'object') return null
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string') return code
    current = (current as { cause?: unknown }).cause
  }
  return null
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === PG_UNIQUE_VIOLATION
}

export function isExclusionViolation(error: unknown): boolean {
  return pgErrorCode(error) === PG_EXCLUSION_VIOLATION
}
