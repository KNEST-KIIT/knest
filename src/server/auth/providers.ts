import Google from 'next-auth/providers/google'
import type { Provider } from 'next-auth/providers'
import { verifiedGoogleEmail } from './google-profile'

type Env = Record<string, string | undefined>

/**
 * Google sign-in is on only when BOTH halves of the credential are set. One place decides,
 * so the login page, the signup page, the start route and the provider list can never
 * disagree about it.
 */
export function googleConfigured(env: Env = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim())
}

/**
 * The Auth.js provider list. AUTH_GOOGLE_ISSUER points discovery at another OpenID server;
 * it exists so the test suite can run the whole flow against a local stand-in instead of
 * Google. Leave it unset in every real environment.
 */
export function authProviders(env: Env = process.env): Provider[] {
  if (!googleConfigured(env)) return []
  const issuer = env.AUTH_GOOGLE_ISSUER?.trim()
  return [Google({
    ...(issuer ? { issuer } : {}),
    clientId: env.AUTH_GOOGLE_ID,
    clientSecret: env.AUTH_GOOGLE_SECRET,
    authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } },
    checks: ['pkce', 'state'],
    profile(profile) {
      return { id: profile.sub, email: verifiedGoogleEmail(profile), name: profile.name, image: profile.picture }
    },
    // KNEST uses Google only to identify someone, never to call Google APIs later.
    account: () => ({}),
  })]
}
