import { describe, expect, it } from 'vitest'
import { escapeHtml, isDiscordWebhookUrl, isTelegramBotToken, isTelegramChatId, truncate } from './webhook-safety'

describe('webhook safety', () => {
  it('accepts only real Discord webhook addresses', () => {
    expect(isDiscordWebhookUrl('https://discord.com/api/webhooks/123456789/abc-DEF_123')).toBe(true)
    expect(isDiscordWebhookUrl('https://discordapp.com/api/webhooks/123456789/abc')).toBe(true)
    for (const bad of [
      'http://discord.com/api/webhooks/123/abc',
      'https://169.254.169.254/latest/meta-data',
      'https://discord.com.evil.example/api/webhooks/123/abc',
      'https://evil.example/api/webhooks/123/abc',
      'https://user:pw@discord.com/api/webhooks/123/abc',
      'https://discord.com:8443/api/webhooks/123/abc',
      'https://discord.com/other/path',
      'not a url',
      '',
    ]) {
      expect(isDiscordWebhookUrl(bad), bad).toBe(false)
    }
  })

  it('accepts only well-formed Telegram tokens and chat ids', () => {
    expect(isTelegramBotToken('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')).toBe(true)
    expect(isTelegramBotToken('123456789:abc/../../x')).toBe(false)
    expect(isTelegramBotToken('x')).toBe(false)
    expect(isTelegramChatId('-1001234567890')).toBe(true)
    expect(isTelegramChatId('@knest_updates')).toBe(true)
    expect(isTelegramChatId('1; drop')).toBe(false)
  })

  it('escapes markup and truncates to a limit', () => {
    expect(escapeHtml('<b>Team & "Co"</b>')).toBe('&lt;b&gt;Team &amp; "Co"&lt;/b&gt;')
    expect(truncate('abcdef', 4)).toBe('abc…')
    expect(truncate('abc', 4)).toBe('abc')
  })
})
