import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, GlobalAfterChangeHook } from 'payload'
import { db } from '@/db/client'
import { auditLogs } from '@/db/schema'

/**
 * Audit rows for content changes made in the staff console (publish, unpublish, edit, delete).
 * Review decisions, member changes and enquiries already write their own rows; this closes the
 * remaining gap for CMS actions (module 43). The row names who did it and, for drafts, the status
 * before and after, but never copies the document body: the document and its version history are
 * the record of content.
 *
 * Requests without a signed-in staff user (seeds, migrations) are skipped: there is no actor to
 * name and the foreign key requires one.
 */

type Doc = { id?: string | number; _status?: string | null; slug?: string | null; title?: string | null } | undefined

const label = (doc: Doc) => ({ title: doc?.title ?? null, slug: doc?.slug ?? null })

async function record(actorId: string | undefined, action: string, entityType: string, entityId: string, before: unknown, after: unknown) {
  if (!actorId) return
  try {
    await db.insert(auditLogs).values({ actorUserId: actorId, action, entityType, entityId, before, after })
  } catch (error) {
    // The edit itself must not fail because the trail could not be written; the failure is loud in the log.
    console.error('[audit] could not record a content change', error)
  }
}

export const auditAfterChange: CollectionAfterChangeHook = async ({ collection, doc, previousDoc, operation, req }) => {
  const before = previousDoc as Doc
  const after = doc as Doc
  const statusChanged = (before?._status ?? null) !== (after?._status ?? null)
  const action =
    operation === 'create'
      ? 'cms.create'
      : statusChanged && after?._status === 'published'
        ? 'cms.publish'
        : statusChanged && after?._status === 'draft'
          ? 'cms.unpublish'
          : 'cms.update'
  await record(
    req.user?.id ? String(req.user.id) : undefined,
    action,
    collection.slug,
    String(after?.id ?? ''),
    operation === 'create' ? null : { status: before?._status ?? null, ...label(before) },
    { status: after?._status ?? null, ...label(after) },
  )
  return doc
}

export const auditAfterDelete: CollectionAfterDeleteHook = async ({ collection, doc, id, req }) => {
  await record(req.user?.id ? String(req.user.id) : undefined, 'cms.delete', collection.slug, String(id), { ...label(doc as Doc) }, null)
  return doc
}

export const auditGlobalAfterChange: GlobalAfterChangeHook = async ({ global, doc, req }) => {
  await record(req.user?.id ? String(req.user.id) : undefined, 'cms.update', `global:${global.slug}`, global.slug, null, { updated: true })
  return doc
}

/** Adds the audit hooks after a collection's own hooks, leaving those untouched. */
export function withAudit<T extends CollectionConfig>(collection: T): T {
  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [...(collection.hooks?.afterChange ?? []), auditAfterChange],
      afterDelete: [...(collection.hooks?.afterDelete ?? []), auditAfterDelete],
    },
  }
}
