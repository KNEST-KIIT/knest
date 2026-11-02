import { sql } from 'drizzle-orm'
import type { db } from '@/db/client'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Serialises everything that creates or moves a live booking of one lab, held to the end of the transaction.
 *
 * The exclusion constraint already makes double booking impossible, but when several overlapping inserts run
 * at once PostgreSQL does not always answer the losers with "exclusion violation" (23P01): each can wait on the
 * other's uncommitted row, and the deadlock detector then aborts them with "deadlock detected" (40P01) after
 * a second or more. That is not a conflict the caller can recognise, so it surfaced as a 500. Queueing the
 * writers here lets the first commit and every later one meet the committed row and get the clean 23P01.
 * Take this lock before any other lock in the transaction, so the order is the same everywhere.
 */
export async function lockLabBookings(tx: Tx, labId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`knest:lab-booking:${labId}`}))`)
}
