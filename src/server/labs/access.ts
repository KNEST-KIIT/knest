import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { labStaff } from '@/db/schema'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'

export type LabRole = 'head' | 'assistant'

/** Lab administrators run every lab: the `lab_admin` console role and the super admin. */
export function isLabAdmin(staffRole: StaffRole | null | undefined): boolean {
  return staffRole === 'lab_admin' || staffRole === 'super_admin'
}

/** A person's role in one lab, from the `lab_staff` table. Null when they have none. */
export async function labRoleFor(userId: string, labId: string): Promise<LabRole | null> {
  const row = await db.query.labStaff.findFirst({
    where: and(eq(labStaff.userId, userId), eq(labStaff.labId, labId)),
    columns: { role: true },
  })
  return row?.role ?? null
}

/** Every lab a person runs, with their role in each. */
export async function labsRunBy(userId: string): Promise<{ labId: string; role: LabRole }[]> {
  const rows = await db.query.labStaff.findMany({ where: eq(labStaff.userId, userId), columns: { labId: true, role: true } })
  return rows
}

export type LabActor = { id: string; staffRole: StaffRole | null; isAdmin: boolean; role: LabRole | null }

/** The signed-in person as seen by one lab: admin, head, assistant, or nobody special. Throws 401 when signed out. */
export async function actorFor(labId: string): Promise<LabActor> {
  const user = await requireUserOrThrow()
  const staffRole = (user.staffRole ?? null) as StaffRole | null
  return { id: user.id, staffRole, isAdmin: isLabAdmin(staffRole), role: await labRoleFor(user.id, labId) }
}

/** May decide, cancel and configure in this lab: an admin or its head. */
export const canManage = (actor: LabActor) => actor.isAdmin || actor.role === 'head'

/** May see the lab's bookers and mark attendance: an admin, its head or one of its assistants. */
export const canStaff = (actor: LabActor) => actor.isAdmin || actor.role !== null

export function requireManager(actor: LabActor): void {
  if (!canManage(actor)) throw new UnauthorizedError(403)
}
export function requireStaffOfLab(actor: LabActor): void {
  if (!canStaff(actor)) throw new UnauthorizedError(403)
}
