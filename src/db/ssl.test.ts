import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { databaseSsl } from './ssl'

const dir = mkdtempSync(path.join(os.tmpdir(), 'knest-ssl-'))
const caFile = path.join(dir, 'bundle.pem')
writeFileSync(caFile, 'TEST-CA-BUNDLE')
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('databaseSsl', () => {
  it('is off by default and when set to off', () => {
    expect(databaseSsl({})).toBe(false)
    expect(databaseSsl({ DATABASE_SSL: 'off' })).toBe(false)
  })

  it('verify mode checks the certificate against the supplied authority bundle', () => {
    expect(databaseSsl({ DATABASE_SSL: 'verify', DATABASE_SSL_CA_FILE: caFile })).toEqual({ ca: 'TEST-CA-BUNDLE', rejectUnauthorized: true })
  })

  it('verify mode without a bundle is an error, not a silent downgrade', () => {
    expect(() => databaseSsl({ DATABASE_SSL: 'verify' })).toThrow(/DATABASE_SSL_CA_FILE/)
  })

  it('an unreadable bundle is an error', () => {
    expect(() => databaseSsl({ DATABASE_SSL: 'verify', DATABASE_SSL_CA_FILE: path.join(dir, 'missing.pem') })).toThrow()
  })

  it('has no mode that encrypts without verifying', () => {
    // Anything other than "verify" is treated as off; there is nothing in between.
    expect(databaseSsl({ DATABASE_SSL: 'require' })).toBe(false)
  })
})
