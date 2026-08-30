import { doublePrecision, text, timestamp } from 'drizzle-orm/pg-core'
import { appSchema } from './enums'

/**
 * Backs the Postgres token bucket in src/server/security/rate-limit.ts
 * (PHASE-10-12-IMPLEMENTATION-PLAN.md §4.1). `key` is the bucket identity —
 * `${route}:${ip}` for anonymous routes, `${route}:${userId}` for
 * authenticated ones. `tokens` is a float, not an integer: it holds a
 * continuously-refilling fractional value between checks, not a whole count.
 */
export const rateLimits = appSchema.table('rate_limits', {
  key: text('key').primaryKey(),
  tokens: doublePrecision('tokens').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
})
