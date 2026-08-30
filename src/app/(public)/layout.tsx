import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SkipLink } from '@/components/layout/skip-link'
import { getSessionUser } from '@/server/auth/guards'
import { countUnread } from '@/server/notifications/actions'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Only used to decide between "Start building" and "Dashboard" in the header.
  // Nothing on a public page is gated by it.
  const user = await getSessionUser()
  const unreadCount = user ? await countUnread(user.id) : 0

  return (
    <>
      <SkipLink />
      <SiteHeader signedIn={Boolean(user)} unreadCount={unreadCount} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  )
}
