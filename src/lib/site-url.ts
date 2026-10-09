/**
 * The public origin of the site, used wherever a link has to work outside the
 * page it was rendered on (e-mails, notifications, verification links).
 * NEXT_PUBLIC_SITE_URL is the source of truth; the Vercel variables are a
 * fallback for preview deployments only.
 */
export function siteUrl(): string {
  // SITE_URL is read at run time, so one container image can be started with
  // whatever address it is served from. NEXT_PUBLIC_SITE_URL is inlined into the
  // build by Next.js, so it can only ever hold the value from build time.
  const url = (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL)?.trim()
  if (url) return url.replace(/\/+$/, '')
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** An absolute link to a path on this site. `path` must start with a slash. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`
}
