import { describe, expect, it } from 'vitest'
import { sendViaSes } from './send'

describe('sendViaSes', () => {
  it('sends one plain-text message with the right sender, recipient, subject and body', async () => {
    const sent: { input: Record<string, unknown> }[] = []
    const client = { send: async (command: unknown) => void sent.push(command as { input: Record<string, unknown> }) }
    await sendViaSes(client, { to: 'student@kiit.ac.in', subject: 'Your application — an update', text: 'Hello\nSee https://kiitnest.com/dashboard' }, 'KNEST <no-reply@kiitnest.com>')

    expect(sent).toHaveLength(1)
    expect(sent[0]!.input).toEqual({
      FromEmailAddress: 'KNEST <no-reply@kiitnest.com>',
      Destination: { ToAddresses: ['student@kiit.ac.in'] },
      Content: {
        Simple: {
          Subject: { Data: 'Your application — an update', Charset: 'UTF-8' },
          Body: { Text: { Data: 'Hello\nSee https://kiitnest.com/dashboard', Charset: 'UTF-8' } },
        },
      },
    })
  })

  it('adds the configuration set when one is configured', async () => {
    const sent: { input: Record<string, unknown> }[] = []
    const client = { send: async (command: unknown) => void sent.push(command as { input: Record<string, unknown> }) }
    await sendViaSes(client, { to: 'a@b.test', subject: 's', text: 't' }, 'no-reply@kiitnest.com', 'knest-production')
    expect(sent[0]!.input.ConfigurationSetName).toBe('knest-production')
  })

  it('lets a send failure reach the caller (callers decide whether it is fatal)', async () => {
    const client = {
      send: async () => {
        throw new Error('MessageRejected')
      },
    }
    await expect(sendViaSes(client, { to: 'a@b.test', subject: 's', text: 't' }, 'no-reply@kiitnest.com')).rejects.toThrow('MessageRejected')
  })
})
