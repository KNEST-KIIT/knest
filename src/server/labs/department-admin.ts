import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db/client'
import { auditLogs, labDepartments } from '@/db/schema'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { isLabAdmin } from './access'
import { wouldCreateCycle, type Department } from './departments'
import type { Result } from './service'

const fail = (error: string, code: 'invalid' | 'not-found' | 'state' = 'invalid') => ({ ok: false as const, error, code })

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/** Departments are administered by lab administrators only. */
async function requireAdminUser() {
  const user = await requireUserOrThrow()
  if (!isLabAdmin((user.staffRole ?? null) as StaffRole | null)) throw new UnauthorizedError(403)
  return user
}

const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Give the department a name of at least two characters.').max(100),
  parentId: z.string().min(1).nullable().optional(),
})

export async function listDepartments(): Promise<Department[]> {
  return db.select({ id: labDepartments.id, slug: labDepartments.slug, name: labDepartments.name, parentId: labDepartments.parentId }).from(labDepartments)
}

/** A lab administrator adds a department, optionally under another. */
export async function createDepartment(input: unknown): Promise<Result<{ id: string; slug: string }>> {
  const user = await requireAdminUser()
  const parsed = departmentSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the department details.')
  const existing = await listDepartments()
  if (parsed.data.parentId && !existing.some((d) => d.id === parsed.data.parentId)) return fail('That parent department doesn’t exist.', 'not-found')

  const base = slugify(parsed.data.name)
  if (!base) return fail('Give the department a name with letters or numbers in it.')
  const taken = new Set(existing.map((d) => d.slug))
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`

  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(labDepartments).values({ name: parsed.data.name, slug, parentId: parsed.data.parentId ?? null }).returning({ id: labDepartments.id })
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'lab_department_created', entityType: 'lab_department', entityId: created!.id, before: null, after: { name: parsed.data.name, parentId: parsed.data.parentId ?? null } })
    return created!
  })
  return { ok: true, id: row.id, slug }
}

/** Renames a department or moves it under another. A move that would make a cycle is refused. */
export async function updateDepartment(id: string, input: unknown): Promise<Result> {
  const user = await requireAdminUser()
  const parsed = departmentSchema.partial().safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the department details.')
  const all = await listDepartments()
  const current = all.find((d) => d.id === id)
  if (!current) return fail('That department doesn’t exist.', 'not-found')
  const patch: { name?: string; parentId?: string | null } = {}
  if (parsed.data.name !== undefined) patch.name = parsed.data.name
  if (parsed.data.parentId !== undefined) {
    if (parsed.data.parentId !== null && !all.some((d) => d.id === parsed.data.parentId)) return fail('That parent department doesn’t exist.', 'not-found')
    if (wouldCreateCycle(all, id, parsed.data.parentId)) return fail('A department cannot sit under itself or under one of its own sub-departments.', 'state')
    patch.parentId = parsed.data.parentId
  }
  if (Object.keys(patch).length === 0) return fail('Nothing to change.')
  await db.transaction(async (tx) => {
    await tx.update(labDepartments).set(patch).where(eq(labDepartments.id, id))
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'lab_department_updated', entityType: 'lab_department', entityId: id, before: { name: current.name, parentId: current.parentId }, after: patch })
  })
  return { ok: true }
}

/** Removes a department. Its sub-departments become top-level and its labs become unplaced; no lab or booking is deleted. */
export async function deleteDepartment(id: string): Promise<Result> {
  const user = await requireAdminUser()
  const current = (await listDepartments()).find((d) => d.id === id)
  if (!current) return fail('That department doesn’t exist.', 'not-found')
  await db.transaction(async (tx) => {
    await tx.delete(labDepartments).where(eq(labDepartments.id, id))
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'lab_department_deleted', entityType: 'lab_department', entityId: id, before: { name: current.name, parentId: current.parentId }, after: null })
  })
  return { ok: true }
}
