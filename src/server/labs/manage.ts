import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db/client'
import { auditLogs, labBlackouts, labHours, labs, labStaff, users } from '@/db/schema'
import { requireUserOrThrow, UnauthorizedError } from '@/server/auth/guards'
import type { StaffRole } from '@/server/auth/roles'
import { actorFor, isLabAdmin, requireManager } from './access'
import { isValidDateString } from './rules'
import type { Result } from './service'

const fail = (error: string, code: 'invalid' | 'not-found' | 'forbidden' | 'state' = 'invalid') => ({ ok: false as const, error, code })

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

const int = (min: number, max: number, label: string) => z.number({ error: `${label} must be a number.` }).int(`${label} must be a whole number.`).min(min, `${label} must be at least ${min}.`).max(max, `${label} must be at most ${max}.`)

/** The settings a head or admin may change on a lab. Every value is a policy knob, not a constant in the rules. */
export const labSettingsSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    department: z.string().trim().max(100),
    description: z.string().trim().max(2000).nullable().optional(),
    capacity: int(1, 500, 'Capacity'),
    slotMinutes: int(15, 480, 'Block length'),
    maxConsecutiveSlots: int(1, 24, 'Consecutive blocks'),
    minLeadMinutes: int(0, 60 * 24 * 30, 'Minimum notice'),
    maxHorizonDays: int(1, 365, 'Booking horizon'),
    maxOpenRequests: int(1, 50, 'Open requests'),
    maxHoursPerWeek: int(1, 168, 'Hours per week'),
    cancelCutoffMinutes: int(0, 60 * 24 * 14, 'Cancellation cut-off'),
    eligibility: z.enum(['verified', 'onboarded']),
    requiresAssistant: z.boolean(),
  })
  .partial()

export type LabSettings = z.infer<typeof labSettingsSchema>

/** A lab administrator creates a lab. It starts with the recommended defaults, closed (no hours) and without staff. */
export async function createLab(input: unknown): Promise<Result<{ id: string; slug: string }>> {
  const user = await requireUserOrThrow()
  if (!isLabAdmin((user.staffRole ?? null) as StaffRole | null)) throw new UnauthorizedError(403)
  const schema = labSettingsSchema.required({ name: true }).extend({ infrastructureId: z.number().int().positive().nullable().optional() })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the lab details.')
  const { infrastructureId, ...settings } = parsed.data

  const base = slugify(settings.name!)
  if (!base) return fail('Give the lab a name with letters or numbers in it.')
  let slug = base
  for (let n = 2; await db.query.labs.findFirst({ where: eq(labs.slug, slug), columns: { id: true } }); n++) slug = `${base}-${n}`

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(labs).values({ ...settings, name: settings.name!, slug, infrastructureId: infrastructureId ?? null }).returning({ id: labs.id })
    await tx.insert(auditLogs).values({ actorUserId: user.id, action: 'lab_created', entityType: 'lab', entityId: row!.id, before: null, after: { name: settings.name, slug } })
    return row!
  })
  return { ok: true, id: created.id, slug }
}

async function labById(labId: string) {
  return db.query.labs.findFirst({ where: eq(labs.id, labId) })
}

/** Heads and admins change a lab's settings. Only an admin may switch a lab off. */
export async function updateLab(labId: string, input: unknown): Promise<Result> {
  const lab = await labById(labId)
  if (!lab) return fail('That lab doesn’t exist.', 'not-found')
  const actor = await actorFor(labId)
  requireManager(actor)

  const raw = (input ?? {}) as Record<string, unknown>
  const { isActive, ...rest } = raw
  const parsed = labSettingsSchema.safeParse(rest)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the settings.')
  if (isActive !== undefined && !actor.isAdmin) return fail('Only a lab administrator can open or close a lab.', 'forbidden')

  const patch = { ...parsed.data, ...(typeof isActive === 'boolean' ? { isActive } : {}) }
  if (Object.keys(patch).length === 0) return fail('Nothing to change.')
  const before: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) before[key] = (lab as Record<string, unknown>)[key]

  await db.transaction(async (tx) => {
    await tx.update(labs).set({ ...patch, updatedAt: new Date() }).where(eq(labs.id, labId))
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_updated', entityType: 'lab', entityId: labId, before, after: patch })
  })
  return { ok: true }
}

const hoursSchema = z
  .array(
    z.object({
      weekday: int(0, 6, 'Weekday'),
      opensMinute: int(0, 1439, 'Opening time'),
      closesMinute: int(1, 1440, 'Closing time'),
    }),
  )
  .max(60)
  .superRefine((windows, ctx) => {
    windows.forEach((w, i) => {
      if (w.closesMinute <= w.opensMinute) ctx.addIssue({ code: 'custom', path: [i], message: 'Closing time must be after opening time.' })
    })
    for (let a = 0; a < windows.length; a++)
      for (let b = a + 1; b < windows.length; b++) {
        const x = windows[a]!
        const y = windows[b]!
        if (x.weekday === y.weekday && x.opensMinute < y.closesMinute && y.opensMinute < x.closesMinute) ctx.addIssue({ code: 'custom', path: [b], message: 'Two opening windows on the same day overlap.' })
      }
  })

/** Replaces the whole weekly timetable in one transaction. Bookings already made are not touched: a head cancels any that no longer fit. */
export async function setLabHours(labId: string, input: unknown): Promise<Result> {
  const lab = await labById(labId)
  if (!lab) return fail('That lab doesn’t exist.', 'not-found')
  const actor = await actorFor(labId)
  requireManager(actor)
  const parsed = hoursSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the opening hours.')

  await db.transaction(async (tx) => {
    await tx.delete(labHours).where(eq(labHours.labId, labId))
    if (parsed.data.length) await tx.insert(labHours).values(parsed.data.map((w) => ({ ...w, labId })))
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_hours_set', entityType: 'lab', entityId: labId, before: null, after: { windows: parsed.data.length } })
  })
  return { ok: true }
}

const blackoutSchema = z.object({ startsOn: z.string(), endsOn: z.string(), reason: z.string().trim().max(200).optional() })

export async function addBlackout(labId: string, input: unknown): Promise<Result> {
  const lab = await labById(labId)
  if (!lab) return fail('That lab doesn’t exist.', 'not-found')
  const actor = await actorFor(labId)
  requireManager(actor)
  const parsed = blackoutSchema.safeParse(input)
  if (!parsed.success || !isValidDateString(parsed.data.startsOn) || !isValidDateString(parsed.data.endsOn)) return fail('Give a valid start and end date.')
  if (parsed.data.endsOn < parsed.data.startsOn) return fail('The end date must not be before the start date.')

  await db.transaction(async (tx) => {
    const [row] = await tx.insert(labBlackouts).values({ labId, startsOn: parsed.data.startsOn, endsOn: parsed.data.endsOn, reason: parsed.data.reason ?? '' }).returning({ id: labBlackouts.id })
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_blackout_added', entityType: 'lab', entityId: labId, before: null, after: { blackoutId: row!.id, startsOn: parsed.data.startsOn, endsOn: parsed.data.endsOn } })
  })
  return { ok: true }
}

export async function removeBlackout(labId: string, blackoutId: string): Promise<Result> {
  const actor = await actorFor(labId)
  requireManager(actor)
  const removed = await db.transaction(async (tx) => {
    const gone = await tx.delete(labBlackouts).where(and(eq(labBlackouts.id, blackoutId), eq(labBlackouts.labId, labId))).returning({ id: labBlackouts.id })
    if (gone.length === 0) return false
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_blackout_removed', entityType: 'lab', entityId: labId, before: { blackoutId }, after: null })
    return true
  })
  return removed ? { ok: true } : fail('That closed period doesn’t exist.', 'not-found')
}

const staffSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter the person’s email address.'), role: z.enum(['head', 'assistant']) })

/** Heads add assistants; only an administrator appoints a head. The person must already have a verified account. */
export async function addLabStaff(labId: string, input: unknown): Promise<Result> {
  const lab = await labById(labId)
  if (!lab) return fail('That lab doesn’t exist.', 'not-found')
  const actor = await actorFor(labId)
  requireManager(actor)
  const parsed = staffSchema.safeParse(input)
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the details.')
  if (parsed.data.role === 'head' && !actor.isAdmin) return fail('Only a lab administrator can appoint a head.', 'forbidden')

  const person = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email), columns: { id: true, emailVerified: true, isActive: true } })
  if (!person || !person.isActive) return fail('No active account has that email address. They need to sign up first.', 'not-found')
  if (!person.emailVerified) return fail('That person has not verified their email address yet.', 'invalid')

  const done = await db.transaction(async (tx) => {
    const existing = await tx.query.labStaff.findFirst({ where: and(eq(labStaff.labId, labId), eq(labStaff.userId, person.id)) })
    if (existing && existing.role === parsed.data.role) return 'same' as const
    if (existing) await tx.update(labStaff).set({ role: parsed.data.role }).where(eq(labStaff.id, existing.id))
    else await tx.insert(labStaff).values({ labId, userId: person.id, role: parsed.data.role })
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_staff_added', entityType: 'lab', entityId: labId, before: existing ? { role: existing.role } : null, after: { userId: person.id, role: parsed.data.role } })
    return 'changed' as const
  })
  return done === 'same' ? fail('They already have that role in this lab.', 'state') : { ok: true }
}

export async function removeLabStaff(labId: string, staffId: string): Promise<Result> {
  const actor = await actorFor(labId)
  requireManager(actor)
  const row = await db.query.labStaff.findFirst({ where: and(eq(labStaff.id, staffId), eq(labStaff.labId, labId)) })
  if (!row) return fail('That person is not on this lab’s staff.', 'not-found')
  if (row.role === 'head' && !actor.isAdmin) return fail('Only a lab administrator can remove a head.', 'forbidden')
  await db.transaction(async (tx) => {
    await tx.delete(labStaff).where(eq(labStaff.id, staffId))
    await tx.insert(auditLogs).values({ actorUserId: actor.id, action: 'lab_staff_removed', entityType: 'lab', entityId: labId, before: { userId: row.userId, role: row.role }, after: null })
  })
  return { ok: true }
}
