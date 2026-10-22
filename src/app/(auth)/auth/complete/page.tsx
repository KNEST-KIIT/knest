import { redirect } from 'next/navigation'
import { requireUser } from '@/server/auth/guards'
import { signInDestination } from '@/server/auth/destination'

export default async function CompleteSignIn() {
  redirect(signInDestination(await requireUser('/auth/complete')))
}
