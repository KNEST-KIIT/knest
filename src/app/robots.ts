import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

/**
 * Search engines are told to stay away until the site is deliberately opened:
 * SITE_INDEXING must be exactly "on" (set by the release manifest, not by default).
 * src/proxy.ts also sends X-Robots-Tag: noindex while it is off, which covers pages that robots.txt
 * alone does not stop from being listed.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXING !== 'on') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/dashboard', '/apply', '/onboarding', '/login', '/signup', '/verify', '/reset'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
