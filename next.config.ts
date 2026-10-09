import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'
const isVercel = Boolean(process.env.VERCEL)

/**
 * §4.3: no nonces — this is a next.config.ts headers() export, not
 * middleware, so there is no per-request nonce to hand out. `unsafe-inline`
 * on both script-src and style-src is required by the Payload admin UI's own
 * bundled styles and hydration scripts, confirmed by loading a real /admin
 * page with this policy in report-only mode first (PHASE-10-12-
 * IMPLEMENTATION-PLAN.md §4.3) before enforcing it here. `unsafe-eval` is
 * dev-only — React's dev-mode error reconstruction needs it; production
 * never does.
 */
const cspDirectives = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ''}`,
  // Cloudflare Turnstile renders its challenge in a frame.
  `frame-src https://challenges.cloudflare.com`,
  `style-src 'self' 'unsafe-inline'`,
  // gravatar.com: the Payload admin UI's own account-menu avatar, confirmed
  // by loading a real /admin page with this policy in report-only mode.
  `img-src 'self' blob: data: https://www.gravatar.com`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
]
const cspHeaderValue = cspDirectives.join('; ')

/**
 * Responses that depend on who is signed in, or that carry private data, must
 * never be stored by a shared cache (CloudFront, a corporate proxy). The CDN is
 * also configured not to cache these paths; this is the origin saying so itself.
 */
const PRIVATE_PATHS = [
  '/api/:path*',
  '/dashboard/:path*',
  '/admin/:path*',
  '/apply/:path*',
  '/onboarding/:path*',
  '/login',
  '/signup',
  '/verify/:path*',
  '/reset/:path*',
]
const noStore = PRIVATE_PATHS.map((source) => ({
  source,
  headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
}))

const nextConfig: NextConfig = {
  output: isVercel ? undefined : 'standalone',
  reactStrictMode: true,
  experimental: {
    // With a proxy (src/proxy.ts) Next buffers each request body and silently truncates it at
    // this size (default 10 MB). Uploads may be exactly 10 MB plus multipart framing, so the
    // buffer must be larger, or a file at the limit arrives cut off and fails to parse.
    proxyClientMaxBodySize: '12mb',
  },
  poweredByHeader: false,
  async headers() {
    return [
      ...noStore,
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: cspHeaderValue },
        ],
      },
    ]
  },
}

export default withPayload(nextConfig)
