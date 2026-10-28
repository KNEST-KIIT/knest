/**
 * What the browser knows about an attached file's malware check. Plain data, safe to import from client code: it
 * carries a name, a state and a sentence, never a bucket, version, checksum or threat name (the server sends only that).
 */
export type DocumentScanState = 'pending' | 'clean' | 'infected' | 'unscannable' | 'scan_error'
export type ClientDocument = { fileName: string; scanStatus: DocumentScanState; message: string }

export const PENDING_MESSAGE = 'We are checking this file for malware. This usually takes a minute or two.'

export const isRejected = (state: DocumentScanState) => state === 'infected' || state === 'unscannable' || state === 'scan_error'

/** Files that count as "attached" when resuming a draft: a rejected file is not an answer, a waiting or clean one is. */
export function attachedNames(documents: Record<string, ClientDocument>): Record<string, string> {
  return Object.fromEntries(Object.entries(documents).filter(([, d]) => !isRejected(d.scanStatus)).map(([id, d]) => [id, d.fileName]))
}

/** What stops a submission: files still being checked, and files that failed the check. */
export function submissionBlockers(documents: Record<string, ClientDocument>): { waiting: string[]; rejected: string[] } {
  const all = Object.values(documents)
  return {
    waiting: all.filter((d) => d.scanStatus === 'pending').map((d) => d.fileName),
    rejected: all.filter((d) => isRejected(d.scanStatus)).map((d) => d.fileName),
  }
}

/** Seconds to wait before asking again: quick at first, then gentler on the server. */
export function pollDelayMs(attempt: number): number {
  if (attempt < 5) return 2_000
  if (attempt < 30) return 4_000
  return 10_000
}
