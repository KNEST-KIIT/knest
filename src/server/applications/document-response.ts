import 'server-only'

import { NextResponse } from 'next/server'
import { documentStorage, StorageError } from '@/server/storage'

/**
 * The one place a stored application document is turned into an HTTP response, for the applicant's own download and
 * for the staff download alike.
 *
 *   pending                          423 Locked, with Retry-After: the file is waiting for its malware verdict and cannot be read by anyone
 *   infected / unscannable / error   404: a rejected file is indistinguishable from one that was never accepted
 *   clean                            200, read from the CLEAN bucket at the exact version recorded when it was promoted
 *
 * There is no code path from here to the quarantine bucket, so an unscreened byte cannot be served even by mistake.
 */

export type ServableDocument = {
  fileName: string
  mimeType: string
  fileSize: number
  storageKey: string
  scanStatus: 'pending' | 'clean' | 'infected' | 'unscannable' | 'scan_error'
  cleanVersionId: string | null
}

const NO_STORE = 'private, no-store'

export function lockedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'This file is still being checked for malware. Try again in a minute.', scanStatus: 'pending' },
    { status: 423, headers: { 'Retry-After': '30', 'Cache-Control': NO_STORE } },
  )
}

export async function serveDocument(document: ServableDocument, options: { afterRead?: () => Promise<void> } = {}): Promise<NextResponse> {
  if (document.scanStatus === 'pending') return lockedResponse()
  if (document.scanStatus !== 'clean' || !document.cleanVersionId) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': NO_STORE } })
  }
  const storage = documentStorage()
  if (!storage) return NextResponse.json({ error: 'Documents are unavailable right now.' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })

  let bytes: Buffer
  try {
    bytes = await storage.readClean(document.storageKey, document.cleanVersionId)
  } catch (error) {
    const kind = error instanceof StorageError ? error.kind : 'transient'
    console.error(`document_read_failed kind=${kind}`)
    return kind === 'not-found'
      ? NextResponse.json({ error: 'Not found.' }, { status: 404, headers: { 'Cache-Control': NO_STORE } })
      : NextResponse.json({ error: 'Documents are unavailable right now.' }, { status: 503, headers: { 'Cache-Control': NO_STORE } })
  }
  await options.afterRead?.()

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': document.mimeType,
      // The stored name is whatever the uploader's browser sent. Quotes, line breaks and non-ASCII characters in a
      // header value throw or split the header, so the plain name is reduced to safe ASCII and the real name is
      // offered separately in the RFC 5987 form.
      'Content-Disposition': `attachment; filename="${document.fileName.replace(/[^\w. -]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      'Content-Length': String(bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': NO_STORE,
    },
  })
}
