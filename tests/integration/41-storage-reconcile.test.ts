import { mkdirSync, existsSync, utimesSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDb } from '../support/helpers'

/**
 * Orphan reconciliation against the S3 stand-in, on the CLEAN documents bucket: an old object no row points at is
 * removed, a young one and anything outside the document key pattern are left alone, and a dry run changes nothing.
 */
const DIR = () => process.env.TEST_S3_DIR!
const key = (n: string) => `2026-01-02/${n.padStart(32, '0')}.pdf`
const put = (k: string, ageHours: number) => {
  const file = path.join(DIR(), ...k.split('/'))
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, 'x')
  const t = new Date(Date.now() - ageHours * 3600_000)
  utimesSync(file, t, t)
  return file
}

let reconcile: typeof import('@/server/storage/reconcile')

beforeAll(async () => {
  process.env.S3_BUCKET = process.env.TEST_S3_BUCKET
  process.env.QUARANTINE_BUCKET = process.env.TEST_QUARANTINE_BUCKET
  process.env.DOCUMENTS_BUCKET = process.env.TEST_DOCUMENTS_BUCKET
  process.env.DOCUMENTS_KMS_KEY_ARN = process.env.TEST_KMS_KEY_ARN
  process.env.MALWARE_SCAN_QUEUE_URL = process.env.TEST_SCAN_QUEUE_URL
  process.env.S3_ENDPOINT = process.env.TEST_S3_ENDPOINT
  process.env.S3_REGION = 'ap-south-1'
  process.env.S3_ACCESS_KEY_ID = 'test-access-key-id'
  process.env.S3_SECRET_ACCESS_KEY = 'test-secret-access-key'
  reconcile = await import('@/server/storage/reconcile')
})
afterAll(closeDb)

describe('upload orphan reconciliation (real listing, real delete)', () => {
  it('a dry run reports the orphan and removes nothing', async () => {
    const old = put(key('a1'), 100)
    const result = await reconcile.reconcileDocuments({ apply: false })
    expect(result.orphans).toContain(key('a1'))
    expect(result.removed).toBe(0)
    expect(existsSync(old)).toBe(true)
  })

  it('apply removes the old orphan, keeps a young one and CMS media', async () => {
    const old = path.join(DIR(), ...key('a1').split('/'))
    const young = put(key('b2'), 1)
    const media = put('media/logo.png', 500)
    const result = await reconcile.reconcileDocuments({ apply: true })
    expect(result.removed).toBeGreaterThanOrEqual(1)
    expect(existsSync(old)).toBe(false)
    expect(existsSync(young)).toBe(true)
    expect(existsSync(media)).toBe(true)
  })
})
