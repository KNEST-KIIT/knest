import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig, GlobalAfterChangeHook } from 'payload'
import { revalidateTag } from 'next/cache'
import { CONTENT_TAG } from '@/server/content/cache'

/**
 * Expires the cached public reads (src/server/content/cache.ts) whenever content changes, so a publish,
 * an unpublish or a delete shows on the next visit rather than after the time limit.
 *
 * Seeds, migrations and scripts run these hooks outside a Next server, where revalidateTag has nothing to
 * act on and throws; there is no cache to expire in that case, so the failure is ignored.
 */
function expire() {
  try {
    revalidateTag(CONTENT_TAG, { expire: 0 })
  } catch {
    // not running under Next: nothing cached
  }
}

export const expireContentAfterChange: CollectionAfterChangeHook = async ({ doc }) => {
  expire()
  return doc
}

export const expireContentAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  expire()
  return doc
}

export const expireContentAfterGlobalChange: GlobalAfterChangeHook = async ({ doc }) => {
  expire()
  return doc
}

/** Adds the expiry hooks after a collection's own hooks, leaving those untouched. */
export function withContentExpiry<T extends CollectionConfig>(collection: T): T {
  return {
    ...collection,
    hooks: {
      ...collection.hooks,
      afterChange: [...(collection.hooks?.afterChange ?? []), expireContentAfterChange],
      afterDelete: [...(collection.hooks?.afterDelete ?? []), expireContentAfterDelete],
    },
  }
}
