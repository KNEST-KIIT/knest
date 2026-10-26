import { describe, expect, it } from 'vitest'
import { cleanNotificationBody } from './notifications-list'

describe('cleanNotificationBody', () => {
  it('cleans localhost and 127 URLs', () => {
    expect(cleanNotificationBody('Visit http://localhost:3000/dashboard/applications/123 now.')).toBe(
      'Visit /dashboard/applications/123 now.',
    )
    expect(cleanNotificationBody('Visit http://127.0.0.1:3000/apply.')).toBe('Visit /apply.')
    expect(cleanNotificationBody('Head to http://localhost:3000')).toBe('Head to the portal')
  })

  it('cleans production, staging, and arbitrary external URLs without leaving raw protocol/host in text', () => {
    expect(cleanNotificationBody('New announcement at https://knest.kiit.ac.in/programs/build/info!')).toBe(
      'New announcement at /programs/build/info!',
    )
    expect(cleanNotificationBody('Check https://staging.example.com/apply for updates.')).toBe(
      'Check /apply for updates.',
    )
    expect(cleanNotificationBody('Go to https://example.com.')).toBe('Go to the portal.')
  })

  it('collapses excessive whitespace and preserves plain text', () => {
    expect(cleanNotificationBody('  Hello   world!  ')).toBe('Hello world!')
  })
})
