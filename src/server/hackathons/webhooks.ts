import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { hackathonAnnouncements, hackathonEvents } from '@/db/schema'
import { escapeHtml, isDiscordWebhookUrl, isTelegramBotToken, isTelegramChatId, LIMITS, truncate } from './webhook-safety'

export type WebhookPayload = {
  title: string
  body: string
  type: 'info' | 'success' | 'warning' | 'deadline' | 'winner'
  hackathonTitle: string
  hackathonSlug: string
  actionUrl?: string
  fields?: { name: string; value: string; inline?: boolean }[]
}

const TYPE_COLORS: Record<string, number> = {
  info: 0x2b3350,      // Oxford Navy
  success: 0x15803d,   // Forest Green
  warning: 0x92400e,   // Amber
  deadline: 0xb91c1c,  // Oxblood / Critical
  winner: 0x7d5f18,    // Brass / Gold
}

/**
 * Format payload into a Discord Rich Embed. Discord rejects a whole message when any part is over its
 * limit, so every free-text part is cut to the documented size.
 */
function buildDiscordEmbed(payload: WebhookPayload) {
  const color = TYPE_COLORS[payload.type] ?? 0x2b3350
  const appBaseUrl = process.env.NEXTAUTH_URL || 'https://kiitnest.com'
  const hackathonUrl = `${appBaseUrl}/hackathons/${payload.hackathonSlug}`

  const fields = (payload.fields ?? []).slice(0, LIMITS.discordFields - 1).map((f) => ({
    name: truncate(f.name, LIMITS.discordFieldName),
    value: truncate(f.value || '-', LIMITS.discordFieldValue),
    inline: f.inline ?? true,
  }))

  return {
    username: 'KNEST Hackathons',
    avatar_url: `${appBaseUrl}/icon.png`,
    embeds: [
      {
        title: truncate(payload.title, LIMITS.discordTitle),
        description: truncate(payload.body, LIMITS.discordDescription),
        url: payload.actionUrl || hackathonUrl,
        color,
        fields: [
          { name: 'Hackathon', value: truncate(payload.hackathonTitle, LIMITS.discordFieldValue), inline: true },
          ...fields,
        ],
        footer: {
          text: 'KNEST Innovation Ecosystem · Campus 15B',
          icon_url: `${appBaseUrl}/icon.png`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }
}

/**
 * Format payload into a Telegram HTML message. Every piece of text that came from a person (titles, team
 * names, announcement bodies) is escaped: unescaped, a "<" in a team name makes Telegram refuse the whole
 * message, and a crafted one could add its own links.
 */
function buildTelegramMessage(payload: WebhookPayload): string {
  const appBaseUrl = process.env.NEXTAUTH_URL || 'https://kiitnest.com'
  const hackathonUrl = `${appBaseUrl}/hackathons/${payload.hackathonSlug}`
  const link = payload.actionUrl || hackathonUrl

  const lines = [
    `<b>${escapeHtml(payload.hackathonTitle)} announcement</b>`,
    '',
    `<b>${escapeHtml(payload.title)}</b>`,
    escapeHtml(payload.body),
    '',
  ]

  if (payload.fields && payload.fields.length > 0) {
    for (const f of payload.fields) {
      lines.push(`- <b>${escapeHtml(f.name)}:</b> ${escapeHtml(f.value)}`)
    }
    lines.push('')
  }

  lines.push(`<a href="${escapeHtml(link).replace(/"/g, '&quot;')}">Open in KNEST Portal</a>`)
  return truncate(lines.join('\n'), LIMITS.telegramText)
}

/**
 * Dispatch an announcement or alert to configured webhooks (Discord / Telegram).
 * Silently catches network timeouts so an offline external service never blocks user workflows.
 *
 * The addresses are organiser-supplied, so they are validated again here (they may have been stored before
 * the check existed) and redirects are refused: a webhook that answers with a redirect is not a Discord or
 * Telegram endpoint.
 */
export async function dispatchHackathonWebhook(
  hackathonId: string,
  payload: WebhookPayload,
  announcementId?: string,
): Promise<{ discordOk?: boolean; telegramOk?: boolean; error?: string }> {
  const hackathon = await db.query.hackathonEvents.findFirst({
    where: eq(hackathonEvents.id, hackathonId),
    columns: {
      discordWebhookUrl: true,
      telegramBotToken: true,
      telegramChatId: true,
    },
  })

  if (!hackathon) {
    return { error: 'Hackathon not found.' }
  }

  const results: { discordOk?: boolean; telegramOk?: boolean } = {}

  // 1. Discord Webhook
  if (hackathon.discordWebhookUrl) {
    if (!isDiscordWebhookUrl(hackathon.discordWebhookUrl)) {
      console.error('[Hackathon Webhook] Discord address is not a Discord webhook; not calling it')
      results.discordOk = false
    } else {
      try {
        const discordPayload = buildDiscordEmbed(payload)
        const res = await fetch(hackathon.discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
          redirect: 'error',
          signal: AbortSignal.timeout(5000),
        })
        results.discordOk = res.ok
      } catch (err) {
        console.error('[Hackathon Webhook] Discord dispatch failed:', err instanceof Error ? err.message : err)
        results.discordOk = false
      }
    }
  }

  // 2. Telegram Bot
  if (hackathon.telegramBotToken && hackathon.telegramChatId) {
    if (!isTelegramBotToken(hackathon.telegramBotToken) || !isTelegramChatId(hackathon.telegramChatId)) {
      console.error('[Hackathon Webhook] Telegram settings are malformed; not calling Telegram')
      results.telegramOk = false
    } else {
      try {
        const text = buildTelegramMessage(payload)
        const res = await fetch(
          `https://api.telegram.org/bot${hackathon.telegramBotToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: hackathon.telegramChatId,
              text,
              parse_mode: 'HTML',
              disable_web_page_preview: false,
            }),
            redirect: 'error',
            signal: AbortSignal.timeout(5000),
          },
        )
        results.telegramOk = res.ok
      } catch (err) {
        // The request URL carries the bot token, so only the message is logged, never the error's request.
        console.error('[Hackathon Webhook] Telegram dispatch failed:', err instanceof Error ? err.name : 'error')
        results.telegramOk = false
      }
    }
  }

  // If announcementId provided and any webhook succeeded, update the row
  if (announcementId && (results.discordOk || results.telegramOk)) {
    await db
      .update(hackathonAnnouncements)
      .set({
        webhookDispatched: true,
        webhookDispatchedAt: new Date(),
      })
      .where(eq(hackathonAnnouncements.id, announcementId))
  }

  return results
}
