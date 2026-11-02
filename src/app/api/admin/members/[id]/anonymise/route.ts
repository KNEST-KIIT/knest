import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db/client'
import { users } from '@/db/schema'
import { requireStaffOrThrow, UnauthorizedError } from '@/server/auth/guards'
import { unexpectedError } from '@/server/http/errors'
import { anonymiseMember } from '@/server/members/anonymise'
import { limitByUser } from '@/server/security/route-limits'

/**
 * Anonymises an account (super administrator only). Irreversible, so the caller must send the account's current
 * e-mail address back as confirmation, the way a destructive action in the console asks you to type the name.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await limitByUser('staffAction')
  if (limited) return limited
  const { id } = await params

  try {
    // Permission first: nothing below may reveal to anyone else whether an account or an address exists.
    await requireStaffOrThrow('users')

    const body = await request.json().catch(() => null)
    if (typeof body?.confirmEmail !== 'string' || body.confirmEmail.trim() === '') {
      return NextResponse.json({ error: 'Type the account’s e-mail address to confirm. This cannot be undone.' }, { status: 400 })
    }
    if (body.scrubApplicationContent !== undefined && typeof body.scrubApplicationContent !== 'boolean') {
      return NextResponse.json({ error: 'Say whether to remove the applicant’s answers and documents (true or false).' }, { status: 400 })
    }

    const target = await db.query.users.findFirst({ where: eq(users.id, id), columns: { email: true } })
    if (!target || target.email.toLowerCase() !== body.confirmEmail.trim().toLowerCase()) {
      return NextResponse.json({ error: 'That e-mail address does not match this account.' }, { status: 400 })
    }
    const result = await anonymiseMember(id, { scrubApplicationContent: body.scrubApplicationContent === true })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Not permitted.' }, { status: error.status })
    return unexpectedError(error)
  }
}
