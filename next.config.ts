import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

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
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
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

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
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
