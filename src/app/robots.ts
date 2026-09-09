import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

/**
 * Everything public is crawlable; everything that needs a login is not.
 * These paths are already guarded server-side — this only stops crawlers
 * wasting requests on pages that will redirect them to /login, and stops
 * a stray application or dashboard URL being indexed if one ever leaks.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/dashboard', '/apply', '/onboarding', '/api/', '/verify', '/reset'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
