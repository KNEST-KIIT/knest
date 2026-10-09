import { notFound } from 'next/navigation'
import { isLabBookingEnabled } from '@/server/features'
import { canStaff, actorFor } from '@/server/labs/access'
import { getLabBySlug } from '@/server/labs/service'

/**
 * Only a lab's own head and assistants, and lab administrators, may open its console. Checked here
 * so that anyone else gets a real 404 status before any of the page streams; the lab's existence is
 * not revealed to them.
 */
export default async function LabStaffLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  if (!isLabBookingEnabled()) notFound()
  const { slug } = await params
  const found = await getLabBySlug(slug)
  if (!found) notFound()
  const actor = await actorFor(found.lab.id).catch(() => null)
  if (!actor || !canStaff(actor)) notFound()
  return children
}
