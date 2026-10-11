import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('production Server Action transport', () => {
  it('publishes no internal application, auth, notification or event services', () => {
    // Inspect the actual compiled transport table, not a source directive check.
    const manifest = readFileSync(path.resolve(import.meta.dirname, '../../.next/server/server-reference-manifest.json'), 'utf8')
    const privateExports = [
      'getApplicationStatusForUser', 'findApplicationForProgram', 'listApplicationsForUser',
      'getOwnedApplicationDetail', 'listNotificationsForUser', 'countUnread',
      'getApplicationForReview', 'listApplicationsForReview', 'submitApplication',
      'startApplication', 'saveAnswer', 'uploadDocument', 'changeApplicationStatus',
      'getRegistrationStatus', 'listRegisteredEventsForUser', 'registerForEvent',
      'loginWithPassword', 'signUpWithPassword', 'resetPassword', 'sendVerificationEmail',
    ]
    for (const name of privateExports) expect(manifest, `${name} must have no public action registration`).not.toContain(`"${name}"`)
  })
})
