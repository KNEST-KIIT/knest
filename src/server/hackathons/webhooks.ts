import 'server-only'

import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { hackathonAnnouncements, hackathonEvents } from '@/db/schema'

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
 * Format payload into a Discord Rich Embed.
 */
function buildDiscordEmbed(payload: WebhookPayload) {
  const color = TYPE_COLORS[payload.type] ?? 0x2b3350
  const appBaseUrl = process.env.NEXTAUTH_URL || 'https://kiitnest.com'
  const hackathonUrl = `${appBaseUrl}/hackathons/${payload.hackathonSlug}`

  const fields = payload.fields?.map((f) => ({
    name: f.name,
    value: f.value,
    inline: f.inline ?? true,
  })) ?? []

  return {
    username: 'KNEST Hackathons',
    avatar_url: `${appBaseUrl}/icon.png`,
    embeds: [
      {
        title: `📢 ${payload.title}`,
        description: payload.body,
        url: payload.actionUrl || hackathonUrl,
        color,
        fields: [
          { name: 'Hackathon', value: payload.hackathonTitle, inline: true },
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
 * Format payload into Telegram MarkdownV2 or HTML.
 */
function buildTelegramMessage(payload: WebhookPayload): string {
  const appBaseUrl = process.env.NEXTAUTH_URL || 'https://kiitnest.com'
  const hackathonUrl = `${appBaseUrl}/hackathons/${payload.hackathonSlug}`

  const lines = [
    `<b>🚀 ${payload.hackathonTitle} Announcement</b>`,
    '',
    `<b>${payload.title}</b>`,
    payload.body,
    '',
  ]

  if (payload.fields && payload.fields.length > 0) {
    for (const f of payload.fields) {
      lines.push(`• <b>${f.name}:</b> ${f.value}`)
    }
    lines.push('')
  }

  lines.push(`<a href="${payload.actionUrl || hackathonUrl}">Open in KNEST Portal →</a>`)
  return lines.join('\n')
}

/**
 * Dispatch an announcement or alert to configured webhooks (Discord / Telegram).
 * Silently catches network timeouts so an offline external service never blocks user workflows.
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
    try {
      const discordPayload = buildDiscordEmbed(payload)
      const res = await fetch(hackathon.discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload),
        signal: AbortSignal.timeout(5000),
      })
      results.discordOk = res.ok
    } catch (err) {
      console.error('[Hackathon Webhook] Discord dispatch failed:', err)
      results.discordOk = false
    }
  }

  // 2. Telegram Bot
  if (hackathon.telegramBotToken && hackathon.telegramChatId) {
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
          signal: AbortSignal.timeout(5000),
        },
      )
      results.telegramOk = res.ok
    } catch (err) {
      console.error('[Hackathon Webhook] Telegram dispatch failed:', err)
      results.telegramOk = false
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
