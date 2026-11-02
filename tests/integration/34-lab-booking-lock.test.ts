import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../../src/db/schema'
import { lockLabBookings } from '../../src/server/labs/booking-lock'
import { closeDb, createUser, db } from '../support/helpers'

/**
 * The lock behind "the database refuses a second live booking" (see 34-lab-booking.test.ts). Without it, when many
 * overlapping inserts race, PostgreSQL aborts some losers with "deadlock detected" (40P01) instead of the exclusion
 * violation (23P01) the service turns into a clean conflict; that was a 500. This runs the race directly against the
 * migrated schema, round after round, because a single round can get lucky.
 */

const stamp = Date.now()
const RACERS = 20
const ROUNDS = 40

let pool: Pool
let labId: string
const userIds: string[] = []

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: RACERS })
  labId = (await db().query("insert into app.labs (id, slug, name, capacity) values (gen_random_uuid()::text, $1, $1, 4) returning id", [`lock-race-${stamp}`])).rows[0].id
  for (let i = 0; i < RACERS; i++) userIds.push(await createUser({ email: `lock-racer${i}-${stamp}@labs.test`, platformRole: 'student' }))
})
afterAll(async () => {
  await pool?.end()
  await closeDb()
})

type Outcome = 'inserted' | { code: string }

/** One racer on its own already-open connection, started by `gate`, so all of them begin at the same moment. */
async function attempt(client: PoolClient, gate: Promise<void>, userId: string, startsAt: Date, endsAt: Date): Promise<Outcome> {
  const orm = drizzle(client, { schema })
  await gate
  try {
    await orm.transaction(async (tx) => {
      await lockLabBookings(tx, labId)
      await tx.execute(sql`insert into app.lab_bookings (id, lab_id, user_id, starts_at, ends_at, purpose, headcount) values (gen_random_uuid()::text, ${labId}, ${userId}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, 'Race', 1)`)
    })
    return 'inserted'
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } }
    return { code: e.code ?? e.cause?.code ?? 'unknown' }
  }
}

describe('booking writers queue behind the lab lock', () => {
  it(`${RACERS} simultaneous overlapping inserts: one wins and every loser gets the exclusion violation, never a deadlock, in each of ${ROUNDS} rounds`, async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const startsAt = new Date(Date.UTC(2031, 0, 1 + round, 10, 0))
      const endsAt = new Date(startsAt.getTime() + 3_600_000)
      const clients = await Promise.all(userIds.map(() => pool.connect()))
      let start!: () => void
      const gate = new Promise<void>((resolve) => (start = resolve))
      const racing = clients.map((client, i) => attempt(client, gate, userIds[i]!, startsAt, endsAt))
      start()
      const outcomes = await Promise.all(racing)
      for (const client of clients) client.release()
      const won = outcomes.filter((o) => o === 'inserted')
      const lost = outcomes.filter((o): o is { code: string } => o !== 'inserted')
      expect(won, `round ${round}`).toHaveLength(1)
      expect(lost.map((o) => o.code), `round ${round}`).toEqual(Array(RACERS - 1).fill('23P01'))
    }
    const rows = await db().query("select count(*)::int c from app.lab_bookings where lab_id = $1 and status = 'requested'", [labId])
    expect(rows.rows[0].c).toBe(ROUNDS)
  })

  it('different labs do not wait for each other', async () => {
    const other = (await db().query("insert into app.labs (id, slug, name, capacity) values (gen_random_uuid()::text, $1, $1, 1) returning id", [`lock-other-${stamp}`])).rows[0].id as string
    const orm = drizzle(pool, { schema })
    let release!: () => void
    const held = new Promise<void>((resolve) => (release = resolve))
    let taken!: () => void
    const lockTaken = new Promise<void>((resolve) => (taken = resolve))
    const holder = orm.transaction(async (tx) => {
      await lockLabBookings(tx, labId)
      taken()
      await held
    })
    await lockTaken
    try {
      // a different lab's lock is free at once, even while the first lab's lock is held
      const free = orm.transaction((tx) => lockLabBookings(tx, other)).then(() => 'free' as const)
      const waited = new Promise<'blocked'>((resolve) => setTimeout(() => resolve('blocked'), 5_000))
      expect(await Promise.race([free, waited])).toBe('free')
    } finally {
      release()
      await holder
    }
  })
})
