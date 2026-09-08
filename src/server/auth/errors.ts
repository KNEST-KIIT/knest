/**
 * The authorization error, on its own so that pure modules can throw it.
 *
 * It used to live in `guards.ts`, which imports the Auth.js config and so
 * pulls `next-auth` in behind it. That is fine for a route handler and fatal
 * for a unit test: `src/server/founders/levels.ts` is pure, synchronous
 * decision logic with a test alongside it, and importing the guards module for
 * one class made that test load the whole auth stack and fail to resolve
 * `next/server`.
 *
 * `guards.ts` re-exports this, so every existing import site is unchanged.
 */
export class UnauthorizedError extends Error {
  constructor(readonly status: 401 | 403 = 401) {
    super(status === 401 ? 'Not signed in' : 'Not permitted')
    this.name = 'UnauthorizedError'
  }
}
