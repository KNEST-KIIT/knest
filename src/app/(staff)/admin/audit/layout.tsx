import { requireAdminArea } from '@/server/auth/guards'

/**
 * The permission check lives in a layout, not in the page: a layout runs before any of the page is
 * streamed, so a role without access gets a real 404 status, not a 200 with a not-found body.
 */
export default async function AreaLayout({ children }: { children: React.ReactNode }) {
  await requireAdminArea('audit')
  return children
}
