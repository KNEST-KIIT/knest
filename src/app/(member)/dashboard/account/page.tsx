import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { accounts, users } from '@/db/schema'
import { requireUser } from '@/server/auth/guards'
import { googleConfigured } from '@/server/auth/providers'
import { Heading, Section } from '@/components/ui'
import { AccountMethods } from './account-methods'

export const metadata: Metadata = { title: 'Your account' }

export default async function AccountPage() {
  const user = await requireUser('/dashboard/account')
  const [identity, google] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, user.id), columns: { passwordHash: true } }),
    db.query.accounts.findFirst({ where: and(eq(accounts.userId, user.id), eq(accounts.provider, 'google')), columns: { provider: true } }),
  ])
  return (
    <Section>
      <div className="max-w-xl">
        <Link href="/auth/complete" className="text-sm text-[var(--color-signal)] underline underline-offset-4">← Your workspace</Link>
        <Heading as="h1" size="title" className="mt-6">Your account</Heading>
        <p className="mt-3 break-all text-[var(--color-ink-soft)]">{user.email}</p>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Choose how you sign in. Your applications, profile and access stay with this one account.</p>
        <AccountMethods hasPassword={Boolean(identity?.passwordHash)} googleLinked={Boolean(google)} googleEnabled={googleConfigured()} />
      </div>
    </Section>
  )
}
