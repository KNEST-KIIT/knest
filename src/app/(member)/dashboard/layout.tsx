import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SkipLink } from '@/components/layout/skip-link'
import { requireUser } from '@/server/auth/guards'

/**
 * Only requireUser() here, not requireOnboardedUser(): applying (/apply)
 * never required finishing onboarding, so an application can exist before
 * onboarding does. Blocking /dashboard/applications on onboarding completion
 * would let someone submit an application and then be unable to check its
 * status — a dead end this shell must not create. The root /dashboard page
 * is the one screen that genuinely needs onboarding data to render a
 * personalised next step, so it enforces completion itself.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/dashboard')

  return (
    <>
      <SkipLink />
      <SiteHeader signedIn />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  )
}
