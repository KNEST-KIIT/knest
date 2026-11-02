/**
 * Guards for the announcement webhooks (src/server/hackathons/webhooks.ts). The Discord address and the
 * Telegram token are typed in by an organiser and the server calls them, so they are checked before they are
 * stored and again before they are used: a webhook address is a place the server will send requests to.
 */

/** Discord serves incoming webhooks from these hosts and no others. */
const DISCORD_HOSTS = new Set(['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'])

export function isDiscordWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && DISCORD_HOSTS.has(url.hostname) && /^\/api\/webhooks\/\d+\/[\w-]+\/?$/.test(url.pathname)
  } catch {
    return false
  }
}

/** A bot token is "<digits>:<35 or so URL-safe characters>". It goes into a URL path, so anything else is refused. */
export function isTelegramBotToken(value: string): boolean {
  return /^\d{5,15}:[\w-]{30,60}$/.test(value)
}

export function isTelegramChatId(value: string): boolean {
  return /^(-?\d{5,20}|@[A-Za-z][\w]{4,31})$/.test(value)
}

/** Telegram's HTML mode treats these three characters as markup. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Both services reject a message over their limit outright, so an over-long one is cut rather than lost. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`
}

export const LIMITS = {
  discordTitle: 256,
  discordDescription: 4000,
  discordFieldName: 256,
  discordFieldValue: 1024,
  discordFields: 24,
  telegramText: 4000,
} as const
