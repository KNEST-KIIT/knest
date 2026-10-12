import { requireAdminArea } from '@/server/auth/guards'

/** The permission check lives in the layout so a role without access gets a real 404 status. */
export default async function AreaLayout({ children }: { children: React.ReactNode }) {
  await requireAdminArea('mail')
  return children
}
