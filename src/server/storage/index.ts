import { randomBytes } from 'node:crypto'
import path from 'node:path'

/**
 * Application documents live only in S3 (or an S3-compatible stand-in in tests): an upload is written to the
 * quarantine bucket, and a copy reaches the separate documents bucket only after a verdict bound to that exact
 * object version (src/server/security/scan-processor.ts). The S3 calls themselves are in ./documents.ts.
 *
 * There is deliberately no local-disk backend. A second storage path that skips quarantine would be a way around
 * screening, and the container filesystem is not durable anyway. For local work run `pnpm dev:local`, which starts
 * the same S3 and queue code paths against local stand-ins.
 */

export { createDocumentStorage, documentStorage, StorageError } from './documents'
export type { DocumentStorage, ObjectRef, QuarantineUpload, StoredObject } from './documents'

export function generateStorageKey(originalName: string): string {
  // The extension comes from the client. Keep only a short alphanumeric one so nothing else
  // from the uploaded name can reach the object key.
  const rawExt = path.extname(originalName).toLowerCase()
  const ext = /^\.[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : ''
  return `${new Date().toISOString().slice(0, 10)}/${randomBytes(16).toString('hex')}${ext}`
}
