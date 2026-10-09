import { notFound } from 'next/navigation'
import { requireAdminArea } from '@/server/auth/guards'
import { isLabBookingEnabled } from '@/server/features'

/** Lab administration: the `lab_admin` role and super admins. A real 404 for everyone else, and while lab booking is switched off. */
export default async function LabsAdminLayout({ children }: { children: React.ReactNode }) {
  if (!isLabBookingEnabled()) notFound()
  await requireAdminArea('infrastructure')
  return children
}
