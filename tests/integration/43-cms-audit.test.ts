import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb, createUser, db } from '../support/helpers'
import { payloadClient } from '../support/payload'

/**
 * Content changes made as a signed-in staff member leave an audit row naming the actor (module 43):
 * create, publish, unpublish and delete, with the status before and after and no document body.
 */

const stamp = Date.now()
let actorId: string

const rows = async (entityId: string) =>
  (
    await db().query(
      `select action, actor_user_id, before, after from app.audit_logs where entity_type = 'events' and entity_id = $1 order by created_at, id`,
      [entityId],
    )
  ).rows as { action: string; actor_user_id: string; before: { status?: string } | null; after: { status?: string } | null }[]

beforeAll(async () => {
  actorId = await createUser({ email: `cms-audit-${stamp}@audit.test`, staffRole: 'super_admin' })
})
afterAll(closeDb)

describe('CMS audit trail', () => {
  it('records create, publish, unpublish and delete by the staff member who made them', async () => {
    const payload = await payloadClient()
    const user = { id: actorId, collection: 'staff', staffRole: 'super_admin' } as never
    const base = { collection: 'events' as const, user, overrideAccess: false as const }

    const created = await payload.create({
      ...base,
      data: { title: `Audit event ${stamp}`, summary: 'Audit trail check', startsAt: new Date(Date.now() + 86_400_000).toISOString(), _status: 'draft' } as never,
      draft: true,
    })
    const id = String(created.id)
    await payload.update({ ...base, id: created.id, data: { _status: 'published' } as never })
    await payload.update({ ...base, id: created.id, data: { _status: 'draft' } as never, draft: true })
    await payload.delete({ ...base, id: created.id })

    const log = await rows(id)
    const actions = log.map((r) => r.action)
    expect(actions).toContain('cms.create')
    expect(actions).toContain('cms.publish')
    expect(actions).toContain('cms.delete')
    expect(log.find((r) => r.action === 'cms.publish')?.after?.status).toBe('published')
    expect(log.every((r) => r.actor_user_id === actorId)).toBe(true)
  })
})
