import { cache } from 'react'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

/**
 * A single memoised Payload instance per request (React's cache() dedupes
 * across every server component in the same render), reused by every read in
 * src/server/content/. Payload itself pools its DB connections underneath,
 * so this only saves repeated getPayload() setup, not connections.
 */
export const getContentClient = cache((): Promise<Payload> => getPayload({ config }))
