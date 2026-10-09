import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'

/** Liveness for the host and alarms: answers only whether the app can reach its database. No details. */
export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'cache-control': 'no-store' }
  try {
    await db.execute(sql`select 1`)
    return NextResponse.json({ status: 'ok' }, { headers })
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers })
  }
}
